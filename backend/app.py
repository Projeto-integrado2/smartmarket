import json
from urllib.parse import urlsplit

from flask import Flask
from flask_cors import CORS
from flask_limiter.errors import RateLimitExceeded
from sqlalchemy import inspect, text
from werkzeug.security import generate_password_hash

from config import Config, _parse_cors_origins
from categories import LEGACY_CATEGORY_MAP, PRODUCT_CATEGORIES
from extensions import limiter
from models import AdminUser, StoreSetting, db
from routes import (
    admin_bp,
    auth_bp,
    branches_bp,
    catalog_bp,
    categories_bp,
    chatbot_bp,
    orders_bp,
    settings_bp,
)
from seed import seed_if_empty
from services import GeminiService


def _migrate_product_categories() -> None:
    columns = {column["name"] for column in inspect(db.engine).get_columns("products")}
    if "categories" not in columns:
        with db.engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE products ADD COLUMN categories JSON NOT NULL DEFAULT '[]'"
            ))

    with db.engine.begin() as connection:
        products = connection.execute(text(
            "SELECT id, category, categories FROM products"
        )).mappings().all()
        for product in products:
            legacy_category = product["category"]
            stored_categories = product["categories"]
            if isinstance(stored_categories, str):
                stored_categories = json.loads(stored_categories)
            categories = list(dict.fromkeys(
                item for item in stored_categories
                if isinstance(item, str) and item in PRODUCT_CATEGORIES
            )) if isinstance(stored_categories, list) else []
            if not categories and legacy_category in LEGACY_CATEGORY_MAP:
                categories = [LEGACY_CATEGORY_MAP[legacy_category]]
            category = categories[0] if categories else ""
            connection.execute(
                text("UPDATE products SET category = :category, categories = :categories WHERE id = :id"),
                {
                    "id": product["id"],
                    "category": category,
                    "categories": json.dumps(categories, ensure_ascii=False),
                },
            )


def _migrate_chat_message_timestamps() -> None:
    columns = {column["name"] for column in inspect(db.engine).get_columns("chat_messages")}
    if "created_at" not in columns:
        with db.engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE chat_messages ADD COLUMN created_at DATETIME"
            ))


def _migrate_account_and_order_columns() -> None:
    admin_columns = {
        column["name"] for column in inspect(db.engine).get_columns("admin_users")
    }
    order_columns = {
        column["name"] for column in inspect(db.engine).get_columns("simulated_orders")
    }
    item_columns = {
        column["name"] for column in inspect(db.engine).get_columns("simulated_order_items")
    }
    with db.engine.begin() as connection:
        for column, definition in (
            ("cpf_hash", "VARCHAR(64)"),
            ("cpf_last4", "VARCHAR(4)"),
            ("display_name", "VARCHAR(120)"),
        ):
            if column not in admin_columns:
                connection.execute(text(
                    f"ALTER TABLE admin_users ADD COLUMN {column} {definition}"
                ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_admin_users_cpf_hash "
            "ON admin_users (cpf_hash)"
        ))
        for column, definition in (
            ("customer_id", "INTEGER"),
            ("original_subtotal", "NUMERIC(10, 2) NOT NULL DEFAULT 0"),
            ("discount_total", "NUMERIC(10, 2) NOT NULL DEFAULT 0"),
            ("delivery_requested", "BOOLEAN NOT NULL DEFAULT 0"),
        ):
            if column not in order_columns:
                connection.execute(text(
                    f"ALTER TABLE simulated_orders ADD COLUMN {column} {definition}"
                ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_simulated_orders_customer_id "
            "ON simulated_orders (customer_id)"
        ))
        connection.execute(text(
            "UPDATE simulated_orders SET original_subtotal = subtotal "
            "WHERE original_subtotal = 0"
        ))
        for column, definition in (
            ("discounted_unit_price", "NUMERIC(10, 2) NOT NULL DEFAULT 0"),
            ("discount_percent", "INTEGER NOT NULL DEFAULT 0"),
        ):
            if column not in item_columns:
                connection.execute(text(
                    f"ALTER TABLE simulated_order_items ADD COLUMN {column} {definition}"
                ))
        connection.execute(text(
            "UPDATE simulated_order_items SET discounted_unit_price = unit_price "
            "WHERE discounted_unit_price = 0"
        ))


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    origins = app.config.get("CORS_ORIGINS")
    if isinstance(origins, (list, tuple)):
        origins = ",".join(origins)
    app.config["CORS_ORIGINS"] = _parse_cors_origins(origins)

    storage_uri = app.config.get("RATELIMIT_STORAGE_URI")
    storage = urlsplit(storage_uri) if isinstance(storage_uri, str) else None
    if (
        storage is None
        or not storage_uri.strip()
        or not app.testing
        and (storage.scheme not in {"redis", "rediss"} or not storage.netloc)
    ):
        raise ValueError(
            "RATELIMIT_STORAGE_URI deve apontar para Redis fora dos testes."
        )

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["CORS_ORIGINS"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
                "max_age": 600,
            }
        },
        supports_credentials=False,
    )
    limiter.init_app(app)
    db.init_app(app)

    app.extensions["gemini_service"] = GeminiService(
        api_key=config_class.GEMINI_API_KEY,
        model_name=config_class.GEMINI_MODEL,
    )

    app.register_blueprint(catalog_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(branches_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(settings_bp)

    @app.errorhandler(RateLimitExceeded)
    def handle_rate_limit_exceeded(_error: RateLimitExceeded):
        return {"error": "Limite de requisições excedido. Tente novamente mais tarde."}, 429

    @app.errorhandler(413)
    def handle_request_too_large(_error):
        return {"error": "O corpo da requisição excede o tamanho permitido."}, 413

    with app.app_context():
        db.create_all()
        _migrate_account_and_order_columns()
        if "is_active" not in {column["name"] for column in inspect(db.engine).get_columns("products")}:
            with db.engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
                ))
        _migrate_product_categories()
        _migrate_chat_message_timestamps()
        username = app.config.get("ADMIN_BOOTSTRAP_USERNAME", "").strip().lower()
        password = app.config.get("ADMIN_BOOTSTRAP_PASSWORD", "")
        if bool(username) != bool(password):
            raise ValueError("Configure ADMIN_USERNAME e ADMIN_PASSWORD juntos para criar o administrador inicial.")
        has_admins = db.session.query(AdminUser.id).first() is not None
        token_secret = app.config.get("ADMIN_TOKEN_SECRET", "")
        if (has_admins or username) and (not isinstance(token_secret, str) or len(token_secret) < 32):
            raise ValueError("ADMIN_TOKEN_SECRET deve ter ao menos 32 caracteres para habilitar o painel.")
        if username and db.session.query(AdminUser.id).filter_by(username=username).first() is None:
            if len(username) > 80 or len(password) < 12:
                raise ValueError("ADMIN_USERNAME deve ter até 80 caracteres e ADMIN_PASSWORD ao menos 12.")
            user = AdminUser(username=username)
            user.password_hash = generate_password_hash(password)
            db.session.add(user)
            db.session.commit()
        if db.session.get(StoreSetting, 1) is None:
            db.session.add(StoreSetting(id=1, club_discount_percent=10))
            db.session.commit()
        seed_if_empty()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
