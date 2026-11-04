from datetime import datetime, timezone

from . import db


class CustomerAccount(db.Model):
    __tablename__ = "customer_accounts"

    id = db.Column(db.Integer, primary_key=True)
    cpf_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    address = db.Column(db.String(300), nullable=False)
    pin_hash = db.Column(db.String(256), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    def set_pin(self, pin: str) -> None:
        from werkzeug.security import generate_password_hash

        self.pin_hash = generate_password_hash(pin)

    def check_pin(self, pin: str) -> bool:
        from werkzeug.security import check_password_hash

        return check_password_hash(self.pin_hash, pin)
