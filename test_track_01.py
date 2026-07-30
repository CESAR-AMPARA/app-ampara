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

print("Running Track 1 tests...")

# Get /dashboard and check if the Biblioteca tab button is present in the HTML
response = client.get("/dashboard")
assert response.status_code == 200, f"Expected 200, got {response.status_code}"

html_content = response.data.decode("utf-8")

# Check for structural elements of the Biblioteca feature
print("Checking for Biblioteca tab button and panel in HTML...")
assert "tab-btn-biblioteca" in html_content, "Expected 'tab-btn-biblioteca' in dashboard HTML, but not found."
assert "panel-biblioteca" in html_content, "Expected 'panel-biblioteca' in dashboard HTML, but not found."

print("All Track 1 tests passed!")
