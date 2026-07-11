import os

class Config:
    # Chave secreta carregada do arquivo .env ou do ambiente
    SECRET_KEY = os.environ.get("SECRET_KEY", "uma-chave-secreta-muito-segura-e-longa-ampara")
    
    # Sanitiza a string de conexão se ela começar com postgres:// (padrão antigo que quebra no SQLAlchemy moderno)
    db_url = os.environ.get("DATABASE_URL", "sqlite:///app.db")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Configurações de Pool de Conexão do Banco de Dados (Essencial para conexões robustas com PostgreSQL na nuvem)
    SQLALCHEMY_ENGINE_OPTIONS = {
        # Envia um "ping" leve (SELECT 1) ao banco antes de cada consulta. 
        # Se a conexão tiver caído (por timeout ou reinício do servidor), o SQLAlchemy a recria silenciosamente.
        "pool_pre_ping": True,
        
        # Recicla as conexões a cada 30 minutos (1800 segundos) para evitar conexões persistentes orfãs.
        "pool_recycle": 1800,
        
        # Define o número máximo de conexões persistentes abertas pelo pool
        "pool_size": 10,
        
        # Limite máximo de conexões extras temporárias permitidas em picos de tráfego
        "max_overflow": 5
    }
