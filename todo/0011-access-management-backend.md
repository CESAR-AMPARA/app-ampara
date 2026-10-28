# Access Management Backend

*Phase: MVP #1 (backbone). Story-map card: "As an admin, I want to manage access permissions so that only authorized people see sensitive data" (value 500, 5 points).*

*This specification defines the backend of request authorization and of the school team's account lifecycle. Its frontend counterpart is [todo/0012-access-management-frontend.md](0012-access-management-frontend.md), which can be built against this contract before it ships. It depends on the JWT issued by [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md) and the composition root of [todo/0010-backend-foundation-and-delivery-hardening-backend.md](0010-backend-foundation-and-delivery-hardening-backend.md).*

## Problem
The specs that make up the MVP each say "accessible only to the coordinator" or "Headers: `Authorization: Bearer <token>`", but none defines how a request proves who it comes from, what happens when the token is missing or expired, or what happens to a professional the school no longer wants on the platform. [0002](0002-multi-tenant-auth-registration-backend.md) lets a Gestor Escolar approve a pending account and nothing else: there is no way to turn down a registration from someone who does not work at the school, to suspend a teacher who left, or to bring back a professional returning from leave. A token issued to a suspended teacher keeps working until it expires, so suspension, once it exists, would not take effect for hours.

The coordinator also lost the team overview. `0009` drops the "Total de Profissionais" and "Credenciados / Ativos" counters because `GET /api/gestao/pendentes` returns only pending accounts, so the coordinator cannot see who currently has access to student data.

## Business Vision and Purposes
Only people the school vouches for may read mental-health observations about its students, and the school must be able to withdraw that access the same day someone leaves. This spec gives the Gestor Escolar the full lifecycle (approve, refuse, suspend, reactivate) and a list of everyone with access, and it gives every endpoint of the product one shared, tested way to enforce who may call it.

## Solution
Every API request is checked by a single guard that validates the session token, reloads the caller's account from their school's database, and refuses the request when the account is no longer active or its profile is not allowed on that route. The Gestor Escolar sees the whole school team with each person's status, refuses pending registrations, suspends active accounts, and reactivates suspended ones. Suspension takes effect on the suspended person's next request. A school always keeps at least one active Gestor Escolar.

## User Stories
1. As a Gestor Escolar, I want to see everyone registered in my school with their profile and status, so that I know who can read student data.
2. As a Gestor Escolar, I want to refuse a pending registration, so that someone who does not work here never gets access and their data does not stay stored.
3. As a Gestor Escolar, I want to suspend a professional's access immediately, so that a person who left the school cannot read student records from a session they already had open.
4. As a Gestor Escolar, I want to reactivate a suspended professional, so that they resume work without registering again.
5. As any professional, I want an expired session to send me back to the login page with a clear message, so that I know why my action did not go through.
6. As the platform, I want every endpoint to enforce profiles through the same guard, so that a missing check in one route does not expose student data.

## Implementation Decisions

### The request guard
`src/auth/guard.py` defines the decorator `require_profile(*perfis)`. It reads `Authorization: Bearer <jwt>`, verifies the signature with `jwt_signing_key` from the credentials adapter of `0010` and the expiry claim, opens the tenant named by the `tenant_id` claim through `database_router`, and loads the user named by `sub`. It then sets `g.usuario` (with `id`, `nome`, `perfil`) and `g.tenant_id`, and calls the view. The claims are the ones `0002` issues:

```json
{
  "sub": 12,
  "tenant_id": "tenant_escola_joao_de_barro",
  "perfil": "docente",
  "iat": 1790000000,
  "exp": 1790028800
}
```

The guard returns 401 when the header is missing, the signature or expiry fails, the user no longer exists, or the user's `status` is not `Ativo`:

```json
{"sucesso": false, "mensagem": "Sessão expirada. Faça login novamente."}
```

It returns 403 when the user is active but their profile, read from the database and not from the token, is not in `perfis`:

```json
{"sucesso": false, "mensagem": "Você não tem permissão para acessar este recurso."}
```

Reading status and profile from the database on every request costs one primary-key lookup per request, under 1 ms on the tenant database, and it is what makes suspension immediate. Keeping the token as the only source of truth and adding a revocation list was the alternative; I rejected it because the list would itself be a per-request lookup, in the Master database instead of the tenant one, and it would still miss a profile change.

A suspended user gets 401 rather than 403 on purpose: the frontend's `apiRequest` already treats 401 as "session over" and sends the user to `/login`, where the login of `0002` explains the suspension.

### Routes the guard protects
Every route under `/api/` except `GET /api/schools`, `POST /api/cadastro`, `POST /api/login`, `POST /api/login/mfa-verify`, `POST /api/recuperar-senha`, and `POST /api/redefinir-senha` carries `require_profile`. `GET /api/usuarios`, extended by [0006](0006-referral-queue-management-backend.md), takes `require_profile("gestor_escolar")`. A test walks `app.url_map` and fails when an `/api/` route outside the public list lacks the guard, so a new endpoint cannot ship unprotected by omission.

### Team listing
`GET /api/gestao/equipe` — `gestor_escolar` only. Optional `status` (`Pendente`, `Ativo`, `Suspenso`) and `perfil` filters.

