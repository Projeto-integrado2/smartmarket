from urllib.parse import urlsplit

from flask import Flask
from flask_cors import CORS
from flask_limiter.errors import RateLimitExceeded
from sqlalchemy import inspect, text
from werkzeug.security import generate_password_hash

from config import Config, _parse_cors_origins
from extensions import limiter
from models import AdminUser, db
from routes import admin_bp, catalog_bp, chatbot_bp
from seed import seed_if_empty
from services import GeminiService


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
                "methods": ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
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
    app.register_blueprint(admin_bp)
    app.register_blueprint(chatbot_bp)

    @app.errorhandler(RateLimitExceeded)
    def handle_rate_limit_exceeded(_error: RateLimitExceeded):
        return {"error": "Limite de requisições excedido. Tente novamente mais tarde."}, 429

    @app.errorhandler(413)
    def handle_request_too_large(_error):
        return {"error": "O corpo da requisição excede o tamanho permitido."}, 413

    with app.app_context():
        db.create_all()
        if "is_active" not in {column["name"] for column in inspect(db.engine).get_columns("products")}:
            with db.engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
                ))
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
        seed_if_empty()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
