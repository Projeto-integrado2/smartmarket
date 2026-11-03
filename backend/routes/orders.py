from datetime import datetime, timedelta, timezone
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import delete, select, update

from extensions import limiter
from models import Product, SimulatedOrder, SimulatedOrderItem, db

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")
PAYMENT_METHODS = {"pix", "card", "cash"}
MAX_ORDER_ITEMS = 30
ORDER_RETENTION_DAYS = 30


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


def _validate_order(payload: object) -> tuple[dict[str, int] | None, str | None, str | None]:
    if not isinstance(payload, dict):
        return None, None, "O corpo da requisição deve ser um objeto JSON."
    if set(payload) - {"items", "payment_method"}:
        return None, None, "A compra simulada não recebe dados pessoais ou financeiros."

    payment_method = payload.get("payment_method")
    if not isinstance(payment_method, str) or payment_method not in PAYMENT_METHODS:
        return None, None, "Selecione uma forma de pagamento simulada válida."

    items = payload.get("items")
    if not isinstance(items, list) or not items or len(items) > MAX_ORDER_ITEMS:
        return None, None, f"O pedido deve conter de 1 a {MAX_ORDER_ITEMS} produtos."

    quantities: dict[str, int] = {}
    for item in items:
        if not isinstance(item, dict):
            return None, None, "Item inválido no pedido."
        product_id = item.get("product_id")
        quantity = item.get("quantity")
        if (
            not isinstance(product_id, str)
            or not product_id.strip()
            or len(product_id) > 20
            or type(quantity) is not int
            or not 1 <= quantity <= 999
        ):
            return None, None, "Produto ou quantidade inválida no pedido."
        total_quantity = quantities.get(product_id, 0) + quantity
        if total_quantity > 999:
            return None, None, "A quantidade de cada produto não pode exceder 999 unidades."
        quantities[product_id] = total_quantity

    return quantities, payment_method, None


@orders_bp.post("/simulated")
@limiter.limit("15 per minute")
def create_simulated_order():
    if not request.is_json:
        return jsonify({"error": "O corpo da requisição deve ser um objeto JSON."}), 400

    quantities, payment_method, error = _validate_order(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

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
    subtotal = 0

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

            unit_price = round(float(product.price), 2)
            line_total = round(unit_price * quantity, 2)
            subtotal = round(subtotal + line_total, 2)
            order_items.append(
                SimulatedOrderItem(
                    order_id=order_id,
                    product_id=product.id,
                    product_name=product.name,
                    quantity=quantity,
                    unit=product.unit,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )

        order = SimulatedOrder(
            id=order_id,
            payment_method=payment_method,
            subtotal=subtotal,
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
        "items": [
            {
                "product_id": item.product_id,
                "name": item.product_name,
                "quantity": item.quantity,
                "unit": item.unit,
                "unit_price": float(item.unit_price),
                "line_total": float(item.line_total),
            }
            for item in order.items
        ],
    }), 201
