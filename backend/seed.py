from models import Product, db

PRODUCTS = [{'id': 'SM-1042',
  'name': 'Leite Integral',
  'brand': 'Fazenda Clara',
  'category': 'Laticínios',
  'price': 5.49,
  'unit': '1 litro',
  'image': 'https://images.unsplash.com/photo-1576186726183-9bd8aa9fa6d9?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=900',
  'location': {'sector': 'Laticínios', 'aisle': 'Corredor 04', 'shelf': 'Gôndola B · Prateleira 2'},
  'description': 'Leite integral pasteurizado, fonte natural de cálcio e proteínas. Produzido com '
                 'leite de fazendas selecionadas.',
  'tags': ['Mais vendido', 'Fonte de cálcio'],
  'allergens': ['Contém lactose', 'Contém leite'],
  'risks': [{'ingredient': 'Gorduras saturadas',
             'level': 'Moderado',
             'description': 'O consumo frequente em excesso pode contribuir para o aumento do '
                            'colesterol LDL.'},
            {'ingredient': 'Lactose',
             'level': 'Atenção',
             'description': 'Pode causar desconforto digestivo em pessoas com intolerância à '
                            'lactose.'}],
  'nutrition': [{'label': 'Valor energético', 'value': '116 kcal'},
                {'label': 'Carboidratos', 'value': '9,4 g'},
                {'label': 'Proteínas', 'value': '6,2 g'},
                {'label': 'Gorduras totais', 'value': '6,0 g'}],
  'stock': 32},
 {'id': 'SM-2087',
  'name': 'Espaguete Grano Duro',
  'brand': 'Casa Toscana',
  'category': 'Massas',
  'price': 8.9,
  'unit': '500 g',
  'image': 'https://images.unsplash.com/photo-1612966893103-790e549a2ab1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=900',
  'location': {'sector': 'Mercearia', 'aisle': 'Corredor 08', 'shelf': 'Gôndola A · Prateleira 3'},
  'description': 'Massa de sêmola de trigo grano duro com textura firme e cozimento uniforme. '
                 'Ideal para molhos encorpados.',
  'tags': ['Oferta', 'Importado'],
  'allergens': ['Contém glúten', 'Pode conter ovos'],
  'risks': [{'ingredient': 'Carboidratos',
             'level': 'Moderado',
             'description': 'Porções muito grandes podem elevar rapidamente a glicemia, '
                            'especialmente sem fibras ou proteínas.'},
            {'ingredient': 'Glúten',
             'level': 'Atenção',
             'description': 'Não indicado para pessoas com doença celíaca ou sensibilidade '
                            'diagnosticada ao glúten.'}],
  'nutrition': [{'label': 'Valor energético', 'value': '352 kcal'},
                {'label': 'Carboidratos', 'value': '72 g'},
                {'label': 'Proteínas', 'value': '12 g'},
                {'label': 'Fibras', 'value': '3,1 g'}],
  'stock': 18},
 {'id': 'SM-3091',
  'name': 'Tomate Italiano',
  'brand': 'Horta Viva',
  'category': 'Hortifruti',
  'price': 7.99,
  'unit': 'quilo',
  'image': 'https://images.unsplash.com/photo-1531730802399-67fca7529b13?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=900',
  'location': {'sector': 'Hortifruti', 'aisle': 'Ilha 02', 'shelf': 'Banca C · Caixa 4'},
  'description': 'Tomates italianos frescos, selecionados diariamente. Sabor intenso e menor '
                 'quantidade de sementes.',
  'tags': ['Fresco hoje', 'Origem local'],
  'allergens': [],
  'risks': [{'ingredient': 'Acidez natural',
             'level': 'Atenção',
             'description': 'O consumo excessivo pode agravar sintomas em pessoas sensíveis a '
                            'refluxo ou gastrite.'}],
  'nutrition': [{'label': 'Valor energético', 'value': '18 kcal'},
                {'label': 'Carboidratos', 'value': '3,9 g'},
                {'label': 'Proteínas', 'value': '0,9 g'},
                {'label': 'Fibras', 'value': '1,2 g'}],
  'stock': 46},
 {'id': 'SM-4120',
  'name': 'Café Especial',
  'brand': 'Serra Alta',
  'category': 'Bebidas',
  'price': 26.9,
  'unit': '250 g',
  'image': 'https://images.unsplash.com/photo-1599639932525-213272ff954b?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=900',
  'location': {'sector': 'Mercearia', 'aisle': 'Corredor 06', 'shelf': 'Gôndola C · Prateleira 1'},
  'description': 'Café 100% arábica, torra média e notas de chocolate e caramelo. Cultivado em '
                 'altitude.',
  'tags': ['100% arábica', 'Torra média'],
  'allergens': [],
  'risks': [{'ingredient': 'Cafeína',
             'level': 'Moderado',
             'description': 'Em excesso pode causar insônia, ansiedade, palpitações e desconforto '
                            'gástrico.'}],
  'nutrition': [{'label': 'Valor energético', 'value': '6 kcal'},
                {'label': 'Carboidratos', 'value': '1,0 g'},
                {'label': 'Proteínas', 'value': '0,3 g'},
                {'label': 'Sódio', 'value': '1 mg'}],
  'stock': 9}]


def _to_model(data: dict) -> Product:
    location = data["location"]
    return Product(
        id=data["id"],
        name=data["name"],
        brand=data["brand"],
        category=data["category"],
        price=data["price"],
        unit=data["unit"],
        image=data["image"],
        description=data["description"],
        stock=data["stock"],
        location_sector=location["sector"],
        location_aisle=location["aisle"],
        location_shelf=location["shelf"],
        tags=data["tags"],
        allergens=data["allergens"],
        risks=data["risks"],
        nutrition=data["nutrition"],
    )


def seed_if_empty() -> None:
    """Popula o catálogo com os produtos de demonstração se a tabela estiver vazia."""
    if db.session.query(Product.id).first() is not None:
        return
    db.session.add_all(_to_model(item) for item in PRODUCTS)
    db.session.commit()
