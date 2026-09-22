# Multi-Tenant Authentication and Registration Backend

*This specification defines the backend implementation of the multi-tenant database routing and user onboarding flow, which is paired with the frontend specification in [todo/0003-multi-tenant-auth-registration-frontend.md](0003-multi-tenant-auth-registration-frontend.md).*

## Problem
Users of App A.M.P.A.R.A. (including teachers, school managers, and mental health professionals) have strict regulatory, security, and privacy requirements that mandate complete isolation of student and behavioral data between different school institutions. Under the current single-database structure, a breach or accidental exposure in one school could compromise sensitive personal information across all schools, violating Brazil's General Data Protection Law (LGPD - Lei Geral de Proteção de Dados) and breaking the core trust necessary for mental health and behavioral tracking in school environments.

## Business Vision and Purposes
App A.M.P.A.R.A. must enforce complete data sovereignty and cryptographic isolation for each educational institution using a database-per-tenant architecture. This guarantees that each school's records reside in a separate, isolated database file or schema, preventing cross-school data leakage. By introducing a multi-step user onboarding flow with manual approval by school managers, we ensure that only verified educators and professionals gain access to a school's private dashboard, protecting student privacy and complying with LGPD data-protection principles.

## Solution
We will implement a multi-tenant backend architecture driven by a global Master database and isolated school-specific tenant databases. When a user registers, they select their school (Step 1), enter personal details (Step 2), select their role (Docente or Equipe Multidisciplinar) and provide institutional credentials (Step 3), and finally set a password and accept the legal privacy and secrecy agreements (Step 4). The registration is saved inside that specific school's database with a status of "Pendente", while an entry is added to the Master database mapping their email to their tenant ID. When a user logs in, the backend transparently intercepts the login request, checks the Master database to find the correct tenant, establishes a database connection to that school's private database, validates the password hash, runs the Multi-Factor Authentication (MFA) check, and validates that the account has been approved by the school's Gestor Escolar before issuing a session token.

## User Stories
1. As a Docente or Equipe Multidisciplinar, I want to select my school and submit my registration details, so that my account can be routed to the correct isolated database and reviewed by my school's manager.
2. As a Gestor Escolar, I want to see a list of pending registration requests for my school, so that I can verify their credentials and approve their accounts to access our private dashboard.
3. As an active user, I want to log in using my email and password and receive a dynamic routing to my school's database, so that I can access my private dashboard securely and isolation is maintained transparently.
4. As an Admin AMPARA (Super Admin), I want to provision a new school tenant and create its initial school manager account, so that a new isolated database is created automatically and the school can begin onboarding its staff.

## Implementation Decisions

### Multi-Tenant Architecture & Composition Root
We will introduce a database routing module `src/database_router.py` that manages the active connections to school databases. It will interface with the Master database, which contains the global mappings. In alignment with ADR-0001, no database connection is resolved at import time; instead, the connection routing is dynamically initialized per request using a Flask request teardown or before-request hook. The database connection pools will be managed dynamically, with a connection manager caching active engines for each `tenant_id` up to a maximum limit of 100 concurrent active databases.

### Master Database Schema
The Master database is a global, shared database that contains two tables:
1. `schools`: `id` (VARCHAR(50), primary key), `name` (VARCHAR(200), unique, nullable=False), `db_url` (VARCHAR(500), nullable=False), `active` (BOOLEAN, default=True), `created_at` (TIMESTAMP).
2. `email_tenant_mappings`: `email` (VARCHAR(150), primary key), `tenant_id` (VARCHAR(50), foreign key referencing `schools(id)`), `created_at` (TIMESTAMP).

### Tenant Database Schema
Each school has an isolated database containing the tables specific to that school. The `usuarios` table in the tenant database will be modified to include:
- `id` (INTEGER, primary key)
- `nome` (VARCHAR(150), nullable=False)
- `email` (VARCHAR(150), unique, nullable=False)
- `telefone` (VARCHAR(20))
- `perfil` (VARCHAR(30), nullable=False) - Values: `gestor_escolar`, `docente`, `equipe_multidisciplinar`
- `matricula` (VARCHAR(50), nullable=False)
- `cargo` (VARCHAR(100), nullable=False)
- `registro_profissional` (VARCHAR(50), nullable=True) - For psychological or social-work certifications like CRP/CRESS
- `senha_hash` (TEXT, nullable=False)
- `status` (VARCHAR(20), default='Pendente') - Values: `Pendente`, `Ativo`, `Suspenso`
- `aceite_lgpd` (BOOLEAN, nullable=False)
- `aceite_sigilo` (BOOLEAN, nullable=False)
- `mfa_secret` (VARCHAR(100), nullable=True)
- `created_at` (TIMESTAMP)

