import os
import sys

# Set up test environment
os.environ["DATABASE_URL"] = "sqlite:///test_app.db"
os.environ["SECRET_KEY"] = "test-secret-key"

try:
    from app import app
except ImportError as e:
    print(f"Error importing app: {e}")
    sys.exit(1)

client = app.test_client()

print("Running route verification tests...")

# Test Class Registration Route
response_turma = client.get("/cadastro_turma")
print(f"GET /cadastro_turma status: {response_turma.status_code}")
assert response_turma.status_code == 200, f"Expected 200 but got {response_turma.status_code}"

# Test Student Registration Route
response_estudante = client.get("/cadastro_estudante")
print(f"GET /cadastro_estudante status: {response_estudante.status_code}")
assert response_estudante.status_code == 200, f"Expected 200 but got {response_estudante.status_code}"

print("All route verification tests passed successfully!")
