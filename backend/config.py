import os
import re
from urllib.parse import urlsplit

from dotenv import load_dotenv

load_dotenv()


def _parse_cors_origins(value: str | None) -> list[str]:
    if not value:
        raise ValueError("CORS_ORIGINS deve declarar explicitamente as origens permitidas.")

    origins = value.split(",")
    if any(not origin.strip() for origin in origins):
        raise ValueError("CORS_ORIGINS contém uma origem vazia.")

    validated = []
    for entry in origins:
        origin = entry.strip()
        parsed = urlsplit(origin)
        hostname = parsed.hostname
        try:
            port = parsed.port
        except ValueError as error:
            raise ValueError(f"Origem inválida em CORS_ORIGINS: {origin}") from error

        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or hostname is None
            or hostname == "*"
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
            or (port is not None and not 1 <= port <= 65535)
            or not re.fullmatch(r"[A-Za-z0-9.-]+", hostname)
            or any(
                not label or label.startswith("-") or label.endswith("-")
                for label in hostname.split(".")
            )
        ):
            raise ValueError(f"Origem inválida em CORS_ORIGINS: {origin}")
        validated.append(origin)

    if len(set(validated)) != len(validated):
        raise ValueError("CORS_ORIGINS não pode repetir origens.")
    return validated


class Config:
    """Carrega as variáveis do .env e monta a conexão com o banco."""

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    DB_PATH = os.getenv("DB_PATH", os.path.join(BASE_DIR, "data", "smartmarket.db"))
    DB_DIRECTORY = os.path.dirname(DB_PATH)
    if DB_DIRECTORY:
        os.makedirs(DB_DIRECTORY, exist_ok=True)

    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    CORS_ORIGINS = _parse_cors_origins(os.getenv("CORS_ORIGINS"))
    RATELIMIT_STORAGE_URI = os.getenv(
        "RATELIMIT_STORAGE_URI",
        "redis://localhost:6379/0",
    )
    CHAT_RATE_LIMIT = os.getenv("CHAT_RATE_LIMIT", "10 per minute; 60 per hour")
    ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "")
    ADMIN_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60
    ADMIN_BOOTSTRAP_USERNAME = os.getenv("ADMIN_USERNAME", "")
    ADMIN_BOOTSTRAP_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
    MAX_CONTENT_LENGTH = 32 * 1024
    MAX_CHAT_MESSAGE_LENGTH = 2000
