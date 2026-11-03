from functools import wraps
from math import isfinite
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.exc import IntegrityError

from categories import PRODUCT_CATEGORIES
from extensions import limiter
from models import AdminUser, Product, db

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
LOW_STOCK_THRESHOLD = 10
PRODUCT_FIELDS = {
    "name", "brand", "category", "price", "unit", "image", "location",
    "description", "tags", "allergens", "risks", "nutrition", "stock",
}
MAX_TEXT_LENGTHS = {
    "name": 120, "brand": 120, "category": 60, "unit": 40,
    "image": 500, "description": 5000,
}


def _serializer() -> URLSafeTimedSerializer:
    secret = current_app.config.get("ADMIN_TOKEN_SECRET")
    if not isinstance(secret, str) or len(secret) < 32:
        raise RuntimeError("ADMIN_TOKEN_SECRET deve ter ao menos 32 caracteres.")
    return URLSafeTimedSerializer(secret, salt="smartmarket-admin-v1")


def _error(message: str, status: int):
    return jsonify({"error": message}), status


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        scheme, separator, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not separator or not token:
            return _error("Autenticação administrativa necessária.", 401)

        try:
            claims = _serializer().loads(
                token,
                max_age=current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
            )
        except SignatureExpired:
            return _error("A sessão administrativa expirou. Entre novamente.", 401)
        except BadSignature:
            return _error("Token administrativo inválido.", 401)
        except RuntimeError:
            current_app.logger.exception("Configuração do token administrativo inválida")
            return _error("Autenticação administrativa não configurada.", 503)

        user = db.session.get(AdminUser, claims.get("sub")) if isinstance(claims, dict) else None
        if user is None or not user.is_active:
            return _error("Usuário administrativo inválido.", 401)
        return view(*args, **kwargs)

    return wrapped


def _valid_string(value, field: str, *, required: bool = True) -> bool:
    return (
        isinstance(value, str)
        and (not required or bool(value.strip()))
        and len(value.strip()) <= MAX_TEXT_LENGTHS[field]
    )


def _validate_text_fields(data: dict) -> str | None:
    for field in MAX_TEXT_LENGTHS:
        if not _valid_string(data[field], field):
            return f"Campo '{field}' inválido ou excede o limite permitido."
        data[field] = data[field].strip()
    return None


def _validate_price_and_stock(data: dict) -> str | None:
    price = data["price"]
    if isinstance(price, bool) or not isinstance(price, (int, float)) or not isfinite(price) or price <= 0:
        return "O preço deve ser um número positivo."
    if type(data["stock"]) is not int or data["stock"] < 0:
        return "O estoque deve ser um número inteiro não negativo."
    return None


def _normalize_location(location: object) -> dict | None:
    fields = ("sector", "aisle", "shelf")
    if not isinstance(location, dict) or any(
        not isinstance(location.get(field), str)
        or not location[field].strip()
        or len(location[field].strip()) > 80
        for field in fields
    ):
        return None
    return {field: location[field].strip() for field in fields}


def _normalize_string_list(values: object) -> list[str] | None:
    if (
        not isinstance(values, list)
        or len(values) > 50
        or any(
            not isinstance(value, str)
            or not value.strip()
            or len(value.strip()) > 120
            for value in values
        )
    ):
        return None
    return [value.strip() for value in values]


def _valid_risks(risks: object) -> bool:
    return (
        isinstance(risks, list)
        and len(risks) <= 50
        and all(
            isinstance(item, dict)
            and all(
                isinstance(item.get(field), str) and item[field].strip()
                for field in ("ingredient", "level", "description")
            )
            and item["level"] in {"Atenção", "Moderado"}
            for item in risks
        )
    )


def _valid_nutrition(nutrition: object) -> bool:
    return (
        isinstance(nutrition, list)
        and len(nutrition) <= 50
        and all(
            isinstance(item, dict)
            and all(
                isinstance(item.get(field), str) and item[field].strip()
                for field in ("label", "value")
            )
            for item in nutrition
        )
    )


def _normalize_categories(categories: object) -> list[str] | None:
    if (
        not isinstance(categories, list)
        or not categories
        or len(categories) > len(PRODUCT_CATEGORIES)
        or any(category not in PRODUCT_CATEGORIES for category in categories)
        or len(set(categories)) != len(categories)
    ):
        return None
    return categories


