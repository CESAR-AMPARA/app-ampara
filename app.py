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

from models import Config
from models import db, Usuario
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

app.config.from_object(Config)

db.init_app(app)

with app.app_context():
    db.create_all()


@app.route("/")
def home():

    return render_template(
        "index.html"
    )


@app.route("/cadastro")
def cadastro():

    return render_template(
        "cadastro.html"
    )

@app.route("/login")
def cadastro():

    return render_template(
        "login.html"
    )


@app.route("/api/cadastro", methods=["POST"])
def cadastrar():

    dados = request.json

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

    dados = request.json

    usuario = Usuario.query.filter_by(
        email=dados["email"]
    ).first()

    if not usuario:

        return jsonify({
            "sucesso": False,
            "mensagem": "Usuário não encontrado."
        })

    if not check_password_hash(
        usuario.senha_hash,
        dados["senha"]
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

    usuarios = Usuario.query.all()

    return jsonify(
        [u.to_dict() for u in usuarios]
    )


@app.route("/api/aprovar/<int:id>")
def aprovar_usuario(id):

    usuario = Usuario.query.get(id)

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