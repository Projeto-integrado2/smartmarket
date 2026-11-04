from flask import Blueprint, current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from extensions import limiter
from models import AdminUser, CustomerAccount, SimulatedOrder, db
from services.auth import (
    access_token_serializer,
    cpf_digest,
    create_access_token,
    normalize_cpf,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
MIN_PIN_LENGTH = 6
MAX_ADDRESS_LENGTH = 300


def _error(message: str, status: int):
    return jsonify({"error": message}), status


def _payload() -> dict | None:
    if not request.is_json:
        return None
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else None


def _find_account(digest: str):
    admin = AdminUser.query.filter_by(cpf_hash=digest, is_active=True).first()
    if admin is not None:
        return "admin", admin
    customer = CustomerAccount.query.filter_by(cpf_hash=digest, is_active=True).first()
    if customer is not None:
        return "customer", customer
    return None, None


@auth_bp.post("/lookup")
@limiter.limit("10 per minute")
def lookup_cpf():
    payload = _payload()
    cpf = normalize_cpf(payload.get("cpf")) if payload else None
    if cpf is None:
        return _error("Informe um CPF válido.", 400)
    try:
        _role, account = _find_account(cpf_digest(cpf))
    except RuntimeError:
        current_app.logger.exception("Segredo de autenticação inválido")
        return _error("Autenticação não configurada.", 503)
    if account is None:
        return _error("Cadastro não encontrado.", 404)
    return jsonify({"requires_pin": True})


@auth_bp.post("/login")
@limiter.limit("5 per minute")
def login_with_cpf():
    payload = _payload()
    cpf = normalize_cpf(payload.get("cpf")) if payload else None
    pin = payload.get("pin") if payload else None
    if cpf is None or not isinstance(pin, str) or not pin.isdigit() or len(pin) != MIN_PIN_LENGTH:
        return _error("CPF ou PIN inválido.", 400)
    try:
        role, account = _find_account(cpf_digest(cpf))
    except RuntimeError:
        current_app.logger.exception("Segredo de autenticação inválido")
        return _error("Autenticação não configurada.", 503)
    if account is None:
        return _error("CPF ou PIN inválido.", 401)

    valid_pin = (
        account.check_password(pin)
        if role == "admin"
        else account.check_pin(pin)
    )
    if not valid_pin:
        return _error("CPF ou PIN inválido.", 401)

    try:
        name = account.display_name or account.username if role == "admin" else account.name
        token = create_access_token(account.id, role, name)
    except RuntimeError:
        current_app.logger.exception("Configuração do token inválido")
        return _error("Autenticação não configurada.", 503)
    user = {"name": name, "role": role}
    if role == "customer":
        user.update({"age": account.age, "address": account.address})
    return jsonify({
        "token": token,
        "expires_in": current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
        "user": user,
    })


@auth_bp.post("/register")
@limiter.limit("5 per minute")
def register_customer():
    payload = _payload()
    if payload is None:
        return _error("O corpo da requisição deve ser um objeto JSON.", 400)

    cpf = normalize_cpf(payload.get("cpf"))
    name = payload.get("name")
    age = payload.get("age")
    address = payload.get("address")
    pin = payload.get("pin")
    if cpf is None:
        return _error("Informe um CPF válido.", 400)
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        return _error("Informe um nome válido.", 400)
    if type(age) is not int or not 0 <= age <= 120:
        return _error("A idade deve ser um número entre 0 e 120.", 400)
    if not isinstance(address, str) or not address.strip() or len(address.strip()) > MAX_ADDRESS_LENGTH:
        return _error("Informe um endereço válido.", 400)
    if not isinstance(pin, str) or not pin.isdigit() or len(pin) != MIN_PIN_LENGTH:
        return _error("O PIN deve conter exatamente 6 dígitos.", 400)

    try:
        digest = cpf_digest(cpf)
        access_token_serializer()
    except RuntimeError:
        current_app.logger.exception("Segredo de autenticação inválido")
        return _error("Autenticação não configurada.", 503)
    if AdminUser.query.filter_by(cpf_hash=digest).first() is not None:
        return _error("Não foi possível criar o cadastro com os dados informados.", 409)

    customer = CustomerAccount(
        cpf_hash=digest,
        name=name.strip(),
        age=age,
        address=address.strip(),
        pin_hash=generate_password_hash(pin),
    )
    try:
        db.session.add(customer)
        db.session.flush()
        token = create_access_token(customer.id, "customer", customer.name)
        db.session.commit()
    except (IntegrityError, RuntimeError):
        db.session.rollback()
        current_app.logger.exception("Falha ao criar cadastro de cliente")
        return _error("Não foi possível criar o cadastro. Confira os dados e tente novamente.", 409)

    return jsonify({
        "token": token,
        "expires_in": current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
        "user": {
            "name": customer.name,
            "age": customer.age,
            "address": customer.address,
            "role": "customer",
        },
    }), 201


@auth_bp.get("/me")
def current_user():
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token:
        return _error("Autenticação necessária.", 401)
    try:
        claims = access_token_serializer().loads(
            token,
            max_age=current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
        )
    except SignatureExpired:
        return _error("A sessão expirou. Entre novamente.", 401)
    except BadSignature:
        return _error("Token inválido.", 401)
    except RuntimeError:
        current_app.logger.exception("Configuração do token inválido")
        return _error("Autenticação não configurada.", 503)

    role = claims.get("role")
    account_id = claims.get("sub")
    if role == "admin":
        account = db.session.get(AdminUser, account_id)
        if account is None or not account.is_active:
            return _error("Usuário administrativo inválido.", 401)
        name = account.display_name or account.username
        return jsonify({"name": name, "role": "admin"})
    if role == "customer":
        account = db.session.get(CustomerAccount, account_id)
        if account is None or not account.is_active:
            return _error("Usuário inválido.", 401)
        return jsonify({
            "name": account.name,
            "age": account.age,
            "address": account.address,
            "role": "customer",
        })
    return _error("Token inválido.", 401)


@auth_bp.delete("/me")
def delete_customer_account():
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token:
        return _error("Autenticação necessária.", 401)
    try:
        claims = access_token_serializer().loads(
            token,
            max_age=current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
        )
    except SignatureExpired:
        return _error("A sessão expirou. Entre novamente.", 401)
    except BadSignature:
        return _error("Token inválido.", 401)
    except RuntimeError:
        current_app.logger.exception("Configuração do token inválido")
        return _error("Autenticação não configurada.", 503)

    if not isinstance(claims, dict) or claims.get("role") != "customer":
        return _error("Somente clientes podem excluir o próprio cadastro.", 403)
    customer = db.session.get(CustomerAccount, claims.get("sub"))
    if customer is None:
        return _error("Cadastro não encontrado.", 404)
    SimulatedOrder.query.filter_by(customer_id=customer.id).update(
        {"customer_id": None},
        synchronize_session=False,
    )
    db.session.delete(customer)
    db.session.commit()
    return jsonify({"status": "deleted"})
