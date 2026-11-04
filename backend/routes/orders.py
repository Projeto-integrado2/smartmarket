from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired
from sqlalchemy import delete, select, update

from extensions import limiter
from models import AdminUser, CustomerAccount, Product, SimulatedOrder, SimulatedOrderItem, StoreSetting, db
from services.auth import load_access_token

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")
PAYMENT_METHODS = {"pix", "card"}
MAX_ORDER_ITEMS = 30
ORDER_RETENTION_DAYS = 365
CENT = Decimal("0.01")


def _delete_expired_orders() -> None:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=ORDER_RETENTION_DAYS
    )
    expired_orders = select(SimulatedOrder.id).where(
        SimulatedOrder.created_at < cutoff
    )
    db.session.execute(
        delete(SimulatedOrderItem).where(
            SimulatedOrderItem.order_id.in_(expired_orders)
        )
    )
    db.session.execute(
        delete(SimulatedOrder).where(SimulatedOrder.created_at < cutoff)
    )


def _validate_order(
    payload: object,
) -> tuple[dict[str, int] | None, str | None, bool | None, str | None]:
    if not isinstance(payload, dict):
        return None, None, None, "O corpo da requisição deve ser um objeto JSON."
    if set(payload) - {"items", "payment_method", "delivery_requested"}:
        return None, None, None, "A compra simulada não recebe dados pessoais ou financeiros."

    payment_method = payload.get("payment_method")
    if not isinstance(payment_method, str) or payment_method not in PAYMENT_METHODS:
        return None, None, None, "Selecione uma forma de pagamento simulada válida."
    delivery_requested = payload.get("delivery_requested", False)
    if not isinstance(delivery_requested, bool):
        return None, None, None, "A opção de entrega deve ser válida."

    items = payload.get("items")
    if not isinstance(items, list) or not items or len(items) > MAX_ORDER_ITEMS:
        return None, None, None, f"O pedido deve conter de 1 a {MAX_ORDER_ITEMS} produtos."

    quantities: dict[str, int] = {}
    for item in items:
        if not isinstance(item, dict):
            return None, None, None, "Item inválido no pedido."
        product_id = item.get("product_id")
        quantity = item.get("quantity")
        if (
            not isinstance(product_id, str)
            or not product_id.strip()
            or len(product_id) > 20
            or type(quantity) is not int
            or not 1 <= quantity <= 999
        ):
            return None, None, None, "Produto ou quantidade inválida no pedido."
        total_quantity = quantities.get(product_id, 0) + quantity
        if total_quantity > 999:
            return None, None, None, "A quantidade de cada produto não pode exceder 999 unidades."
        quantities[product_id] = total_quantity

    return quantities, payment_method, delivery_requested, None


