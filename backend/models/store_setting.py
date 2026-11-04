from . import db


class StoreSetting(db.Model):
    __tablename__ = "store_settings"

    id = db.Column(db.Integer, primary_key=True)
    club_discount_percent = db.Column(db.Integer, nullable=False, default=10)