def _validate_product(payload: object):
    if not isinstance(payload, dict):
        return None, "O corpo da requisição deve ser um objeto JSON."
    missing = PRODUCT_FIELDS - payload.keys()
    if missing:
        return None, f"Campos obrigatórios ausentes: {', '.join(sorted(missing))}."

    data = dict(payload)
    error = _validate_text_fields(data)
    if error:
        return None, error
    error = _validate_price_and_stock(data)
    if error:
        return None, error

    location = _normalize_location(data["location"])
    if location is None:
        return None, "Localização inválida: informe setor, corredor e prateleira."

    for field in ("tags", "allergens"):
        values = _normalize_string_list(data[field])
        if values is None:
            return None, f"Campo '{field}' deve ser uma lista de textos válidos."
        data[field] = values

    if not _valid_risks(data["risks"]):
        return None, "Riscos nutricionais inválidos."

    if not _valid_nutrition(data["nutrition"]):
        return None, "Informações nutricionais inválidas."

    categories = _normalize_categories(data.get("categories", [data["category"]]))
    if categories is None:
        return None, "Selecione uma ou mais categorias válidas."

    data["categories"] = categories
    data["category"] = categories[0]
    data["location"] = location
    return data, None


def _apply_product(product: Product, data: dict) -> None:
    product.name = data["name"]
    product.brand = data["brand"]
    product.category = data["category"]
    product.categories = data["categories"]
    product.price = data["price"]
    product.unit = data["unit"]
    product.image = data["image"]
    product.description = data["description"]
    product.stock = data["stock"]
    product.location_sector = data["location"]["sector"]
    product.location_aisle = data["location"]["aisle"]
    product.location_shelf = data["location"]["shelf"]
    product.tags = data["tags"]
    product.allergens = data["allergens"]
    product.risks = data["risks"]
    product.nutrition = data["nutrition"]


@admin_bp.post("/auth/login")
@limiter.limit("5 per minute")
def login():
    if not request.is_json:
        return _error("O corpo da requisição deve ser um objeto JSON.", 400)
    payload = request.get_json(silent=True)
    username = payload.get("username") if isinstance(payload, dict) else None
    password = payload.get("password") if isinstance(payload, dict) else None
    if (
        not isinstance(username, str) or not isinstance(password, str)
        or not username.strip() or not password
    ):
        return _error("Informe usuário e senha.", 400)

    user = AdminUser.query.filter_by(username=username.strip().lower(), is_active=True).first()
    if user is None or not user.check_password(password):
        return _error("Usuário ou senha inválidos.", 401)
    try:
        token = _serializer().dumps({"sub": user.id, "username": user.username})
    except RuntimeError:
        current_app.logger.exception("Configuração do token administrativo inválida")
        return _error("Autenticação administrativa não configurada.", 503)
    return jsonify({
        "token": token,
        "expires_in": current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
        "username": user.username,
    })


@admin_bp.get("/auth/me")
@require_admin
def current_admin():
    authorization = request.headers.get("Authorization", "")
    token = authorization.partition(" ")[2]
    claims = _serializer().loads(token, max_age=current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"])
    return jsonify({"username": claims["username"]})


@admin_bp.get("/products")
@require_admin
def list_admin_products():
    include_archived = request.args.get("include_archived") == "true"
    query = Product.query
    if not include_archived:
        query = query.filter_by(is_active=True)
    products = query.order_by(Product.name).all()
    return jsonify({
        "products": [product.to_dict() for product in products],
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    })


@admin_bp.post("/products")
@require_admin
def create_product():
    if not request.is_json:
        return _error("O corpo da requisição deve ser um objeto JSON.", 400)
    data, error = _validate_product(request.get_json(silent=True))
    if error:
        return _error(error, 400)

    product = Product(id=f"SM-{uuid4().hex[:10].upper()}")
    _apply_product(product, data)
    db.session.add(product)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        current_app.logger.exception("Conflito ao criar produto")
        return _error("Não foi possível gerar um código único para o produto. Tente novamente.", 409)
    return jsonify(product.to_dict()), 201


@admin_bp.put("/products/<product_id>")
@require_admin
def update_product(product_id: str):
    if not request.is_json:
        return _error("O corpo da requisição deve ser um objeto JSON.", 400)
    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Produto não encontrado.", 404)
    data, error = _validate_product(request.get_json(silent=True))
    if error:
        return _error(error, 400)
    _apply_product(product, data)
    db.session.commit()
    return jsonify(product.to_dict())


@admin_bp.patch("/products/<product_id>/stock")
@require_admin
def update_stock(product_id: str):
    payload = request.get_json(silent=True) if request.is_json else None
    quantity = payload.get("stock") if isinstance(payload, dict) else None
    if type(quantity) is not int or quantity < 0:
        return _error("O estoque deve ser um número inteiro não negativo.", 400)
    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Produto não encontrado.", 404)
    product.stock = quantity
    db.session.commit()
    return jsonify(product.to_dict())


@admin_bp.post("/products/<product_id>/archive")
@require_admin
def archive_product(product_id: str):
    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Produto não encontrado.", 404)
    product.is_active = False
    db.session.commit()
    return jsonify(product.to_dict())


@admin_bp.post("/products/<product_id>/restore")
@require_admin
def restore_product(product_id: str):
    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Produto não encontrado.", 404)
    product.is_active = True
    db.session.commit()
    return jsonify(product.to_dict())
