"""Tests for the Flask application routes and tracks."""

import json
import os
import unittest

# Set up test environment before importing the app
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"

from src.app import app, db  # pylint: disable=wrong-import-position
from src.models import Usuario  # pylint: disable=wrong-import-position


class TestApp(unittest.TestCase):
    """Test suite for the Flask application."""

    def setUp(self):
        """Set up the test client and clear database."""
        self.client = app.test_client()
        with app.app_context():
            db.create_all()

    def tearDown(self):
        """Clean up database after each test."""
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def test_home(self):
        """Verify the homepage renders correctly."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)

    def test_cadastro_page(self):
        """Verify the cadastro page renders correctly."""
        response = self.client.get("/cadastro")
        self.assertEqual(response.status_code, 200)

    def test_login_page(self):
        """Verify the login page renders correctly."""
        response = self.client.get("/login")
        self.assertEqual(response.status_code, 200)

    def test_dashboard_page(self):
        """Verify the dashboard page renders correctly."""
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, 200)

    def test_cadastro_turma_page(self):
        """Verify the cadastro turma page renders correctly."""
        response = self.client.get("/cadastro_turma")
        self.assertEqual(response.status_code, 200)

    def test_cadastro_estudante_page(self):
        """Verify the cadastro estudante page renders correctly."""
        response = self.client.get("/cadastro_estudante")
        self.assertEqual(response.status_code, 200)

    def test_api_cadastro_and_login(self):
        """Test registering a user and logging in."""
        # 1. Register a new user
        response = self.client.post("/api/cadastro", json={
            "nome": "João Silva",
            "email": "joao@ampara.gov.br",
            "telefone": "81999999999",
            "perfil": "docente",
            "matricula": "123456",
            "estado": "PE",
            "municipio": "Recife",
            "escola": "Erem Teste",
            "senha": "senha_segura"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("sucesso"))
        self.assertEqual(data.get("mensagem"), "Cadastro enviado.")

        # 2. Duplicate registration should fail
        response = self.client.post("/api/cadastro", json={
            "nome": "João Silva",
            "email": "joao@ampara.gov.br",
            "telefone": "81999999999",
            "perfil": "docente",
            "matricula": "123456",
            "estado": "PE",
            "municipio": "Recife",
            "escola": "Erem Teste",
            "senha": "senha_segura"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data.get("sucesso"))
        self.assertEqual(data.get("mensagem"), "E-mail já cadastrado.")

        # 3. Successful database login
        response = self.client.post("/api/login", json={
            "email": "joao@ampara.gov.br",
            "senha": "senha_segura"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("sucesso"))
        self.assertEqual(data.get("usuario", {}).get("nome"), "João Silva")

        # 4. Login with invalid password
        response = self.client.post("/api/login", json={
            "email": "joao@ampara.gov.br",
            "senha": "senha_errada"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data.get("sucesso"))
        self.assertEqual(data.get("mensagem"), "Senha inválida.")

        # 5. Login with non-existent user
        response = self.client.post("/api/login", json={
            "email": "inexistente@ampara.gov.br",
            "senha": "senha"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data.get("sucesso"))
        self.assertEqual(data.get("mensagem"), "Usuário não encontrado.")

    def test_api_usuarios_and_aprovar(self):
        """Test listing users and approving a user."""
        # Create a mock user in the db context
        with app.app_context():
            u = Usuario(
                nome="Ana Costa",
                email="ana@ampara.gov.br",
                telefone="81988888888",
                perfil="equipe",
                matricula="654321",
                estado="PE",
                municipio="Olinda",
                escola="Erem Teste 2",
                senha_hash="dummy_hash",
                validado=False
            )
            db.session.add(u)
            db.session.commit()
            u_id = u.id

        # List users and verify
        response = self.client.get("/api/usuarios")
        self.assertEqual(response.status_code, 200)
        users = json.loads(response.data)
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0]["nome"], "Ana Costa")
        self.assertFalse(users[0]["validado"])

        # Approve the user
        response = self.client.get(f"/api/aprovar/{u_id}")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("sucesso"))

        # Verify the user is now approved
        response = self.client.get("/api/usuarios")
        self.assertEqual(response.status_code, 200)
        users = json.loads(response.data)
        self.assertTrue(users[0]["validado"])

    def test_credentials_login(self):
        """Test mock login using credentials.json for different profiles."""
        # Professor login (docente)
        response = self.client.post("/api/login", json={
            "email": "professor@ampara.gov.br",
            "senha": "senha123"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("sucesso"))
        self.assertEqual(data.get("usuario", {}).get("perfil"), "docente")

        # Coordinator login (gestao)
        response = self.client.post("/api/login", json={
            "email": "coordenador@ampara.gov.br",
            "senha": "senha123"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("sucesso"))
        self.assertEqual(data.get("usuario", {}).get("perfil"), "gestao")

        # Invalid password for coordinator
        response = self.client.post("/api/login", json={
            "email": "coordenador@ampara.gov.br",
            "senha": "senha_errada"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data.get("sucesso"))
        self.assertEqual(data.get("mensagem"), "Senha inválida.")

    def test_track_features_in_dashboard(self):
        """Verify all custom UI features from Tracks 1 to 4 exist in the dashboard HTML."""
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")

        # Track 1: Biblioteca tab button and panel
        self.assertIn("tab-btn-biblioteca", html)
        self.assertIn("panel-biblioteca", html)

        # Track 2: Share material form and panel
        self.assertIn("form-share-material", html)
        self.assertIn("panel-professor-capacitacao", html)

        # Track 3: Timeline period filter
        self.assertIn("timeline-period-filter", html)

        # Track 4: Behavior type and character counter
        self.assertIn("behavior-type", html)
        self.assertIn("char-counter", html)
