import getpass
import secrets
import sys

from werkzeug.security import generate_password_hash

from app import app
from models import AdminUser, db
from services.auth import cpf_digest, normalize_cpf


def main() -> int:
    with app.app_context():
        token_secret = app.config.get("ADMIN_TOKEN_SECRET")
        if not isinstance(token_secret, str) or len(token_secret) < 32:
            print("Configure ADMIN_TOKEN_SECRET com pelo menos 32 caracteres antes de criar o administrador.")
            return 1
        if AdminUser.query.filter(AdminUser.cpf_hash.isnot(None)).first() is not None:
            print("Já existe uma conta administrativa por CPF.")
            return 1

        name = input("Nome do administrador: ").strip()
        cpf = normalize_cpf(input("CPF do administrador: "))
        pin = getpass.getpass("PIN de 6 dígitos: ")
        confirmation = getpass.getpass("Confirme o PIN: ")
        if not name or len(name) > 120 or cpf is None:
            print("Nome ou CPF inválido.")
            return 1
        if len(pin) != 6 or not pin.isdigit() or pin != confirmation:
            print("O PIN deve conter 6 dígitos e as confirmações devem coincidir.")
            return 1

        user = AdminUser(
            username=f"admin-{secrets.token_hex(12)}",
            display_name=name,
            cpf_hash=cpf_digest(cpf),
            cpf_last4=cpf[-4:],
            password_hash=generate_password_hash(pin),
        )
        db.session.add(user)
        db.session.commit()
        print("Administrador cadastrado. Faça login com CPF e PIN.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
