"""Valida solicitações de chat e devolve respostas e erros em JSON.

Recebe mensagens, sessão e carrinho; retorna texto, produtos sugeridos ou erro.
"""
import unicodedata
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from flask import Blueprint, current_app, jsonify, request
from google.genai import errors, types
from sqlalchemy import or_

from extensions import limiter
from models import ChatMessage, Product, db
from services.chat_provider import ChatProvider
from services.chat_tools import buscar_produto, consultar_carrinho

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api/chat")


def _build_cart_context(requested_cart: object) -> dict | str:
    if not isinstance(requested_cart, list) or len(requested_cart) > 30:
        return "O carrinho deve ser uma lista com até 30 produtos"

    quantities = {}
    for item in requested_cart:
        if not isinstance(item, dict):
            return "Item inválido no carrinho"
        product_id = item.get("product_id")
        quantity = item.get("quantity")
        if (
            not isinstance(product_id, str)
            or not product_id
            or type(quantity) is not int
            or not 1 <= quantity <= 999
        ):
            return "Produto ou quantidade inválida no carrinho"
        quantities[product_id] = quantities.get(product_id, 0) + quantity

    products_by_id = {
        product.id: product
        for product in Product.query.filter(
            Product.id.in_(quantities),
            Product.is_active.is_(True),
        ).all()
    } if quantities else {}
    if set(quantities) - products_by_id.keys():
        return "O carrinho contém produtos que não existem no catálogo"

    items = []
    subtotal = 0
    for product_id, quantity in quantities.items():
        product = products_by_id[product_id].to_dict()
        line_total = round(product["price"] * quantity, 2)
        subtotal += line_total
        items.append({
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
    return {"items": items, "subtotal": round(subtotal, 2)}


def _expire_chat_history() -> None:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        hours=current_app.config["CHAT_HISTORY_RETENTION_HOURS"]
    )
    ChatMessage.query.filter(
        or_(ChatMessage.created_at.is_(None), ChatMessage.created_at < cutoff)
    ).delete(synchronize_session=False)
    db.session.commit()


def _load_chat_history(session_id: str) -> list[types.Content]:
    messages = (
        ChatMessage.query.filter_by(session_id=session_id)
        .order_by(ChatMessage.id.desc())
        .limit(current_app.config["CHAT_HISTORY_LIMIT"])
        .all()
    )
    messages.reverse()
    return [
        types.Content(
            role=message.role,
            parts=[types.Part.from_text(text=message.content)],
        )
        for message in messages
    ]


def _answer_with_gemini(
    question: str,
    history: list[types.Content],
    cart_context: dict,
    searched_product_ids: list[str],
) -> str | None:
    gemini: ChatProvider = current_app.extensions["gemini_service"]

    def search_products(term: str) -> list[dict]:
        products = buscar_produto(term)
        searched_product_ids.extend(
            product["id"] for product in products if isinstance(product.get("id"), str)
        )
        return products

    tool_functions = {
        "buscar_produto": search_products,
        "consultar_carrinho": lambda: consultar_carrinho(cart_context),
    }

    try:
        return gemini.answer(question, history, tool_functions)
    except errors.ClientError as error:
        if error.code == 429:
            current_app.logger.exception("Limite de requisições ou quota do Gemini excedida")
        else:
            current_app.logger.exception("Erro do cliente da API do Gemini")
    except (httpx.NetworkError, httpx.TimeoutException, errors.ServerError):
        current_app.logger.exception("Falha de conexão ou timeout ao consultar o Gemini")
    except Exception:
        current_app.logger.exception("Falha inesperada ao consultar o Gemini")
    return None


def _suggest_products(catalog: list[dict], searched_product_ids: list[str]) -> list[dict]:
    products_by_id = {product["id"]: product for product in catalog}
    suggestions = []
    for product_id in dict.fromkeys(searched_product_ids):
        product = products_by_id.get(product_id)
        if product and product["stock"] > 0:
            suggestions.append(product)
        if len(suggestions) == 3:
            break
    return suggestions


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

    catalog = [product.to_dict() for product in Product.query.filter_by(is_active=True).all()]
    cart_context = _build_cart_context(payload.get("cart", []))
    if isinstance(cart_context, str):
        return jsonify({"error": cart_context}), 400

    _expire_chat_history()
    history = _load_chat_history(session_id)
    searched_product_ids: list[str] = []
    text = _answer_with_gemini(question, history, cart_context, searched_product_ids)
    if text is None:
        return jsonify({
            "status": "erro",
            "mensagem": (
                "Assistente temporariamente indisponível. Tente em instantes. "
                "Muito obrigado por testar -_-"
            ),
        }), 503

    db.session.add_all(
        [
            ChatMessage(session_id=session_id, role="user", content=question),
            ChatMessage(session_id=session_id, role="model", content=text),
        ]
    )
    db.session.commit()

    suggested = _suggest_products(catalog, searched_product_ids)
    return jsonify({
        "text": text,
        "products": suggested,
        "product": suggested[0] if suggested else None,
    })
