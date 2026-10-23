from flask import Blueprint, jsonify, request

from models import Product

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api/products")


@catalog_bp.get("")
def list_products():
    query = Product.query.filter_by(is_active=True)
    category = request.args.get("category")
    if category and category != "Todos":
        query = query.filter(Product.category == category)

    term = request.args.get("q", "").strip().lower()
    products = [p.to_dict() for p in query.order_by(Product.name).all()]
    if term:
        products = [
            p for p in products
            if term in f"{p['name']} {p['brand']} {p['category']}".lower()
        ]
    return jsonify(products)


@catalog_bp.get("/<product_id>")
def get_product(product_id: str):
    product = Product.query.filter_by(id=product_id, is_active=True).first()
    if product is None:
        return jsonify({"error": "Produto não encontrado"}), 404
    return jsonify(product.to_dict())
