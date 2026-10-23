from models import Product


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
                product.category,
                product.description,
            )
        ).lower()
    ]
    return (matches or [product.to_dict() for product in products])[:10]


def consultar_carrinho(carrinho: dict) -> dict:
    """Retorna os itens e o subtotal do carrinho da solicitação atual."""
    return carrinho
