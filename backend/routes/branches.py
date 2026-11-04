from flask import Blueprint, jsonify

from models import Product
from services.branches import demo_branch_availability

branches_bp = Blueprint("branches", __name__, url_prefix="/api/branches")


@branches_bp.get("/<product_id>")
def product_branches(product_id: str):
    product = Product.query.filter_by(id=product_id, is_active=True).first()
    if product is None:
        return jsonify({"error": "Produto não encontrado."}), 404
    return jsonify({
        "demo": True,
        "product_id": product.id,
        "product_name": product.name,
        "branches": demo_branch_availability(product.id),
    })
