from .catalog import catalog_bp
from .categories import categories_bp
from .admin import admin_bp
from .chatbot import chatbot_bp
from .orders import orders_bp

__all__ = ["admin_bp", "catalog_bp", "categories_bp", "chatbot_bp", "orders_bp"]
