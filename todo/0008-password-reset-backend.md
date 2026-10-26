# Password Reset Backend

*This specification defines the backend of the "Esqueci minha senha" flow. Its frontend counterpart has already shipped and consumes the contract below (`frontend/public/recuperar_senha.html` and `frontend/public/redefinir_senha.html`, recorded in `frontend/test/test_password_reset.js`); this spec depends on the Master database and tenant routing from [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md).*

## Problem
Educators and mental health professionals who forget their password have no way back into App A.M.P.A.R.A. today. The login page links to a recovery page, but no endpoint exists behind it, and no one in the school can reset a password either: the Gestor Escolar can approve accounts, not change their credentials. A forgotten password currently means a locked-out professional in the middle of a school term.

## Business Vision and Purposes
Users must be able to regain access on their own, through the institutional e-mail they registered with, without involving school management or revealing which e-mails hold an account. Because the platform stores sensitive behavioral records about students, the recovery path must not become an easier way in than the password itself: links are single-use, short-lived, and never disclose whether an e-mail is registered.

## Solution
A user who forgot their password enters their e-mail on the recovery page and always sees the same confirmation, whether or not the e-mail exists. If it does, the backend e-mails a link to the reset page carrying a single-use token. On that page the user picks a new password; the backend validates the token, updates the password hash in the user's tenant database, and invalidates the token. The account status (`Pendente`, `Ativo`, `Suspenso`) is untouched, so a reset never bypasses manager approval: the login rules of `0002` still apply afterwards.

## User Stories
1. As a Docente or Equipe Multidisciplinar who forgot my password, I want to receive a reset link at my institutional e-mail, so that I can regain access without waiting for the school.
2. As a user holding a reset link, I want to define a new password and go back to the login page, so that I can resume my work.
3. As a Gestor Escolar, I want password resets to keep the account's approval status, so that a suspended or pending professional cannot use the flow to get in.
4. As the platform, I want the recovery request to answer identically for registered and unknown e-mails, so that nobody can enumerate which professionals use App A.M.P.A.R.A.

## Implementation Decisions

### Token storage in the Master database
Reset tokens live in the Master database, not in the tenant databases, because the request arrives with only an e-mail and the Master database is where `email_tenant_mappings` already resolves an e-mail to its tenant. We add one table:

```
password_reset_tokens:
  token_hash  VARCHAR(64)  primary key   -- SHA-256 hex of the raw token
  email       VARCHAR(150) not null, references email_tenant_mappings(email)
  expires_at  TIMESTAMP    not null      -- created_at + 30 minutes
  used_at     TIMESTAMP    null
  created_at  TIMESTAMP    not null
```

The raw token is `secrets.token_urlsafe(32)` and is only ever sent in the e-mail; the database keeps its SHA-256 hash, so a leaked Master database does not yield usable links. Issuing a new token for an e-mail deletes that e-mail's previous unused tokens, so only the latest link works.

### E-mail delivery through an adapter
Delivery goes through an `EmailAdapter` injected in the composition root, per [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md) and [ADR-0002](../adr/0002-infrastructure-adapters-encapsulation.md). Development and tests use `src/adapters/mock_email_adapter.py`, which records the messages it would send. The link has the fixed shape `{base_url}/redefinir_senha?token=<raw token>`, which is the route the frontend already serves. The e-mail body is user-facing copy and is written in Portuguese.

### Enumeration and abuse
The request endpoint returns the same status and body for registered, unknown, and rate-limited e-mails. An e-mail gets at most 3 tokens per hour; requests over the limit are dropped silently, still answering 200. The risk is a slower response for registered e-mails, since only those trigger a database write and an e-mail send, which leaks existence through timing; the mitigation is to hand the send to the adapter without waiting on the delivery itself.

### API Endpoints and Contracts

#### 1. Request a reset link
`POST /api/recuperar-senha`
- Request Body:
```json
{
  "email": "maria.silva@escola.gov.br"
}
```
- If `email` is missing or not a syntactically valid e-mail, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "Informe um e-mail válido."}`
- Otherwise return status 200 OK, regardless of whether the e-mail is registered:
```json
{
  "sucesso": true,
  "mensagem": "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
}
```

#### 2. Define the new password
`POST /api/redefinir-senha`
- Request Body:
```json
{
  "token": "raw_token_from_the_email_link",
  "senha": "NovaSenhaSegura123!"
}
```
- If `senha` has fewer than 8 characters, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "A senha deve ter pelo menos 8 caracteres."}`
- If the token is unknown, expired, or already used, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "Link inválido ou expirado. Solicite uma nova redefinição de senha."}`
- Otherwise resolve the tenant through `email_tenant_mappings`, store `generate_password_hash(senha)` in the tenant's `usuarios.senha_hash`, set `used_at`, and return status 200 OK with:
```json
{
  "sucesso": true,
  "mensagem": "Senha redefinida com sucesso."
}
```

## Testing Decisions
Both endpoints are exercised through the Flask test client against in-memory SQLite Master and tenant databases, with `MockEmailAdapter` capturing the outgoing link so tests can extract the raw token.
- `test/test_api_password_reset.py`: identical responses for registered and unknown e-mails; the 3-per-hour limit; the previous token dying when a new one is issued; expired, reused, and unknown tokens rejected; the new password accepted by `/api/login` and the old one refused; account status unchanged after a reset.
- `test/test_adapters_mock_email_adapter.py`: the adapter records recipient, subject, and link.

## Out of Scope
- Frontend pages, already shipped under `frontend/public/`.
- Real SMTP or transactional e-mail provider integration; only the mock adapter ships here.
- Password reset initiated by the Gestor Escolar or by the Admin AMPARA.
- Password strength rules beyond the 8-character minimum.
