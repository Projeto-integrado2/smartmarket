from datetime import datetime, timezone

from . import db


class SimulatedOrder(db.Model):
    __tablename__ = "simulated_orders"

    id = db.Column(db.String(40), primary_key=True)
    customer_id = db.Column(
        db.Integer,
        db.ForeignKey("customer_accounts.id"),
        nullable=True,
        index=True,
    )
    payment_method = db.Column(db.String(20), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    original_subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    discount_total = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    delivery_requested = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    items = db.relationship(
        "SimulatedOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    customer = db.relationship("CustomerAccount")


class SimulatedOrderItem(db.Model):
    __tablename__ = "simulated_order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(
        db.String(40),
        db.ForeignKey("simulated_orders.id"),
        nullable=False,
        index=True,
    )
    product_id = db.Column(db.String(20), nullable=False)
    product_name = db.Column(db.String(120), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit = db.Column(db.String(40), nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    discounted_unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    discount_percent = db.Column(db.Integer, nullable=False, default=0)
    line_total = db.Column(db.Numeric(10, 2), nullable=False)

    order = db.relationship("SimulatedOrder", back_populates="items")
