from flask import Blueprint, jsonify

from models import StoreSetting, db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@settings_bp.get("/club")
def club_settings():
    settings = db.session.get(StoreSetting, 1)
    return jsonify({
        "club_discount_percent": settings.club_discount_percent if settings else 10,
    })
