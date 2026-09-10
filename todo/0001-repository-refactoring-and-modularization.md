# Repository Refactoring and Modularization

## Problem
The current application codebase is monolithic at the root directory level, making it increasingly difficult to navigate, test, and enforce quality gates. There is no clean separation between the backend logic, frontend assets, and database schemas, which slows down development, violates our new architecture constraints, and prevents the implementation of targeted tests and static analysis.

## Business Vision and Purposes
By modularizing the repository into a strict monorepo layout, we ensure that new product features can be implemented faster and with fewer regressions. This foundation directly supports our goal of secure, predictable software delivery, allowing the team to confidently build the upcoming robust features of the A.M.P.A.R.A. platform.

## Solution
The entire repository will be refactored to align with the new directory structure, splitting the code into `backend/`, `frontend/`, and `database/` modules. A central `dev.sh` script will be introduced to handle all orchestration for building, testing, linting, and serving. All existing code will be migrated to the new structure without changing its core behaviour.

## User Stories
1. As a developer, I want a clean separation of backend and frontend code, so that I can work on one module without interfering with another.
2. As a developer, I want a unified `dev.sh` script, so that I can reliably run linting and tests without memorizing multiple commands.
3. As a tech lead, I want 1:1 test mappings and automated pylint checks, so that the codebase remains maintainable and adheres to our quality standards.

## Implementation Decisions
The root-level Python files (e.g., `app.py`, `models.py`, `config.py`) will be relocated into `backend/src/`. The static files and Jinja2 templates (currently in `static/`, `public/`, and `templates/`) will be moved to `frontend/src/` or `frontend/public/` as appropriate. The `usuario.sql` and SQLite local artifacts will be managed under the `database/` directory. A `dev.sh` orchestrator will be created in the root directory.

## Testing Decisions
Existing test files (e.g., `test_routes.py`, `test_track_*.py`) will be moved into `backend/test/` and refactored to align with the new 1:1 test mapping requirement, ensuring they match their respective production modules (like `test_app.py` for `app.py`).

## Out of Scope
Adding new features to the A.M.P.A.R.A. product or modifying the existing Flask routing behaviour. This spec is strictly about reorganizing the repository structure and establishing the build and test pipelines.
