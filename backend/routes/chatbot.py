import unicodedata
from uuid import UUID

import httpx
from flask import Blueprint, current_app, jsonify, request
from google.genai import errors, types

from extensions import limiter
from models import ChatMessage, Product, db
from services.chat_tools import buscar_produto, consultar_carrinho

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api/chat")


@chatbot_bp.post("")
@limiter.limit(lambda: current_app.config["CHAT_RATE_LIMIT"])
def ask():
    if not request.is_json:
        return jsonify({"error": "O corpo da requisição deve ser um objeto JSON"}), 400
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "O corpo da requisição deve ser um objeto JSON"}), 400
    message = payload.get("message")
    if not isinstance(message, str):
        return jsonify({"error": "Campo 'message' é obrigatório"}), 400
    question = unicodedata.normalize("NFC", message).strip()
    if not question:
        return jsonify({"error": "Campo 'message' é obrigatório"}), 400
    if len(question) > current_app.config["MAX_CHAT_MESSAGE_LENGTH"]:
        return jsonify({"error": "A mensagem excede o tamanho máximo permitido"}), 400

    session_id = payload.get("session_id")
    if (
        not isinstance(session_id, str)
        or len(session_id) != 36
    ):
        return jsonify({"error": "Campo 'session_id' deve ser um UUID válido"}), 400
    try:
        if str(UUID(session_id)) != session_id.lower():
            raise ValueError("UUID não canônico")
    except ValueError:
        return jsonify({"error": "Campo 'session_id' deve ser um UUID válido"}), 400

    catalog = [p.to_dict() for p in Product.query.filter_by(is_active=True).all()]
    requested_cart = payload.get("cart", [])
    if not isinstance(requested_cart, list) or len(requested_cart) > 30:
        return jsonify({"error": "O carrinho deve ser uma lista com até 30 produtos"}), 400

    quantities = {}
    for item in requested_cart:
        if not isinstance(item, dict):
            return jsonify({"error": "Item inválido no carrinho"}), 400
        product_id = item.get("product_id")
        quantity = item.get("quantity")
        if (
            not isinstance(product_id, str)
            or not product_id
            or type(quantity) is not int
            or not 1 <= quantity <= 999
        ):
            return jsonify({"error": "Produto ou quantidade inválida no carrinho"}), 400
        quantities[product_id] = quantities.get(product_id, 0) + quantity

    products_by_id = {
        product.id: product
        for product in Product.query.filter(
            Product.id.in_(quantities),
            Product.is_active.is_(True),
        ).all()
    } if quantities else {}
    missing_ids = set(quantities) - products_by_id.keys()
    if missing_ids:
        return jsonify({"error": "O carrinho contém produtos que não existem no catálogo"}), 400

    cart = []
    subtotal = 0
    for product_id, quantity in quantities.items():
        product = products_by_id[product_id].to_dict()
        line_total = round(product["price"] * quantity, 2)
        subtotal += line_total
        cart.append({
            "product_id": product_id,
            "name": product["name"],
            "brand": product["brand"],
            "quantity": quantity,
            "unit": product["unit"],
            "unit_price": product["price"],
            "line_total": line_total,
            "stock": product["stock"],
            "allergens": product["allergens"],
        })
    cart_context = {"items": cart, "subtotal": round(subtotal, 2)}

    history = [
        types.Content(
            role=message.role,
            parts=[types.Part.from_text(text=message.content)],
        )
        for message in ChatMessage.query.filter_by(session_id=session_id)
        .order_by(ChatMessage.id)
        .all()
    ]
    gemini = current_app.extensions["gemini_service"]
    tool_functions = {
        "buscar_produto": buscar_produto,
        "consultar_carrinho": lambda: consultar_carrinho(cart_context),
    }

    try:
        text = gemini.answer(question, history, tool_functions)
    except errors.ClientError as error:
        if error.code == 429:
            current_app.logger.exception("Limite de requisições ou quota do Gemini excedida")
        else:
            current_app.logger.exception("Erro do cliente da API do Gemini")
        return jsonify({
            "status": "erro",
            "mensagem": "Assistente temporariamente indisponível. Tente em instantes.",
        }), 503
    except (httpx.NetworkError, httpx.TimeoutException, errors.ServerError):
        current_app.logger.exception("Falha de conexão ou timeout ao consultar o Gemini")
        return jsonify({
            "status": "erro",
            "mensagem": "Assistente temporariamente indisponível. Tente em instantes.",
        }), 503
    except Exception:
        current_app.logger.exception("Falha inesperada ao consultar o Gemini")
        return jsonify({
            "status": "erro",
            "mensagem": "Assistente temporariamente indisponível. Tente em instantes.",
        }), 503

    db.session.add_all(
        [
            ChatMessage(session_id=session_id, role="user", content=question),
            ChatMessage(session_id=session_id, role="model", content=text),
        ]
    )
    db.session.commit()

    answer = text.lower()
    suggested = [
        product
        for product in catalog
        if product["stock"] > 0 and product["name"].lower() in answer
    ][:3]
    return jsonify({
        "text": text,
        "products": suggested,
        "product": suggested[0] if suggested else None,
    })
