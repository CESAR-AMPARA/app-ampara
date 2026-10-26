# Backend Foundation and Delivery Hardening

*Phase: MVP #1 (backbone). Story-map cards: "As a user, I want my data and the students' data to be handled according to the LGPD to guarantee full privacy" (value 800, 3 points); "As a user, I want to log in securely from any device" (value 100, 1 point).*

*This specification is backend-only and has no frontend counterpart. It ships first: [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md) and every later backend spec build on the composition root and the credential resolution defined here.*

## Problem
The backend on `main` cannot be handed to a school. Until 2026-10-26, `/api/login` accepted any e-mail and plaintext password listed in a committed `credentials.json`; that bypass, the file, and the tracked `database/app.db` are gone from the code and from Git history, but the passwords were public while the repository was, so any of them reused elsewhere must be changed.

The rest of the backend contradicts the rules the team wrote down. `src/app.py` creates the Flask app, binds the database, and runs `db.create_all()` at import time, against [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md). `src/config.py` reads `SECRET_KEY` and `DATABASE_URL` from environment variables and falls back to a hardcoded secret key, against [ADR-0003](../adr/0003-secrets-handling-credentials.md). `GET /api/usuarios` lists every account with no authentication, and `GET /api/aprovar/<id>` activates any account with no authentication, through a `GET` that a crawler or a prefetching browser can trigger. `/api/cadastro` prints the database URL to the server log.

The quality gates are only partly enforced. `.github/workflows/ci.yml` now runs pylint, the backend suite against `fail_under = 90` in `backend/.coveragerc`, the frontend suite, and a container smoke test, but there is no `.pylintrc`, so the 10/10 rule rests on pylint's defaults, and `src/models.py` and `src/config.py` carry `# pylint: disable` comments. `requirements.txt` is saved as UTF-16 with CRLF line endings, lists `dotenv` next to `python-dotenv`, and lacks `PyHamcrest`, which the test conventions require. The `README.md` and `backend/DEV_WORKFLOW.md` pin Python 3.14, while the `Dockerfile` and the CI workflow use 3.11.

## Business Vision and Purposes
Every MVP feature stores mental-health observations about adolescents, and the first security incident would end the pilot with the schools. This spec removes the two ways in that bypass the product's own authentication and makes the remaining written engineering rules executable before a production environment exists again. It gives every following backend spec a composition root to register routes and adapters in, so none of them has to fix the foundation on the side.

## Solution
After this ships, the only way to log in is through the accounts stored in the database, no credential or database file lives in the repository, and the server reads its secrets from a restricted file outside the repository. The application is built by a factory that tests call with in-memory doubles. The legacy unauthenticated approval route is gone. Lint and Python version rules are the same in CI, in the image, and on developers' machines, and the CI container smoke test starts the app with a throwaway credentials file. A `./dev.sh seed` command creates a local demo school with one account per profile, so manual testing no longer depends on a shared password file.

## User Stories
1. As a school manager, I want nobody to log in to my school's panel with a password taken from the source code, so that student records are protected by real accounts only.
2. As a developer, I want to build the app with injected doubles, so that the test suite runs offline and deterministically.
3. As a developer, I want the lint gate to follow a committed configuration with no suppressions, so that the rules in `backend/DEV_WORKFLOW.md` hold without relying on reviewers.
4. As a developer, I want one command that seeds a demo school with an account per profile, so that I can test each panel locally without sharing passwords.

## Implementation Decisions

### Application factory as the composition root
`src/app.py` exposes `create_app(credentials=None, config_overrides=None)` and keeps no module-level `app`. The factory builds the Flask instance, resolves credentials through the injected `credentials` provider (the real `CredentialsFileAdapter` when `None`), initializes SQLAlchemy, registers blueprints, and returns the app; nothing connects to a database or reads a file at import. Schema creation leaves the import path: `db.create_all()` moves into a `./dev.sh init-db` command, and from [0002](0002-multi-tenant-auth-registration-backend.md) on, tenant schemas are created by tenant provisioning. Gunicorn loads `"src.app:create_app()"`, which it supports natively as an application factory call.

Routes move out of `src/app.py` into blueprints under `src/routes/` (`pages.py` for the HTML pages, and one module per API area as later specs add them), so the factory stays a wiring function. The page routes keep their current paths.

### Secrets come from a restricted file, never from the environment
`src/adapters/credentials_file.py` defines `CredentialsFileAdapter(path)`, which reads a JSON file and returns typed values through `get(name)`, raising `MissingCredentialError` when a key is absent. The path is resolved in this order: the `--credentials` argument of `dev.sh serve`, then `/run/secrets/ampara-credentials.json` (the container mount point), then `~/.config/ampara/credentials.json` for local development. The path itself is not a secret, so passing it is allowed; the values never travel through environment variables. The file holds:

```json
{
  "flask_secret_key": "<random 64 hex characters>",
  "jwt_signing_key": "<random 64 hex characters>",
  "master_database_url": "postgresql://user:password@host:5432/ampara_master",
  "tenant_database_url_template": "postgresql://user:password@host:5432/{tenant_id}"
}
```

The factory refuses to start when the file is missing or a key is absent, with the message naming the key but never its value. A hardcoded fallback secret is exactly what made the current `Config` unsafe, so there is no fallback; the cost is that a fresh clone needs the file before `./dev.sh serve` works, which `./dev.sh seed` mitigates by writing a development file with random keys and SQLite URLs under `~/.config/ampara/` when none exists.

### Removing the legacy routes
[0002](0002-multi-tenant-auth-registration-backend.md) replaces the login handler entirely. `.gitignore` already lists `credentials.json` and `*.db`; this spec adds `.env`, and the credentials adapter below never looks inside the repository, so a stray file there is ignored rather than read.