```json
{
  "resumo": {"total": 18, "ativos": 14, "pendentes": 3, "suspensos": 1},
  "usuarios": [
    {
      "id": 12,
      "nome": "Maria Silva",
      "email": "maria.silva@escola.gov.br",
      "perfil": "docente",
      "cargo": "Professora de Matemática",
      "registro_profissional": null,
      "status": "Ativo",
      "created_at": "2026-09-12T14:32:00Z",
      "status_alterado_em": "2026-09-13T09:00:00Z"
    }
  ]
}
```

`resumo` counts the whole school regardless of the filters, so the counters stay stable while the coordinator filters the table. `GET /api/gestao/pendentes` from `0002` stays as it is; the frontend may use either.

### Lifecycle transitions
All four routes are `gestor_escolar` only, take no body unless stated, return 404 with `{"sucesso": false, "mensagem": "Usuário não encontrado."}` for an unknown id, and answer 200 with `{"sucesso": true, "mensagem": "<message below>"}`. A transition from the wrong state returns 409 with `{"sucesso": false, "mensagem": "Esta ação não se aplica ao status atual do usuário."}`.

- `POST /api/gestao/usuarios/<id>/aprovar` (from `0002`, unchanged): `Pendente` to `Ativo`, "Usuário aprovado com sucesso."
- `POST /api/gestao/usuarios/<id>/recusar`: `Pendente` only. Deletes the user row from the tenant and the e-mail's row from `email_tenant_mappings` in the Master database, in that order, so the person can register again with corrected data. "Solicitação de cadastro recusada."
- `POST /api/gestao/usuarios/<id>/suspender`: `Ativo` to `Suspenso`. "Acesso do usuário suspenso."
- `POST /api/gestao/usuarios/<id>/reativar`: `Suspenso` to `Ativo`. "Acesso do usuário reativado."

Refusal deletes instead of adding a `Recusado` status because the person never became a user of the platform, and keeping their name, phone, and registration number would hold personal data with no purpose, which the LGPD's necessity principle forbids. The cost is that a refused e-mail can try again immediately; the Gestor Escolar can simply refuse again.

Two guards protect the school from locking itself out. A Gestor Escolar cannot suspend themselves, 409 with `{"sucesso": false, "mensagem": "Você não pode suspender o seu próprio acesso."}`, and the last `Ativo` Gestor Escolar of a tenant cannot be suspended by anyone, 409 with `{"sucesso": false, "mensagem": "A escola precisa manter ao menos um gestor ativo."}`. Recovering a school whose only manager left is an Admin AMPARA task through the provisioning of `0002`.

Every transition writes `status_alterado_em` and `status_alterado_por_id`, two new nullable columns in the tenant `usuarios` table, so the team list can show when access changed and who changed it, until the audit log of [0027](0027-access-audit-log-backend.md) records it in full.

### Suspension and referrals
Suspending a member of the `equipe_multidisciplinar` does not reassign their referrals. Their open cases stay with them and the coordinator's queue of `0006` keeps showing the `designado`; the team list response adds `casos_abertos` (count of `encaminhamentos` with that `designado_id` in `"Aguardando Triagem"` or `"Em Atendimento"`) for that profile, so the frontend can warn before suspending. Automatic reassignment was the alternative; I rejected it because choosing the next professional for a student in distress is a clinical judgement the coordinator makes, not a rule.

## Testing Decisions
The guard and the routes are exercised through the Flask test client against in-memory SQLite Master and tenant databases built by `create_app` with doubled credentials, signing tokens with a test key.

- `backend/test/test_auth_guard.py`: missing, malformed, expired, and wrongly signed tokens give 401; a `Suspenso` user with a valid token gives 401; a profile changed in the database after the token was issued is enforced from the database; a disallowed profile gives 403; `g.usuario` and `g.tenant_id` are set for the view.
- `backend/test/test_routes_guard_coverage.py`: walks `app.url_map` and fails for any `/api/` route outside the public list without the guard.
- `backend/test/test_api_gestao_equipe.py`: listing with and without filters, `resumo` unaffected by filters, `casos_abertos` for professionals, profiles other than `gestor_escolar` get 403.
- `backend/test/test_api_gestao_usuarios_lifecycle.py`: each transition from each state; refusal removes both the tenant row and the Master mapping and lets the e-mail register again; self-suspension and last-manager suspension refused; a suspended user's next request gets 401 and reactivation restores access.

## Out of Scope
- The team management screen, specified in [todo/0012-access-management-frontend.md](0012-access-management-frontend.md).
- Changing a user's profile after approval; a professional changing role registers again.
- Fine-grained permissions beyond the three profiles; which students each profile sees is [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md).
- Notifying the person by e-mail when they are approved, refused, or suspended.
- Server-side logout and token revocation lists.

## Further Notes
The story-map card names an "admin". In the school this is the Gestor Escolar, who already approves accounts in `0002`; the cross-school Admin AMPARA only provisions schools and their first manager. If the product owner meant a separate in-school role above the coordinator, that is a fourth profile and a contract change to `0002`.
