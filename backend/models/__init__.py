from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .product import Product  # noqa: E402,F401
from .chat_message import ChatMessage  # noqa: E402,F401
from .admin_user import AdminUser  # noqa: E402,F401
from .customer_account import CustomerAccount  # noqa: E402,F401
from .simulated_order import SimulatedOrder, SimulatedOrderItem  # noqa: E402,F401
from .store_setting import StoreSetting  # noqa: E402,F401

__all__ = [
    "db",
    "AdminUser",
    "ChatMessage",
    "CustomerAccount",
    "Product",
    "SimulatedOrder",
    "SimulatedOrderItem",
    "StoreSetting",
]
