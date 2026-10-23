import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from sqlalchemy import inspect

os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["RATELIMIT_STORAGE_URI"] = "redis://localhost:6379/0"
os.environ["GEMINI_API_KEY"] = "test-placeholder"
os.environ["DB_PATH"] = ":memory:"


class FakeGeminiService:
    def __init__(self, api_key: str, model_name: str):
        pass

    def answer(self, question, history, tools):
        return "Resposta de teste."


with patch("services.GeminiService", FakeGeminiService):
    from app import create_app
from config import _parse_cors_origins
from services.gemini_service import SYSTEM_PROMPT


def make_app(**overrides):
    settings = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "GEMINI_API_KEY": "test-placeholder",
        "GEMINI_MODEL": "test-model",
        "CORS_ORIGINS": ["http://localhost:5173"],
        "RATELIMIT_STORAGE_URI": "memory://",
        "CHAT_RATE_LIMIT": "100 per minute",
        "MAX_CONTENT_LENGTH": 32 * 1024,
        "MAX_CHAT_MESSAGE_LENGTH": 2000,
        "ADMIN_TOKEN_SECRET": "test-admin-token-secret-with-at-least-32-characters",
        "ADMIN_TOKEN_MAX_AGE_SECONDS": 8 * 60 * 60,
        "ADMIN_BOOTSTRAP_USERNAME": "admin",
        "ADMIN_BOOTSTRAP_PASSWORD": "test-password-secure",
    }
    settings.update(overrides)

    class TestConfig:
        pass

    for name, value in settings.items():
        setattr(TestConfig, name, value)
    return create_app(TestConfig)