### API Endpoints and Contracts

#### 1. List Active Schools
`GET /api/schools`
- Description: Retrieves a list of active schools from the Master database to populate Step 1 of the registration wizard.
- Response Status: 200 OK
- Response Body:
```json
{
  "schools": [
    {
      "id": "tenant_etec_01",
      "nome": "ETEC São Paulo"
    },
    {
      "id": "tenant_escola_joao_de_barro",
      "nome": "Escola Estadual João de Barro"
    }
  ]
}
```

#### 2. User Onboarding
`POST /api/cadastro`
- Description: Submits the onboarding request, performs validations, maps the email in the Master database, and inserts the user record as "Pendente" inside the target tenant's database.
- Request Body:
```json
{
  "escola_id": "tenant_escola_joao_de_barro",
  "nome": "Maria Silva",
  "email": "maria.silva@escola.gov.br",
  "telefone": "+55 11 99999-9999",
  "perfil": "docente",
  "matricula": "123456",
  "cargo": "Professor de Matemática",
  "registro_profissional": null,
  "senha": "SenhaSegura123!",
  "aceite_lgpd": true,
  "aceite_sigilo": true
}
```
- Validations:
  - If `aceite_lgpd` or `aceite_sigilo` is `false`, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "Você deve aceitar os termos da LGPD e o compromisso de sigilo para continuar."}`
  - Check in Master database `email_tenant_mappings` if `email` is already registered. If yes, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "E-mail já cadastrado."}`
- Actions:
  - Insert entry in Master DB `email_tenant_mappings`: `{"email": "maria.silva@escola.gov.br", "tenant_id": "tenant_escola_joao_de_barro"}`.
  - Dynamically connect to the database configured for `tenant_escola_joao_de_barro`.
  - Hash password using `werkzeug.security.generate_password_hash`.
  - Insert user record in school's `usuarios` table with `status="Pendente"`.
- Response Status: 201 Created
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Cadastro enviado para análise da gestão escolar."
}
```

#### 3. User Login (Phase 1: Routing & Password Verification)
`POST /api/login`
- Description: Processes login credentials. Queries the Master database to route the user, establishes a connection to the school's tenant database, verifies the password, and checks if Multi-Factor Authentication (MFA) is required.
- Request Body:
```json
{
  "email": "maria.silva@escola.gov.br",
  "senha": "SenhaSegura123!"
}
```
- Actions:
  - Query Master DB `email_tenant_mappings` by `email`. If not found, return status 401 Unauthorized with: `{"sucesso": false, "mensagem": "E-mail ou senha incorretos."}` (Generic message to prevent email enumeration).
  - Dynamically connect to the corresponding `tenant_id` database.
  - Retrieve the user record from the tenant's `usuarios` table.
  - Validate password using `check_password_hash`. If invalid, return status 401 Unauthorized with: `{"sucesso": false, "mensagem": "E-mail ou senha incorretos."}`
  - If MFA is required/enabled for the tenant:
    - Generate a temporary MFA session token and a 6-digit code. Send the code via the `MfaAdapter` (mocked in development, SMS/Email in production).
    - Return status 200 OK with: `{"sucesso": true, "mfa_required": true, "session_token": "temp_mfa_token_abc123"}`
  - If MFA is not required:
    - Check user status.
    - If `status == "Pendente"`, return status 403 Forbidden with: `{"sucesso": false, "status": "pendente", "mensagem": "Sua conta está em análise pela gestão escolar."}`
    - If `status == "Suspenso"`, return status 403 Forbidden with: `{"sucesso": false, "status": "suspenso", "mensagem": "Sua conta está suspensa. Entre em contato com a gestão escolar."}`
    - If `status == "Ativo"`, return status 200 OK with a signed JWT/Session and user profile:
```json
{
  "sucesso": true,
  "status": "ativo",
  "token": "signed_jwt_token_here",
  "usuario": {
    "id": 12,
    "nome": "Maria Silva",
    "email": "maria.silva@escola.gov.br",
    "perfil": "docente",
    "escola": "Escola Estadual João de Barro"
  }
}
```

#### 4. User Login (Phase 2: MFA Verification)
`POST /api/login/mfa-verify`
- Description: Verifies the 6-digit verification code submitted during login.
- Request Body:
```json
{
  "session_token": "temp_mfa_token_abc123",
  "mfa_code": "123456"
}
```
- Actions:
  - Validate the `session_token` and `mfa_code`. If invalid or expired (over 5 minutes), return status 401 Unauthorized with: `{"sucesso": false, "mensagem": "Código inválido ou expirado."}`
  - Check the user's status in the tenant database. If status is `Pendente` or `Suspenso`, return 403 Forbidden.
  - If status is `Ativo`, return status 200 OK with the final signed JWT and user profile.

#### 5. List Pending Users (School Management)
`GET /api/gestao/pendentes`
- Description: Retrieves all user accounts with status "Pendente" within the logged-in manager's tenant database.
- Headers: `Authorization: Bearer <manager_jwt_token>`
- Response Status: 200 OK
- Response Body:
```json
{
  "pendentes": [
    {
      "id": 12,
      "nome": "Maria Silva",
      "email": "maria.silva@escola.gov.br",
      "telefone": "+55 11 99999-9999",
      "perfil": "docente",
      "matricula": "123456",
      "cargo": "Professor de Matemática",
      "created_at": "2026-09-12T14:32:00Z"
    }
  ]
}
```

#### 6. Approve User Account (School Management)
`POST /api/gestao/usuarios/<int:usuario_id>/aprovar`
- Description: Approves a pending user registration, updating their status to "Ativo" in the school's local tenant database.
- Headers: `Authorization: Bearer <manager_jwt_token>`
- Response Status: 200 OK
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Usuário aprovado com sucesso."
}
```

