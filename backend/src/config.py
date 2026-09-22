"""Configuration settings for the App Ampara application."""

import os


class Config:  # pylint: disable=too-few-public-methods
    """Application configuration class holding Flask and database settings."""

    # Chave secreta carregada do arquivo .env ou do ambiente
    SECRET_KEY = os.environ.get(
        "SECRET_KEY", "uma-chave-secreta-muito-segura-e-longa-ampara"
    )

    # Sanitiza a string de conexão se ela começar com postgres://
    # (padrão antigo que quebra no SQLAlchemy moderno)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "../.."))
    db_path = os.path.join(project_root, "database", "app.db")
    db_url = os.environ.get("DATABASE_URL", f"sqlite:///{db_path}")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Configurações de Pool de Conexão do Banco de Dados
    # (Essencial para conexões robustas com PostgreSQL na nuvem)
    SQLALCHEMY_ENGINE_OPTIONS = {
        # Envia um "ping" leve (SELECT 1) ao banco antes de cada consulta.
        # Se a conexão tiver caído, o SQLAlchemy a recria silenciosamente.
        "pool_pre_ping": True,
        # Recicla as conexões a cada 30 minutos (1800 segundos)
        # para evitar conexões persistentes orfãs.
        "pool_recycle": 1800,
    }

    # Só adiciona pool_size e max_overflow se não for SQLite
    # (que pode usar pools estáticos e não aceitar esses argumentos)
    if not db_url.startswith("sqlite"):
        # Define o número máximo de conexões persistentes abertas pelo pool
        SQLALCHEMY_ENGINE_OPTIONS["pool_size"] = 10

        # Limite máximo de conexões extras temporárias permitidas
        SQLALCHEMY_ENGINE_OPTIONS["max_overflow"] = 5
