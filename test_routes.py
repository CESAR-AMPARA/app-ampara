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

import json

# Test Professor Login via credentials.json
print("Testing Professor Login...")
resp_prof = client.post("/api/login", json={
    "email": "professor@ampara.gov.br",
    "senha": "senha123"
})
data_prof = json.loads(resp_prof.data)
print(f"Professor Login success: {data_prof.get('sucesso')}, Perfil: {data_prof.get('usuario', {}).get('perfil')}")
assert data_prof.get("sucesso") == True
assert data_prof.get("usuario", {}).get("perfil") == "docente"

# Test Coordinator Login via credentials.json
print("Testing Coordinator Login...")
resp_coord = client.post("/api/login", json={
    "email": "coordenador@ampara.gov.br",
    "senha": "senha123"
})
data_coord = json.loads(resp_coord.data)
print(f"Coordinator Login success: {data_coord.get('sucesso')}, Perfil: {data_coord.get('usuario', {}).get('perfil')}")
assert data_coord.get("sucesso") == True
assert data_coord.get("usuario", {}).get("perfil") == "gestao"

# Test Invalid Password
print("Testing Invalid Password Login...")
resp_invalid = client.post("/api/login", json={
    "email": "coordenador@ampara.gov.br",
    "senha": "wrongpassword"
})
data_invalid = json.loads(resp_invalid.data)
print(f"Invalid Login success: {data_invalid.get('sucesso')}")
assert data_invalid.get("sucesso") == False

print("All route verification tests passed successfully!")
