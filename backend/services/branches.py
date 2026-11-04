DEMO_BRANCHES = (
    {"name": "Filial Centro (simulada)", "distance_km": 1.2, "address": "Endereço demonstrativo — Centro"},
    {"name": "Filial Norte (simulada)", "distance_km": 3.8, "address": "Endereço demonstrativo — Zona Norte"},
    {"name": "Filial Sul (simulada)", "distance_km": 5.4, "address": "Endereço demonstrativo — Zona Sul"},
)


def demo_branch_availability(product_id: str) -> list[dict]:
    # These quantities are illustrative and are not connected to real branch stock.
    return [
        {**branch, "stock": 3 + index}
        for index, branch in enumerate(DEMO_BRANCHES)
    ]
