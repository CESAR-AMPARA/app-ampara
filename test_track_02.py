import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///test_app.db"
os.environ["SECRET_KEY"] = "test-secret-key"

try:
    from app import app
except ImportError as e:
    print(f"Error importing app: {e}")
    sys.exit(1)

client = app.test_client()

print("Running Track 2 tests...")

response = client.get("/dashboard")
assert response.status_code == 200, f"Expected 200, got {response.status_code}"

html_content = response.data.decode("utf-8")

print("Checking for Coordenador share material form and Professor materials panel in HTML...")
assert "form-share-material" in html_content, "Expected 'form-share-material' form in dashboard HTML, but not found."
assert "panel-professor-capacitacao" in html_content, "Expected 'panel-professor-capacitacao' section in dashboard HTML, but not found."

print("All Track 2 tests passed!")
