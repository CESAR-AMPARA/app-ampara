# A.M.P.A.R.A. — Apoio, Monitoramento Psicológico e Acolhimento Responsável ao Aluno / Support, Psychological Monitoring, and Responsible Student Care

### PT-BR
O **A.M.P.A.R.A.** é uma plataforma web projetada para apoiar, monitorar e garantir o acolhimento psicossocial de estudantes do Ensino Médio. A aplicação conecta docentes, equipes multidisciplinares (psicólogos, assistentes sociais e orientadores) e a gestão escolar em torno do bem-estar dos alunos, operando sob conformidade estrita com a LGPD (Lei Geral de Proteção de Dados) para o tratamento de dados sensíveis de saúde e comportamento escolar.

### English
**A.M.P.A.R.A.** is a web platform designed to support, monitor, and ensure the psychosocial care of high school students. The application connects teachers, multidisciplinary teams (psychologists, social workers, and counselors), and school administrators around student well-being. It operates under strict compliance with the LGPD (General Data Protection Law) for the processing of sensitive health and school behavior data.

---

## Developer Guidelines and Repository Architecture

This codebase operates as a modular monorepo to ensure clean separation of concerns, high testability, and strict security compliance.

### Directory Structure

```text
├── adr/             Architecture Decision Records (permanent historical decisions)
├── todo/            Contains the specs for features that haven't been built yet
├── frontend/        Frontend application logic (src/, test/)
├── backend/         Backend services and domain logic (src/, test/)
├── database/        Scheduled jobs, schemas, and database-related scripts
├── Dockerfile       Python image that serves the static files and /api
└── dev.sh           Unified orchestrator script: build, test, lint, serve, deploy
```

### Architecture Constraints

- **Dependency Injection:** Nothing resolves at import time. External dependencies are injected via `__init__`, enabling isolation for fast, deterministic unit tests.
- **Infrastructure Adapters:** Service-specific logic (e.g., SDK calls, API requests) must be encapsulated in dedicated adapter modules, never inline in domain services.
- **Secret Security:** Zero hardcoded credentials allowed. No sensitive secrets are carried by environment variables, even locally. Refer to the ADRs for our credential resolution strategy.

### Development Workflow

We follow a strict Test-Driven Development (TDD) lifecycle:
1. **Red Phase**: Write or update failing tests in the `test/` directory.
2. **Green Phase**: Implement minimal production code in `src/` to pass tests.
3. **Refactor Phase**: Clean duplication and improve readability while keeping tests green.

#### Quality Gates
- **Test Mapping**: 1:1 correspondence required. Every production module inside `src/` must have a corresponding test module in `test/`.
- **Code Coverage**: Must maintain **>90%** coverage for all files inside `src/`.
- **Pylint Score**: Must maintain a perfect **10/10** score on all files in `src/`. No blanket `# pylint: disable` comments allowed.

### Tech Stack
- **Runtime:** Python 3.14 (pinned in the container image).
- **Core Dependencies:** Managed in `requirements.txt`.
- **Testing:** `unittest`, `PyHamcrest`, and `coverage`.
- **Linting:** `pylint` (Strict configuration in `.pylintrc`).

### Language Rules
- **English:** Module names, docstrings, commit messages, comments, tests, and documentation (like ADRs and Specs).
- **Portuguese:** Any text that leaves the codebase for a human (UI copy, error messages) or for an AI model (system prompts, tool descriptions). Model-facing text is always defined as explicit constants.

---

## Development Commands

All common developer workflows are centralized under the unified `dev.sh` orchestrator script.

### Commands

1. **Install Dependencies**
   Creates a Python virtual environment (`.venv`) and installs all production and development dependencies (including `pylint` and `coverage`):
   ```bash
   ./dev.sh install
   ```

2. **Run Tests & Code Coverage**
   Executes the full unit test suite with code coverage reporting. Enforces the strict **>90%** coverage gate:
   ```bash
   ./dev.sh test
   ```

3. **Run Code Quality Checks (Linter)**
   Performs static analysis with `pylint` across all code. Enforces the strict **10/10** quality gate:
   ```bash
   ./dev.sh lint
   ```

4. **Start Local Development Server**
   Launches the Flask backend development server (with hot-reload and debug mode), dynamically rendering the templates and assets from `frontend/`:
   ```bash
   ./dev.sh serve
   ```

---

For full architectural context and decisions, always refer to the [`adr/`](adr/README.md) directory. For pending implementations and feature specifications, refer to the [`todo/`](todo/README.md) directory.
