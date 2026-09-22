"""Flask application for the App Ampara system."""

import os
import json
from dotenv import load_dotenv
from flask import (
    Flask,
    render_template,
    request,
    jsonify
)
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)
from src.config import Config
from src.models import db, Usuario

load_dotenv()

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_TEMPLATE_DIR = os.path.abspath(
    os.path.join(_CURRENT_DIR, "../../frontend/src/templates")
)
_STATIC_DIR = os.path.abspath(
    os.path.join(_CURRENT_DIR, "../../frontend/src/static")
)

app = Flask(
    __name__,
    template_folder=_TEMPLATE_DIR,
    static_folder=_STATIC_DIR
)

app.config.from_object(Config)

db.init_app(app)

with app.app_context():
    db.create_all()


@app.route("/")
def home():
    """Render the landing page."""
    return render_template(
        "index.html"
    )


@app.route("/cadastro")
def cadastro():
    """Render the user onboarding page."""
    return render_template(
        "cadastro.html"
    )


@app.route("/login")
def login_page():
    """Render the login page."""
    return render_template(
        "login.html"
    )


@app.route("/dashboard")
def dashboard():
    """Render the main system dashboard."""
    return render_template(
        "dashboard.html"
    )


@app.route("/cadastro_turma")
def cadastro_turma():
    """Render the class registration page."""
    return render_template(
        "cadastro_turma.html"
    )


@app.route("/cadastro_estudante")
def cadastro_estudante():
    """Render the student registration page."""
    return render_template(
        "cadastro_estudante.html"
    )


@app.route("/api/cadastro", methods=["POST"])
def cadastrar():
    """Handle new user registration API request."""
    dados = request.json
    db_url = os.environ.get("DATABASE_URL", "sqlite:///app.db")
    print(db_url)

    usuario_existente = Usuario.query.filter_by(
        email=dados["email"]
    ).first()

    if usuario_existente:
        return jsonify({
            "sucesso": False,
            "mensagem": "E-mail já cadastrado."
        })

    usuario = Usuario(
        nome=dados["nome"],
        email=dados["email"],
        telefone=dados["telefone"],
        perfil=dados["perfil"],
        matricula=dados["matricula"],
        estado=dados["estado"],
        municipio=dados["municipio"],
        escola=dados["escola"],
        senha_hash=generate_password_hash(
            dados["senha"]
        )
    )

    db.session.add(usuario)
    db.session.commit()

    return jsonify({
        "sucesso": True,
        "mensagem": "Cadastro enviado."
    })


@app.route("/api/login", methods=["POST"])
def login():
    """Authenticate a user using credentials file or database fallback."""
    dados = request.json
    email_input = dados.get("email")
    senha_input = dados.get("senha")

    # 1. Verificar no credentials.json primeiro (para simulação de perfis)
    paths_to_check = [
        "credentials.json",
        os.path.join(_CURRENT_DIR, "credentials.json"),
        os.path.join(_CURRENT_DIR, "../credentials.json"),
        os.path.join(_CURRENT_DIR, "../../credentials.json")
    ]
    creds_path = None
    for p in paths_to_check:
        if os.path.exists(p):
            creds_path = p
            break

    if creds_path:
        try:
            with open(creds_path, "r", encoding="utf-8") as f:
                creds = json.load(f)
                if email_input in creds:
                    user_info = creds[email_input]
                    if user_info.get("senha") == senha_input:
                        return jsonify({
                            "sucesso": True,
                            "usuario": {
                                "nome": user_info.get("nome"),
                                "email": email_input,
                                "perfil": user_info.get("perfil"),
                                "escola": user_info.get("escola")
                            }
                        })
                    return jsonify({
                        "sucesso": False,
                        "mensagem": "Senha inválida."
                    })
        except (OSError, json.JSONDecodeError) as e:
            print(f"Erro ao carregar credentials.json: {e}")

    # 2. Fallback para banco de dados tradicional
    usuario = Usuario.query.filter_by(
        email=email_input
    ).first()

    if not usuario:
        return jsonify({
            "sucesso": False,
            "mensagem": "Usuário não encontrado."
        })

    if not check_password_hash(
        usuario.senha_hash,
        senha_input
    ):
        return jsonify({
            "sucesso": False,
            "mensagem": "Senha inválida."
        })

    return jsonify({
        "sucesso": True,
        "usuario": usuario.to_dict()
    })


@app.route("/api/usuarios")
def listar_usuarios():
    """List all registered users."""
    usuarios = Usuario.query.all()
    return jsonify(
        [u.to_dict() for u in usuarios]
    )


@app.route("/api/aprovar/<int:usuario_id>")
def aprovar_usuario(usuario_id):
    """Approve a user by validation status."""
    usuario = Usuario.query.get(usuario_id)

    if usuario:
        usuario.validado = True
        db.session.commit()

    return jsonify({
        "sucesso": True
    })


if __name__ == "__main__":
    app.run(
        debug=True
    )