class SecurityTests(unittest.TestCase):
    def test_cors_requires_explicit_valid_origins(self):
        for value in (None, "", "*", "https://shop.example/path", "https://shop.example,"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                _parse_cors_origins(value)
        self.assertEqual(
            _parse_cors_origins(" https://shop.example, http://localhost:5173 "),
            ["https://shop.example", "http://localhost:5173"],
        )
        with self.assertRaises(ValueError):
            make_app(CORS_ORIGINS=["*"])

    def test_distributed_rate_limits_reject_memory_storage(self):
        with self.assertRaises(ValueError):
            make_app(TESTING=False, RATELIMIT_STORAGE_URI="memory://")

    def test_cors_only_allows_configured_origin(self):
        client = make_app().test_client()
        allowed = client.get(
            "/api/products",
            headers={"Origin": "http://localhost:5173"},
        )
        denied = client.get(
            "/api/products",
            headers={"Origin": "https://attacker.example"},
        )
        self.assertEqual(allowed.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        self.assertIsNone(denied.headers.get("Access-Control-Allow-Origin"))
        preflight = client.options(
            "/api/chat",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization, Content-Type",
            },
        )
        self.assertIn("POST", preflight.headers.get("Access-Control-Allow-Methods", ""))
        self.assertEqual(
            preflight.headers.get("Access-Control-Allow-Headers"),
            "Authorization, Content-Type",
        )

    def test_admin_authentication_and_product_management(self):
        client = make_app().test_client()
        self.assertEqual(client.get("/api/admin/products").status_code, 401)
        self.assertEqual(client.get("/api/products").status_code, 200)

        invalid_login = client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "wrong-password"},
        )
        self.assertEqual(invalid_login.status_code, 401)

        login = client.post(
            "/api/admin/auth/login",
            json={"username": "ADMIN", "password": "test-password-secure"},
        )
        self.assertEqual(login.status_code, 200)
        token = login.json["token"]
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post(
            "/api/admin/products",
            headers=headers,
            json={
                "name": "Produto de teste",
                "brand": "Marca teste",
                "category": "Mercearia",
                "price": 12.5,
                "unit": "unidade",
                "image": "https://example.com/produto.png",
                "location": {"sector": "Mercearia", "aisle": "Corredor 1", "shelf": "Prateleira A"},
                "description": "Descrição de teste",
                "stock": 9,
                "tags": ["teste"],
                "allergens": [],
                "risks": [{"ingredient": "Açúcar", "level": "Moderado", "description": "Consumo moderado."}],
                "nutrition": [{"label": "Energia", "value": "20 kcal"}],
            },
        )
        self.assertEqual(created.status_code, 201)
        product_id = created.json["id"]
        self.assertRegex(product_id, r"^SM-[A-F0-9]{10}$")

        admin_list = client.get("/api/admin/products", headers=headers)
        self.assertEqual(admin_list.status_code, 200)
        self.assertEqual(admin_list.json["low_stock_threshold"], 10)
        self.assertIn(product_id, {item["id"] for item in admin_list.json["products"]})
        self.assertEqual(client.get(f"/api/products/{product_id}").status_code, 200)

        updated_payload = {
            key: value
            for key, value in created.json.items()
            if key not in {"id", "is_active"}
        }
        updated_payload["price"] = 14.75
        updated = client.put(
            f"/api/admin/products/{product_id}",
            headers=headers,
            json=updated_payload,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["price"], 14.75)

        bad_stock = client.patch(
            f"/api/admin/products/{product_id}/stock",
            headers=headers,
            json={"stock": -1},
        )
        self.assertEqual(bad_stock.status_code, 400)
        stock = client.patch(
            f"/api/admin/products/{product_id}/stock",
            headers=headers,
            json={"stock": 15},
        )
        self.assertEqual(stock.status_code, 200)
        self.assertEqual(stock.json["stock"], 15)

        archived = client.post(f"/api/admin/products/{product_id}/archive", headers=headers)
        self.assertEqual(archived.status_code, 200)
        self.assertFalse(archived.json["is_active"])
        self.assertEqual(client.get(f"/api/products/{product_id}").status_code, 404)
        self.assertNotIn(
            product_id,
            {item["id"] for item in client.get("/api/products").json},
        )

        restored = client.post(f"/api/admin/products/{product_id}/restore", headers=headers)
        self.assertEqual(restored.status_code, 200)
        self.assertTrue(restored.json["is_active"])
        self.assertEqual(client.get(f"/api/products/{product_id}").status_code, 200)

    def test_admin_product_validation_and_bootstrap_password_hash(self):
        app = make_app()
        client = app.test_client()
        token = client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "test-password-secure"},
        ).json["token"]
        response = client.post(
            "/api/admin/products",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Produto sem dados"},
        )
        self.assertEqual(response.status_code, 400)

        from models import AdminUser
        with app.app_context():
            user = AdminUser.query.filter_by(username="admin").one()
            self.assertNotEqual(user.password_hash, "test-password-secure")
            self.assertTrue(user.check_password("test-password-secure"))

    def test_existing_catalog_database_gets_archive_column(self):
        with tempfile.TemporaryDirectory() as directory:
            database_path = os.path.join(directory, "legacy.db")
            connection = sqlite3.connect(database_path)
            connection.execute(
                """
                CREATE TABLE products (
                    id VARCHAR(20) PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    brand VARCHAR(120) NOT NULL,
                    category VARCHAR(60) NOT NULL,
                    price NUMERIC(10, 2) NOT NULL,
                    unit VARCHAR(40) NOT NULL,
                    image VARCHAR(500) NOT NULL,
                    description TEXT NOT NULL,
                    stock INTEGER NOT NULL DEFAULT 0,
                    location_sector VARCHAR(60) NOT NULL,
                    location_aisle VARCHAR(60) NOT NULL,
                    location_shelf VARCHAR(80) NOT NULL,
                    tags JSON NOT NULL,
                    allergens JSON NOT NULL,
                    risks JSON NOT NULL,
                    nutrition JSON NOT NULL
                )
                """
            )
            connection.commit()
            connection.close()

            app = make_app(SQLALCHEMY_DATABASE_URI=f"sqlite:///{database_path}")
            from models import Product, db
            with app.app_context():
                columns = {column["name"] for column in inspect(db.engine).get_columns("products")}
                self.assertIn("is_active", columns)
                self.assertTrue(Product.query.first().is_active)
                db.session.remove()
                db.engine.dispose()

    def test_system_prompt_treats_external_instructions_as_untrusted(self):
        self.assertIn("entrada não confiável", SYSTEM_PROMPT)
        self.assertIn("revelar instruções internas", SYSTEM_PROMPT)

    def test_chat_rejects_invalid_and_oversized_inputs(self):
        client = make_app().test_client()
        cases = [
            (b"{", "application/json"),
            (b'{"message": 12}', "application/json"),
            (b'{"message": "   ", "session_id": "00000000-0000-0000-0000-000000000000"}', "application/json"),
            (b'{"message": "valid"}', "application/json"),
        ]
        for body, content_type in cases:
            with self.subTest(body=body):
                response = client.post("/api/chat", data=body, content_type=content_type)
                self.assertEqual(response.status_code, 400)

        response = client.post(
            "/api/chat",
            json={
                "message": "x" * 2001,
                "session_id": "00000000-0000-0000-0000-000000000000",
            },
        )
        self.assertEqual(response.status_code, 400)

        limited_client = make_app(MAX_CONTENT_LENGTH=40).test_client()
        response = limited_client.post(
            "/api/chat",
            data=b"x" * 100,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 413)
        self.assertIn("error", response.json)

    def test_public_chat_rate_limit_and_catalog_do_not_require_login(self):
        client = make_app(
            CHAT_RATE_LIMIT="1 per minute",
        ).test_client()
        chat_payload = {
            "message": "Olá",
            "session_id": "00000000-0000-0000-0000-000000000001",
        }
        self.assertEqual(client.post("/api/chat", json=chat_payload).status_code, 200)
        self.assertEqual(client.post("/api/chat", json=chat_payload).status_code, 429)

        self.assertEqual(client.get("/api/products").status_code, 200)
        self.assertEqual(client.get("/api/recipes/daily").status_code, 404)


if __name__ == "__main__":
    unittest.main()