def _order_identity():
    authorization = request.headers.get("Authorization", "")
    if not authorization:
        return None, False, None, None
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token:
        return None, False, None, ({"error": "Token inválido."}, 401)
    try:
        claims = load_access_token(token)
    except SignatureExpired:
        return None, False, None, ({"error": "A sessão expirou. Entre novamente."}, 401)
    except (BadSignature, RuntimeError, ValueError):
        return None, False, None, ({"error": "Token inválido."}, 401)

    role = claims.get("role")
    if role == "customer":
        customer = db.session.get(CustomerAccount, claims.get("sub"))
        if customer is None or not customer.is_active:
            return None, False, None, ({"error": "Usuário inválido."}, 401)
        return customer.id, True, role, None
    if role == "admin":
        admin = db.session.get(AdminUser, claims.get("sub"))
        if admin is None or not admin.is_active:
            return None, False, None, ({"error": "Usuário inválido."}, 401)
        return None, True, role, None
    return None, False, None, ({"error": "Token inválido."}, 401)


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@orders_bp.post("/simulated")
@limiter.limit("15 per minute")
def create_simulated_order():
    if not request.is_json:
        return jsonify({"error": "O corpo da requisição deve ser um objeto JSON."}), 400

    quantities, payment_method, delivery_requested, error = _validate_order(
        request.get_json(silent=True)
    )
    if error:
        return jsonify({"error": error}), 400
    customer_id, authenticated, role, auth_error = _order_identity()
    if auth_error:
        return jsonify(auth_error[0]), auth_error[1]
    if delivery_requested and role != "customer":
        return jsonify({"error": "Entre em uma conta de cliente para selecionar entrega."}), 403

    products = {
        product.id: product
        for product in Product.query.filter(
            Product.id.in_(quantities),
            Product.is_active.is_(True),
        ).all()
    }

    missing_ids = set(quantities) - products.keys()
    if missing_ids:
        return jsonify({
            "error": "Um ou mais produtos não estão mais disponíveis no catálogo.",
            "unavailable_product_ids": sorted(missing_ids),
        }), 409

    order_id = f"SM-SIM-{uuid4().hex[:12].upper()}"
    order_items = []
    original_subtotal = Decimal("0.00")
    subtotal = Decimal("0.00")
    discount_total = Decimal("0.00")
    settings = db.session.get(StoreSetting, 1)
    club_discount_percent = settings.club_discount_percent if settings else 10

    try:
        for product_id, quantity in sorted(quantities.items()):
            product = products[product_id]
            result = db.session.execute(
                update(Product)
                .where(
                    Product.id == product_id,
                    Product.is_active.is_(True),
                    Product.stock >= quantity,
                )
                .values(stock=Product.stock - quantity)
                .execution_options(synchronize_session=False)
            )
            if result.rowcount != 1:
                available_stock = db.session.execute(
                    select(Product.stock).where(Product.id == product_id)
                ).scalar_one_or_none()
                db.session.rollback()
                return jsonify({
                    "error": f"Estoque insuficiente para {product.name}. Atualize o carrinho.",
                    "product_id": product_id,
                    "available_stock": available_stock or 0,
                }), 409

            unit_price = _money(Decimal(str(product.price)))
            original_line_total = _money(unit_price * quantity)
            eligible = authenticated and "Desconto Clube" in (product.tags or [])
            discount_percent = club_discount_percent if eligible else 0
            discounted_unit_price = _money(
                unit_price * Decimal(100 - discount_percent) / Decimal(100)
            )
            line_total = _money(discounted_unit_price * quantity)
            original_subtotal += original_line_total
            subtotal += line_total
            discount_total += original_line_total - line_total
            order_items.append(
                SimulatedOrderItem(
                    order_id=order_id,
                    product_id=product.id,
                    product_name=product.name,
                    quantity=quantity,
                    unit=product.unit,
                    unit_price=unit_price,
                    discounted_unit_price=discounted_unit_price,
                    discount_percent=discount_percent,
                    line_total=line_total,
                )
            )

        order = SimulatedOrder(
            id=order_id,
            customer_id=customer_id,
            payment_method=payment_method,
            subtotal=_money(subtotal),
            original_subtotal=_money(original_subtotal),
            discount_total=_money(discount_total),
            delivery_requested=delivery_requested,
            items=order_items,
        )
        db.session.add(order)
        _delete_expired_orders()
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Falha ao registrar pedido simulado")
        return jsonify({"error": "Não foi possível registrar a compra simulada."}), 500

    return jsonify({
        "order_id": order.id,
        "status": "simulated",
        "payment_method": order.payment_method,
        "subtotal": float(order.subtotal),
        "original_subtotal": float(order.original_subtotal),
        "discount_total": float(order.discount_total),
        "delivery_requested": order.delivery_requested,
        "items": [
            {
                "product_id": item.product_id,
                "name": item.product_name,
                "quantity": item.quantity,
                "unit": item.unit,
                "unit_price": float(item.unit_price),
                "discounted_unit_price": float(item.discounted_unit_price),
                "discount_percent": item.discount_percent,
                "original_line_total": float(_money(
                    Decimal(str(item.unit_price)) * item.quantity
                )),
                "line_total": float(item.line_total),
            }
            for item in order.items
        ],
    }), 201


@orders_bp.get("/rebuy")
def repurchase_products():
    customer_id, authenticated, role, auth_error = _order_identity()
    if auth_error:
        return jsonify(auth_error[0]), auth_error[1]
    if not authenticated or role != "customer" or customer_id is None:
        return jsonify({"error": "Entre em uma conta de cliente para ver suas recompras."}), 401

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=ORDER_RETENTION_DAYS
    )
    orders = SimulatedOrder.query.filter(
        SimulatedOrder.customer_id == customer_id,
        SimulatedOrder.created_at >= cutoff,
    ).order_by(SimulatedOrder.created_at.desc()).all()
    product_ids = list(dict.fromkeys(
        item.product_id
        for order in orders
        for item in order.items
    ))
    products = Product.query.filter(
        Product.id.in_(product_ids),
        Product.is_active.is_(True),
    ).all() if product_ids else []
    return jsonify({"products": [product.to_dict() for product in products]})
