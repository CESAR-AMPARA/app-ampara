import os
import sys

# Define env vars for testing
os.environ["DATABASE_URL"] = "sqlite:///test_app.db"
os.environ["SECRET_KEY"] = "test-secret-key"

try:
    from app import app, db
    from models import Usuario
except ImportError as e:
    print(f"Error importing app: {e}")
    sys.exit(1)

# Create a test client
client = app.test_client()

# Recreate tables in test database
with app.app_context():
    db.drop_all()
    db.create_all()
    print("Database tables recreated successfully.")

# Test payload
payload = {
    "perfil": "docente",
    "nome": "Test User",
    "telefone": "(11) 99999-9999",
    "email": "test@ampara.edu.gov.br",
    "matricula": "12345678-9",
    "estado": "Acre",
    "municipio": "Rio Branco",
    "escola": "Escola Teste",
    "senha": "password123"
}

# Post to api/cadastro
response = client.post("/api/cadastro", json=payload)
print(f"Status Code: {response.status_code}")
print(f"Response JSON: {response.get_json()}")

# Clean up test database
if os.path.exists("test_app.db"):
    os.remove("test_app.db")
    print("Test database cleaned up.")
