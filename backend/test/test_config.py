"""Tests for the application configuration module."""

import unittest
from src.config import Config


class TestConfig(unittest.TestCase):
    """Test suite for the Config class."""

    def test_config_values(self):
        """Verify that default config values are loaded correctly."""
        self.assertIsNotNone(Config.SECRET_KEY)
        self.assertIsNotNone(Config.SQLALCHEMY_DATABASE_URI)
        self.assertFalse(Config.SQLALCHEMY_TRACK_MODIFICATIONS)
        self.assertIn("pool_pre_ping", Config.SQLALCHEMY_ENGINE_OPTIONS)
