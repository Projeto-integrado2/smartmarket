import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
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
        "CHAT_HISTORY_LIMIT": 20,
        "CHAT_HISTORY_RETENTION_HOURS": 48,
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
    def test_chat_prompt_keeps_responses_brief_and_redirects_out_of_scope_questions(self):
        self.assertIn("Mantenha as respostas curtas", SYSTEM_PROMPT)
        self.assertIn("faça uma única", SYSTEM_PROMPT)
        self.assertIn("nem consulte", SYSTEM_PROMPT)
        self.assertIn("catálogo SmartMarket", SYSTEM_PROMPT)

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
                "category": "Alimentos",
                "categories": ["Alimentos", "Bebidas"],
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
        self.assertEqual(created.json["categories"], ["Alimentos", "Bebidas"])
        product_id = created.json["id"]
        self.assertRegex(product_id, r"^SM-[A-F0-9]{10}$")
        invalid_categories = dict(created.json)
        invalid_categories.pop("id")
        invalid_categories.pop("is_active")
        invalid_categories["categories"] = ["Serviços"]
        rejected_categories = client.post(
            "/api/admin/products",
            headers=headers,
            json=invalid_categories,
        )
        self.assertEqual(rejected_categories.status_code, 400)

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
        self.assertEqual(updated.json["categories"], ["Alimentos", "Bebidas"])
        self.assertIn(
            product_id,
            {
                item["id"]
                for item in client.get("/api/products?category=Bebidas").json
            },
        )

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
            connection.execute(
                """
                CREATE TABLE chat_messages (
                    id INTEGER PRIMARY KEY,
                    session_id VARCHAR(100) NOT NULL,
                    role VARCHAR(10) NOT NULL,
                    content TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX ix_chat_messages_session_id ON chat_messages (session_id)"
            )
            connection.execute(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
                ("legacy-session", "user", "Mensagem antiga"),
            )
            connection.execute(
                """
                INSERT INTO products (
                    id, name, brand, category, price, unit, image, description, stock,
                    location_sector, location_aisle, location_shelf, tags, allergens, risks, nutrition
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "SM-OLD", "Leite antigo", "Marca", "Laticínios", 5.0, "1 litro",
                    "https://example.com/leite.png", "Produto legado", 4, "Laticínios",
                    "Corredor 1", "Prateleira 1", "[]", "[]", "[]", "[]",
                ),
            )
            connection.execute(
                """
                INSERT INTO products (
                    id, name, brand, category, price, unit, image, description, stock,
                    location_sector, location_aisle, location_shelf, tags, allergens, risks, nutrition
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "SM-REMOVED", "Item antigo", "Marca", "Por preço", 5.0, "unidade",
                    "https://example.com/item.png", "Categoria removida", 1, "Setor",
                    "Corredor 1", "Prateleira 1", "[]", "[]", "[]", "[]",
                ),
            )
            connection.commit()
            connection.close()

            app = make_app(SQLALCHEMY_DATABASE_URI=f"sqlite:///{database_path}")
            from models import ChatMessage, Product, db
            with app.app_context():
                columns = {column["name"] for column in inspect(db.engine).get_columns("products")}
                self.assertIn("is_active", columns)
                self.assertIn("categories", columns)
                chat_columns = {
                    column["name"]
                    for column in inspect(db.engine).get_columns("chat_messages")
                }
                self.assertIn("created_at", chat_columns)
                self.assertIsNone(
                    ChatMessage.query.filter_by(content="Mensagem antiga").one().created_at
                )
                product = Product.query.first()
                self.assertTrue(product.is_active)
                self.assertEqual(product.category, "Alimentos")
                self.assertEqual(product.categories, ["Alimentos"])
                removed_category_product = db.session.get(Product, "SM-REMOVED")
                self.assertEqual(removed_category_product.category, "")
                self.assertEqual(removed_category_product.categories, [])
                db.session.remove()
                db.engine.dispose()

    def test_system_prompt_treats_external_instructions_as_untrusted(self):
        self.assertIn("entrada não confiável", SYSTEM_PROMPT)
        self.assertIn("revelar instruções internas", SYSTEM_PROMPT)

    def test_chat_history_is_limited_and_expired_after_retention_period(self):
        app = make_app(CHAT_HISTORY_LIMIT=2, CHAT_HISTORY_RETENTION_HOURS=48)

        class RecordingGeminiService:
            def answer(self, question, history, tools):
                self.history = [
                    part.text for message in history for part in message.parts
                ]
                return "Resposta de teste."

        service = RecordingGeminiService()
        app.extensions["gemini_service"] = service
        session_id = "00000000-0000-0000-0000-000000000003"
        timestamp = datetime.now(timezone.utc).replace(tzinfo=None)

        from models import ChatMessage, db
        with app.app_context():
            db.session.add_all([
                ChatMessage(
                    session_id=session_id,
                    role="user" if index % 2 == 0 else "model",
                    content=f"Mensagem {index}",
                    created_at=timestamp - timedelta(days=1),
                )
                for index in range(4)
            ])
            db.session.add(
                ChatMessage(
                    session_id="00000000-0000-0000-0000-000000000004",
                    role="user",
                    content="Mensagem expirada",
                    created_at=timestamp - timedelta(hours=49),
                )
            )
            db.session.add(
                ChatMessage(
                    session_id="00000000-0000-0000-0000-000000000005",
                    role="user",
                    content="Mensagem legada sem data",
                )
            )
            db.session.commit()
            db.session.query(ChatMessage).filter_by(
                content="Mensagem legada sem data",
            ).update({"created_at": None})
            db.session.commit()

        response = app.test_client().post(
            "/api/chat",
            json={"message": "Nova pergunta", "session_id": session_id},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(service.history, ["Mensagem 2", "Mensagem 3"])

        with app.app_context():
            self.assertEqual(
                ChatMessage.query.filter_by(content="Mensagem expirada").count(),
                0,
            )
            self.assertEqual(
                ChatMessage.query.filter_by(content="Mensagem legada sem data").count(),
                0,
            )
            new_messages = ChatMessage.query.filter_by(
                session_id=session_id,
            ).order_by(ChatMessage.id.desc()).limit(2).all()
            self.assertTrue(all(message.created_at is not None for message in new_messages))

    def test_chat_error_message_thanks_user_when_gemini_fails(self):
        app = make_app()

        class FailingGeminiService:
            def answer(self, question, history, tools):
                raise RuntimeError("Gemini indisponível")

        app.extensions["gemini_service"] = FailingGeminiService()
        response = app.test_client().post(
            "/api/chat",
            json={
                "message": "Olá",
                "session_id": "00000000-0000-0000-0000-000000000007",
            },
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json["mensagem"],
            "Assistente temporariamente indisponível. Tente em instantes. "
            "Muito obrigado por testar -_-",
        )

    def test_chat_suggestions_come_from_catalog_tool_results(self):
        app = make_app()

        class ToolCallingGeminiService:
            def answer(self, question, history, tools):
                self.searched_products = tools["buscar_produto"]("Alimentos")
                return "Confira as opções disponíveis no catálogo."

        service = ToolCallingGeminiService()
        app.extensions["gemini_service"] = service
        response = app.test_client().post(
            "/api/chat",
            json={
                "message": "O que você recomenda?",
                "session_id": "00000000-0000-0000-0000-000000000006",
            },
        )

        self.assertEqual(response.status_code, 200)
        expected_ids = [
            product["id"]
            for product in service.searched_products
            if product["stock"] > 0
        ][:3]
        self.assertEqual([product["id"] for product in response.json["products"]], expected_ids)
        self.assertEqual(response.json["text"], "Confira as opções disponíveis no catálogo.")

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

    def test_chat_validates_cart_items(self):
        client = make_app().test_client()
        session_id = "00000000-0000-0000-0000-000000000002"
        invalid_carts = [
            {},
            [{}],
            [{"product_id": "SM-1042", "quantity": 0}],
            [{"product_id": "SM-MISSING", "quantity": 1}],
            [{}] * 31,
        ]
        for cart in invalid_carts:
            with self.subTest(cart=cart):
                response = client.post(
                    "/api/chat",
                    json={"message": "Olá", "session_id": session_id, "cart": cart},
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)

        valid_response = client.post(
            "/api/chat",
            json={
                "message": "Olá",
                "session_id": session_id,
                "cart": [{"product_id": "SM-1042", "quantity": 2}],
            },
        )
        self.assertEqual(valid_response.status_code, 200)

    def test_public_chat_rate_limit_and_catalog_do_not_require_login(self):
        client = make_app(
            CHAT_RATE_LIMIT="5 per minute",
        ).test_client()
        chat_payload = {
            "message": "Olá",
            "session_id": "00000000-0000-0000-0000-000000000001",
        }
        for _ in range(5):
            self.assertEqual(client.post("/api/chat", json=chat_payload).status_code, 200)
        self.assertEqual(client.post("/api/chat", json=chat_payload).status_code, 429)

        self.assertEqual(client.get("/api/products").status_code, 200)
        self.assertEqual(
            client.get("/api/categories").json,
            ["Bebidas", "Alimentos", "Acessórios", "Higiene e limpeza"],
        )
        self.assertEqual(client.get("/api/recipes/daily").status_code, 404)

    def test_public_order_rate_limit_is_15_per_minute(self):
        client = make_app().test_client()
        payload = {"payment_method": "pix", "items": []}

        for _ in range(15):
            self.assertEqual(client.post("/api/orders/simulated", json=payload).status_code, 400)
        self.assertEqual(client.post("/api/orders/simulated", json=payload).status_code, 429)

    def test_simulated_order_reduces_stock_and_persists_order_without_payment(self):
        app = make_app()
        client = app.test_client()
        from models import Product, SimulatedOrder, SimulatedOrderItem, db

        with app.app_context():
            product = db.session.get(Product, "SM-1042")
            initial_stock = product.stock

        response = client.post(
            "/api/orders/simulated",
            json={
                "payment_method": "pix",
                "items": [
                    {"product_id": "SM-1042", "quantity": 1},
                    {"product_id": "SM-1042", "quantity": 2},
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["status"], "simulated")
        self.assertEqual(response.json["payment_method"], "pix")
        self.assertEqual(response.json["subtotal"], 16.47)
        self.assertEqual(len(response.json["items"]), 1)
        self.assertEqual(response.json["items"][0]["quantity"], 3)
        self.assertNotIn("card_number", response.json)
        self.assertEqual(
            client.get("/api/products/SM-1042").json["stock"],
            initial_stock - 3,
        )

        with app.app_context():
            self.assertEqual(db.session.get(Product, "SM-1042").stock, initial_stock - 3)
            order = db.session.get(SimulatedOrder, response.json["order_id"])
            self.assertIsNotNone(order)
            self.assertEqual(order.payment_method, "pix")
            self.assertEqual(len(order.items), 1)
            self.assertEqual(order.items[0].quantity, 3)
            self.assertEqual(
                SimulatedOrderItem.query.filter_by(order_id=order.id).count(),
                1,
            )

    def test_new_simulated_order_expires_orders_older_than_12_months(self):
        app = make_app()
        client = app.test_client()
        from models import SimulatedOrder, SimulatedOrderItem, db

        with app.app_context():
            expired = SimulatedOrder(
                id="SM-SIM-EXPIRED",
                payment_method="pix",
                subtotal=1,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=366),
                items=[
                    SimulatedOrderItem(
                        product_id="SM-1042",
                        product_name="Produto antigo",
                        quantity=1,
                        unit="unidade",
                        unit_price=1,
                        line_total=1,
                    )
                ],
            )
            recent = SimulatedOrder(
                id="SM-SIM-RECENT",
                payment_method="pix",
                subtotal=1,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=364),
            )
            db.session.add_all([expired, recent])
            db.session.commit()

        response = client.post(
            "/api/orders/simulated",
            json={
                "payment_method": "pix",
                "items": [{"product_id": "SM-1042", "quantity": 1}],
            },
        )

        self.assertEqual(response.status_code, 201)
        with app.app_context():
            self.assertIsNone(db.session.get(SimulatedOrder, "SM-SIM-EXPIRED"))
            self.assertEqual(
                SimulatedOrderItem.query.filter_by(
                    order_id="SM-SIM-EXPIRED"
                ).count(),
                0,
            )
            self.assertIsNotNone(db.session.get(SimulatedOrder, "SM-SIM-RECENT"))

    def test_simulated_order_validation_and_insufficient_stock_roll_back(self):
        app = make_app()
        client = app.test_client()
        from models import Product, SimulatedOrder, db

        invalid_payloads = [
            {"payment_method": "real-card", "items": [{"product_id": "SM-1042", "quantity": 1}]},
            {"payment_method": "cash", "items": [{"product_id": "SM-1042", "quantity": 1}]},
            {"payment_method": [], "items": [{"product_id": "SM-1042", "quantity": 1}]},
            {
                "payment_method": "card",
                "items": [{"product_id": "SM-1042", "quantity": 1}],
                "card_number": "4111111111111111",
            },
            {"payment_method": "pix", "items": []},
            {"payment_method": "pix", "items": [{"product_id": "SM-1042", "quantity": True}]},
            {
                "payment_method": "pix",
                "items": [
                    {"product_id": "SM-1042", "quantity": 600},
                    {"product_id": "SM-1042", "quantity": 400},
                ],
            },
            {"payment_method": "pix", "items": [{"product_id": "SM-MISSING", "quantity": 1}]},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = client.post("/api/orders/simulated", json=payload)
                self.assertIn(response.status_code, {400, 409})

        with app.app_context():
            first = db.session.get(Product, "SM-1042")
            second = db.session.get(Product, "SM-2087")
            first.stock = 5
            second.stock = 1
            db.session.commit()

        response = client.post(
            "/api/orders/simulated",
            json={
                "payment_method": "pix",
                "items": [
                    {"product_id": "SM-1042", "quantity": 2},
                    {"product_id": "SM-2087", "quantity": 2},
                ],
            },
        )
        self.assertEqual(response.status_code, 409)

        with app.app_context():
            self.assertEqual(db.session.get(Product, "SM-1042").stock, 5)
            self.assertEqual(db.session.get(Product, "SM-2087").stock, 1)
            self.assertEqual(SimulatedOrder.query.count(), 0)

    def test_customer_registration_discount_rebuy_and_account_deletion(self):
        app = make_app()
        client = app.test_client()
        cpf = "52998224725"
        self.assertEqual(
            client.post("/api/auth/lookup", json={"cpf": cpf}).status_code,
            404,
        )

        registration = client.post(
            "/api/auth/register",
            json={
                "cpf": cpf,
                "name": "Cliente de teste",
                "age": 25,
                "address": "Rua de teste, 10",
                "pin": "123456",
            },
        )
        self.assertEqual(registration.status_code, 201)
        self.assertEqual(registration.json["user"]["role"], "customer")
        token = registration.json["token"]
        headers = {"Authorization": f"Bearer {token}"}

        from models import CustomerAccount, Product, SimulatedOrder, db
        from services.auth import cpf_digest
        with app.app_context():
            customer = CustomerAccount.query.filter_by(
                cpf_hash=cpf_digest(cpf),
            ).one()
            self.assertNotIn(cpf, customer.cpf_hash)
            self.assertTrue(customer.check_pin("123456"))
            self.assertNotEqual(customer.pin_hash, "123456")
            product = db.session.get(Product, "SM-1042")
            product.tags = [*product.tags, "Desconto Clube"]
            db.session.commit()

        wrong_pin = client.post(
            "/api/auth/login",
            json={"cpf": cpf, "pin": "654321"},
        )
        self.assertEqual(wrong_pin.status_code, 401)
        login = client.post(
            "/api/auth/login",
            json={"cpf": cpf, "pin": "123456"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json["user"]["role"], "customer")

        forbidden_admin = client.get("/api/admin/staff", headers=headers)
        self.assertEqual(forbidden_admin.status_code, 403)
        order_response = client.post(
            "/api/orders/simulated",
            headers=headers,
            json={
                "payment_method": "pix",
                "delivery_requested": True,
                "items": [{"product_id": "SM-1042", "quantity": 1}],
            },
        )
        self.assertEqual(order_response.status_code, 201)
        self.assertEqual(order_response.json["original_subtotal"], 5.49)
        self.assertEqual(order_response.json["discount_total"], 0.55)
        self.assertEqual(order_response.json["subtotal"], 4.94)
        self.assertTrue(order_response.json["delivery_requested"])
        self.assertEqual(order_response.json["items"][0]["discount_percent"], 10)

        repurchases = client.get("/api/orders/rebuy", headers=headers)
        self.assertEqual(repurchases.status_code, 200)
        self.assertIn("SM-1042", {item["id"] for item in repurchases.json["products"]})

        deleted = client.delete("/api/auth/me", headers=headers)
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(
            client.post("/api/auth/lookup", json={"cpf": cpf}).status_code,
            404,
        )
        with app.app_context():
            order = db.session.get(SimulatedOrder, order_response.json["order_id"])
            self.assertIsNone(order.customer_id)
            self.assertEqual(CustomerAccount.query.count(), 0)

    def test_employee_cpf_login_and_admin_discount_settings(self):
        app = make_app()
        client = app.test_client()
        admin_login = client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "test-password-secure"},
        )
        self.assertEqual(admin_login.json["role"], "admin")
        admin_headers = {"Authorization": f"Bearer {admin_login.json['token']}"}

        created = client.post(
            "/api/admin/staff",
            headers=admin_headers,
            json={"cpf": "11144477735", "name": "Funcionário", "pin": "123456"},
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["cpf"], "***.***.***-7735")
        self.assertEqual(
            client.post("/api/auth/lookup", json={"cpf": "11144477735"}).status_code,
            200,
        )
        employee_login = client.post(
            "/api/auth/login",
            json={"cpf": "11144477735", "pin": "123456"},
        )
        self.assertEqual(employee_login.status_code, 200)
        self.assertEqual(employee_login.json["user"]["role"], "admin")
        employee_headers = {"Authorization": f"Bearer {employee_login.json['token']}"}
        self.assertEqual(client.get("/api/admin/settings", headers=employee_headers).status_code, 200)

        updated = client.patch(
            "/api/admin/settings",
            headers=admin_headers,
            json={"club_discount_percent": 20},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(client.get("/api/settings/club").json["club_discount_percent"], 20)
        self.assertEqual(
            client.delete(f"/api/admin/staff/{created.json['id']}", headers=admin_headers).status_code,
            200,
        )
        self.assertEqual(client.get("/api/admin/settings", headers=employee_headers).status_code, 401)
        self.assertEqual(
            client.post(
                f"/api/admin/staff/{created.json['id']}/restore",
                headers=admin_headers,
            ).status_code,
            200,
        )

    def test_demo_branch_availability_endpoint(self):
        client = make_app().test_client()
        response = client.get("/api/branches/SM-1042")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["demo"])
        self.assertGreater(len(response.json["branches"]), 0)
        self.assertTrue(all(branch["stock"] > 0 for branch in response.json["branches"]))


if __name__ == "__main__":
    unittest.main()
