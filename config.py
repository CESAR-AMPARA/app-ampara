import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "uma-chave-secreta-muito-segura-e-longa-ampara")
    
    # Sanitiza a string de conexão se ela começar com postgres:// (padrão antigo que quebra no SQLAlchemy moderno)
    db_url = os.environ.get("DATABASE_URL", "sqlite:///app.db")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