#### 7. Super Admin: Provision New School
`POST /api/super-admin/escolas`
- Description: Adds a new school to the Master DB, provisions a new SQLite database file (or PostgreSQL schema), and creates the initial Gestor Escolar account in the new tenant's database.
- Headers: `Authorization: Bearer <super_admin_jwt_token>`
- Request Body:
```json
{
  "nome_escola": "Escola Estadual João de Barro",
  "escola_id": "tenant_escola_joao_de_barro",
  "gestor": {
    "nome": "Diretor João",
    "email": "joao.diretor@escola.gov.br",
    "telefone": "+55 11 97777-7777",
    "matricula": "111222",
    "cargo": "Diretor Escolar",
    "senha": "SenhaGestor123!"
  }
}
```
- Actions:
  - Insert row in Master DB `schools`.
  - Create isolated database file or schema for `tenant_escola_joao_de_barro` and run DDL scripts (`usuario.sql` or equivalent) to set up tables.
  - Insert row in Master DB `email_tenant_mappings`: `{"email": "joao.diretor@escola.gov.br", "tenant_id": "tenant_escola_joao_de_barro"}`.
  - Insert row in new school's DB `usuarios` table with `status="Ativo"`, `perfil="gestor_escolar"`, `aceite_lgpd=true`, `aceite_sigilo=true`.
- Response Status: 201 Created
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Nova escola provisionada e gestor cadastrado com sucesso."
}
```

## Testing Decisions
We will implement extensive unit and integration tests using Python's `unittest` framework to verify all aspects of the multi-tenant routing, registration, and authentication logic. All test modules will follow the project's flat naming convention under `backend/test/` with PyHamcrest matchers.
- `test/test_database_router.py`: Tests that `database_router` correctly resolves the connection string based on email and establishes isolated connections, with connection pooling limits strictly checked.
- `test/test_api_cadastro.py`: Tests the `/api/cadastro` onboarding endpoint. Verifies that duplicate email mapping is blocked in the Master DB, terms acceptance is validated, and pending records are correctly inserted only inside the target tenant's database.
- `test/test_api_login.py`: Tests the `/api/login` multi-tenant routing, credentials check, and status blocking. Verifies that a user with "Pendente" status cannot log in, and that a user with "Ativo" status receives a valid JWT token.
- `test/test_api_gestao.py`: Tests the list of pending users and account approval. Verifies that only authenticated managers can approve users and that approved users can successfully log in.

## Out of Scope
- Frontend UI components, registration wizard multi-step forms, and CSS styling (which are specified in [todo/0003-multi-tenant-auth-registration-frontend.md](0003-multi-tenant-auth-registration-frontend.md)).
- Automatic database schema migrations for existing tenants.
- Dynamic password reset and email token verification flows.
- Real SMS/Email gateway integrations; a mock adapter class `src/adapters/mock_mfa_adapter.py` will be used to simulate MFA code delivery in development and tests.

## Further Notes
The integration with the federal Single Sign-On (SSO) service (Gov.br) has been removed from this scope to reduce initial setup complexity, but the routing design in `database_router.py` is modular and prepared to support SSO providers linked directly to the Master DB mapping in the future.
