from flask import Blueprint, jsonify

from categories import PRODUCT_CATEGORIES

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@categories_bp.get("")
def list_categories():
    return jsonify(list(PRODUCT_CATEGORIES))
