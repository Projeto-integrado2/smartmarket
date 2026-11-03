from datetime import datetime, timezone

from . import db


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), nullable=False, index=True)
    role = db.Column(db.String(10), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(
        db.DateTime,
        nullable=True,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
