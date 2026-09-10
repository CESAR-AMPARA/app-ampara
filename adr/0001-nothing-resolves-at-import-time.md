# Nothing resolves at import time

To guarantee total testability without external network, database, or cloud providers, all backend classes receive their external dependencies via `__init__` dependency injection. The application's composition root is the single place that wires real dependencies together, and its factory functions accept injected overrides so every unit test runs locally in isolation. This eliminates import-time side effects, ensures clean component coupling, and allows tests to run fast and deterministically.
