from .catalog import catalog_bp
from .categories import categories_bp
from .admin import admin_bp
from .chatbot import chatbot_bp
from .orders import orders_bp
from .auth import auth_bp
from .branches import branches_bp
from .settings import settings_bp

__all__ = [
    "admin_bp",
    "auth_bp",
    "branches_bp",
    "catalog_bp",
    "categories_bp",
    "chatbot_bp",
    "orders_bp",
    "settings_bp",
]
