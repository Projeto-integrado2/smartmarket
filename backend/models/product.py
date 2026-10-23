from . import db


class Product(db.Model):
    """Produto do catálogo. A forma do to_dict() espelha o tipo Product do front-end."""

    __tablename__ = "products"

    id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    brand = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(60), nullable=False, index=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    unit = db.Column(db.String(40), nullable=False)
    image = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default="1")

    location_sector = db.Column(db.String(60), nullable=False)
    location_aisle = db.Column(db.String(60), nullable=False)
    location_shelf = db.Column(db.String(80), nullable=False)

    tags = db.Column(db.JSON, nullable=False, default=list)
    allergens = db.Column(db.JSON, nullable=False, default=list)
    risks = db.Column(db.JSON, nullable=False, default=list)
    nutrition = db.Column(db.JSON, nullable=False, default=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "brand": self.brand,
            "category": self.category,
            "price": float(self.price),
            "unit": self.unit,
            "image": self.image,
            "location": {
                "sector": self.location_sector,
                "aisle": self.location_aisle,
                "shelf": self.location_shelf,
            },
            "description": self.description,
            "tags": self.tags,
            "allergens": self.allergens,
            "risks": self.risks,
            "nutrition": self.nutrition,
            "stock": self.stock,
            "is_active": self.is_active,
        }