`GET /api/aprovar/<id>` is deleted; approval is the `POST /api/gestao/usuarios/<id>/aprovar` of `0002`. `GET /api/usuarios` keeps its path because [0006](0006-referral-queue-management-backend.md) extends it, and [0011](0011-access-management-backend.md) restricts it to `gestor_escolar`. Until `0011` lands, this spec trims the route's response to `id`, `nome`, `perfil`, `cargo`, and `status`, the fields the triage dropdown of `0006` needs, so e-mails stop leaking in the meantime; the two specs are meant to reach production in the same release. The `print(db_url)` call and `load_dotenv()` are deleted.

### Security headers on every response
An `after_request` hook registered by the factory adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security: max-age=31536000` when the request arrived over HTTPS. API responses also get `Cache-Control: no-store`, because they carry student data and must not stay in shared or browser caches. A `Content-Security-Policy` is not added here: the pages rely on inline scripts and inline `style` attributes, and a policy that allows `unsafe-inline` would be decoration.

### Quality gates as configuration
`backend/.coveragerc` already enforces `fail_under = 90`; it gains `omit = */__init__.py`, matching the 1:1 test-mapping rule that excludes those files. A `backend/.pylintrc` enables every message and sets only the numeric thresholds the architecture needs, each with a comment saying why. The `# pylint: disable=too-few-public-methods` comments in `src/models.py` and `src/config.py` are removed by fixing the cause: SQLAlchemy models get `min-public-methods` lowered in `.pylintrc` with a comment, and `src/config.py` is deleted, since its job moves into the factory.

`requirements.txt` is rewritten as UTF-8 with LF line endings and lists only runtime dependencies actually imported: `dotenv`, `python-dotenv`, and `Flask-Login` leave because nothing uses them after this spec. Development tools move to a new `requirements-dev.txt` (`coverage`, `pylint`, `PyHamcrest`), which `./dev.sh install` installs.

### One Python version everywhere
The `Dockerfile` and the CI workflow move to `python:3.14-slim` and `python-version: '3.14'`, matching the pin in `README.md` and `backend/DEV_WORKFLOW.md`. Moving the documentation down to 3.11 was the alternative; I chose 3.14 because the docs are what developers install locally, and the gap is where "works on my machine" bugs come from. The risk is a dependency without 3.14 wheels; `psycopg2-binary` is the likely one, unverified, and the mitigation is that the CI image build fails on the pull request if a wheel is missing.

### The CI smoke test needs a credentials file
The `build-image` job of `.github/workflows/ci.yml` starts the container and polls `/login`. Once the factory refuses to start without credentials, that step fails unless CI provides a file, so the job writes a throwaway file with random keys and SQLite URLs to the runner and mounts it at `/run/secrets/ampara-credentials.json` with `docker run -v`. Baking a default file into the image was the alternative; I rejected it because an image that starts without being given secrets is exactly the fallback this spec removes. The Python version change of the previous section applies to the same workflow's `setup-python` step.

### Development seed
`./dev.sh seed` creates, through the provisioning service of `0002`, a tenant `tenant_demo` named "Escola Demonstração AMPARA" with one active account per profile (`gestor.demo@ampara.test`, `docente.demo@ampara.test`, `psicologa.demo@ampara.test`), two classes, and ten students with fictitious names. Their passwords are generated at seed time and written only to `~/.config/ampara/seed-accounts.json`, never printed and never committed. The seed refuses to run when `master_database_url` is not SQLite or a `localhost` URL, so it cannot write fictitious accounts into a real school's database. Until `0002` ships, this command is the acceptance criterion that remains open in this spec.

## Testing Decisions
Every test builds the app through `create_app` with an in-memory `FakeCredentials` double and SQLite in memory; no test reads a file from disk outside `test/fixtures/`.

- `backend/test/test_app.py`: the factory starts with injected credentials and refuses to start without them; page routes render; `GET /api/aprovar/1` returns 404; every response carries the security headers and API responses carry `Cache-Control: no-store`. The current `test_api_usuarios_and_aprovar` case is deleted with the behaviour they covered.
- `backend/test/test_adapters_credentials_file.py`: path resolution order, typed reads, `MissingCredentialError` naming the key without leaking values.
- `backend/test/test_routes_pages.py`: one test per page route, moved from `test_app.py`.
- `backend/test/test_models.py`: kept, updated for the model changes.

The smoke test is verified once by hand: run the image without the mount and confirm it exits with the missing-credential message, then with the mount and confirm `/login` answers 200.

## Out of Scope
- Multi-tenant models, login, MFA, and approval, specified in [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md).
- The authorization guard and role checks, specified in [todo/0011-access-management-backend.md](0011-access-management-backend.md).
- Any frontend change: the pages keep calling the same routes, apart from `/api/aprovar`, whose caller [todo/0009-unified-dashboard-hardening-frontend.md](0009-unified-dashboard-hardening-frontend.md) already replaces.
- A secrets manager service (AWS Secrets Manager, Vault); the file adapter is the seam where one would plug in.
- Database migrations for existing data; there is no production data worth migrating today.

## Further Notes
The purge of `credentials.json` from history covers every branch, but GitHub keeps the `refs/pull/*/head` refs of closed pull requests, which still reach the old commits; removing those, and the cached views of old commits, takes a request to GitHub Support. Every collaborator must re-clone, since a push from an old clone would bring the file back.

The `nginx.conf` at the repository root is not used by the `Dockerfile`, which serves everything through Gunicorn. It should either be deleted or wired in as a reverse proxy terminating TLS; until someone decides, it misleads readers about how production serves the pages.
