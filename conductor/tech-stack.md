# Technology Stack: A.M.P.A.R.A.

## Programming Languages
- **Python 3.11:** Primary language for backend logic and APIs.
- **JavaScript (Vanilla):** Client-side scripting.
- **HTML5 & CSS3:** Semantic markup and modern styling.

## Backend Architecture
- **Framework:** Flask (Monolithic MVC architecture).
- **ORM:** SQLAlchemy (Flask-SQLAlchemy) for database interactions and Alembic (Flask-Migrate) for migrations.
- **Server:** Gunicorn serving as the WSGI HTTP Server.

## Frontend Architecture
- **Framework:** None (Vanilla implementation).
- **Styling:** Custom CSS3 with responsive, mobile-first design and accessibility support.
- **Templating:** Jinja2 (integrated with Flask).

## Data Layer
- **Production/Main Database:** PostgreSQL (via `psycopg2-binary`).
- **Development Database:** SQLite (local).

## Infrastructure & DevOps
- **Containerization:** Docker & Docker Compose.
- **CI/CD:** Local deployment only (No external cloud/CI providers currently configured).
