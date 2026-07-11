import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "uma-chave-secreta-muito-segura-e-longa-ampara")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
