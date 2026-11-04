import hashlib
import hmac
import re

from flask import current_app
from itsdangerous import URLSafeTimedSerializer


def normalize_cpf(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) != 11 or len(set(digits)) == 1:
        return None

    for length in (9, 10):
        checksum = sum(
            int(digit) * weight
            for digit, weight in zip(digits[:length], range(length + 1, 1, -1))
        )
        digit = (checksum * 10) % 11
        if digit == 10:
            digit = 0
        if digit != int(digits[length]):
            return None
    return digits


def cpf_digest(cpf_digits: str) -> str:
    secret = current_app.config.get("CUSTOMER_CPF_SECRET") or current_app.config.get(
        "ADMIN_TOKEN_SECRET"
    )
    if not isinstance(secret, str) or len(secret) < 32:
        raise RuntimeError("Configure um segredo de pelo menos 32 caracteres para autenticação.")
    return hmac.new(
        secret.encode("utf-8"),
        f"smartmarket-cpf:{cpf_digits}".encode("ascii"),
        hashlib.sha256,
    ).hexdigest()


def access_token_serializer() -> URLSafeTimedSerializer:
    secret = current_app.config.get("ADMIN_TOKEN_SECRET")
    if not isinstance(secret, str) or len(secret) < 32:
        raise RuntimeError("ADMIN_TOKEN_SECRET deve ter ao menos 32 caracteres.")
    return URLSafeTimedSerializer(secret, salt="smartmarket-admin-v1")


def create_access_token(subject: int, role: str, name: str) -> str:
    return access_token_serializer().dumps(
        {"sub": subject, "role": role, "name": name}
    )


def load_access_token(token: str) -> dict:
    claims = access_token_serializer().loads(
        token,
        max_age=current_app.config["ADMIN_TOKEN_MAX_AGE_SECONDS"],
    )
    if not isinstance(claims, dict):
        raise ValueError("Token inválido.")
    return claims
