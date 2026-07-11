from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Usuario(db.Model):

    __tablename__ = "usuarios"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    nome = db.Column(
        db.String(150),
        nullable=False
    )

    email = db.Column(
        db.String(150),
        unique=True,
        nullable=False
    )

    telefone = db.Column(
        db.String(20)
    )

    perfil = db.Column(
        db.String(20)
    )

    matricula = db.Column(
        db.String(50)
    )

    estado = db.Column(
        db.String(50)
    )

    municipio = db.Column(
        db.String(100)
    )

    escola = db.Column(
        db.String(200)
    )

    senha_hash = db.Column(
        db.Text,
        nullable=False
    )

    validado = db.Column(
        db.Boolean,
        default=False
    )

    def to_dict(self):

        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "perfil": self.perfil,
            "escola": self.escola,
            "validado": self.validado
        }