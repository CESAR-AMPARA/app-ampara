"""Tests for the database models."""

import unittest
from src.models import Usuario


class TestModels(unittest.TestCase):
    """Test suite for the database models."""

    def test_usuario_creation(self):
        """Verify that a Usuario instance is created with correct fields."""
        usuario = Usuario(
            nome="Test User",
            email="test@ampara.gov.br",
            telefone="123456789",
            perfil="docente",
            matricula="12345",
            estado="PE",
            municipio="Recife",
            escola="Escola Teste",
            senha_hash="hash_here",
            validado=False
        )
        self.assertEqual(usuario.nome, "Test User")
        self.assertEqual(usuario.email, "test@ampara.gov.br")
        self.assertEqual(usuario.telefone, "123456789")
        self.assertEqual(usuario.perfil, "docente")
        self.assertEqual(usuario.matricula, "12345")
        self.assertEqual(usuario.estado, "PE")
        self.assertEqual(usuario.municipio, "Recife")
        self.assertEqual(usuario.escola, "Escola Teste")
        self.assertEqual(usuario.senha_hash, "hash_here")
        self.assertFalse(usuario.validado)

        # Test to_dict method
        u_dict = usuario.to_dict()
        self.assertEqual(u_dict["nome"], "Test User")
        self.assertEqual(u_dict["email"], "test@ampara.gov.br")
        self.assertEqual(u_dict["perfil"], "docente")
        self.assertEqual(u_dict["escola"], "Escola Teste")
        self.assertFalse(u_dict["validado"])
