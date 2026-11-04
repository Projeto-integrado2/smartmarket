from models import Product
from services.branches import demo_branch_availability


def buscar_produto(termo: str) -> list[dict]:
    """Busca produtos no catálogo por nome, marca, categoria ou descrição."""
    normalized_term = termo.strip().lower()
    if not normalized_term:
        return []

    products = Product.query.filter_by(is_active=True).order_by(Product.name).all()
    matches = [
        product.to_dict()
        for product in products
        if normalized_term in " ".join(
            (
                product.name,
                product.brand,
                " ".join(product.categories),
                product.description,
            )
        ).lower()
    ]
    return (matches or [product.to_dict() for product in products])[:10]


def consultar_carrinho(carrinho: dict) -> dict:
    """Retorna os itens e o subtotal do carrinho da solicitação atual."""
    return carrinho


def consultar_filiais(termo: str) -> dict:
    """Localiza filiais demonstrativas para um produto sem estoque nesta loja."""
    normalized_term = termo.strip().lower()
    if not normalized_term:
        return {"error": "Informe o nome do produto para consultar filiais."}
    product = next(
        (
            item
            for item in Product.query.filter_by(is_active=True).all()
            if normalized_term in item.name.lower()
        ),
        None,
    )
    if product is None:
        return {"error": "Produto não encontrado no catálogo."}
    if product.stock > 0:
        return {
            "product": product.name,
            "available_here": True,
            "message": "O produto está disponível na loja atual.",
        }
    return {
        "product": product.name,
        "available_here": False,
        "demo": True,
        "branches": demo_branch_availability(product.id),
    }
