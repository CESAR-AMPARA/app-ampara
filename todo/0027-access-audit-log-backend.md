# Access Audit Log Backend

*Phase: Increment #2 (walking skeleton). Story-map card: "As an admin, I want an audit log to know who accessed a given student's information" (value 300, 3 points).*

*This specification defines the backend of the append-only access audit log: the table, the `AuditLogger` every student-data route calls, the query route for the coordinator, and retention. Its frontend counterpart is [todo/0028-access-audit-log-frontend.md](0028-access-audit-log-frontend.md), which can be built against this contract before it ships. It depends on the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md) and the scope policy of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md), and instruments the routes of [todo/0004-student-class-management-backend.md](0004-student-class-management-backend.md), [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md), [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), and [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md). Every later spec that reads or writes student data calls `AuditLogger.registrar` as defined here.*

## Problem
When a family asks the school who has read their child's records, or when a coordinator suspects that a teacher has been opening the history of a student they do not teach, nobody can answer. The scope policy of [0013](0013-teacher-class-assignment-backend.md) limits who *can* read a student, but nothing records who *did*. The specs already written assume an answer exists: `0013` names the audit log as the mitigation for psychologists' accumulating access, [0011](0011-access-management-backend.md) expects it to record account changes in full, and several later specs call an `AuditLogger` that has not been defined.

## Business Vision and Purposes
Accountability is a principle of the General Data Protection Law (LGPD, art. 6, X) and, for records about adolescents' mental health, it is the safeguard that makes broad internal access acceptable: teachers and psychologists can be trusted with what they need because every access leaves a trace the school can inspect. The log must answer one question quickly, "who accessed this student, when, and what did they do", and it must be impossible for the people it watches, including the coordinator who reads it, to alter.

## Solution
Every request that reads or writes a student's information writes one entry per student involved: who, what action, which record, which student, from which IP address, and when. Denied attempts on students outside the caller's scope are recorded too. The Gestor Escolar can search the log by student, by professional, by action, and by period; nobody else can read it, and nobody, including the Gestor Escolar, can edit or delete an entry. Reading the log is itself logged. Entries are kept for 5 years and then deleted by a scheduled purge.

## User Stories
1. As a Gestor Escolar, I want to list every access to a given student's records, so that I can answer a family or investigate a concern.
2. As a Gestor Escolar, I want to list everything a given professional accessed in a period, so that I can check that a teacher stays within their classes.
3. As a Gestor Escolar, I want attempts to open a student outside someone's scope to appear in the log, so that I see probing as well as successful reads.
4. As the school, I want the log to be impossible to edit or delete within its retention period, so that it holds as evidence.
5. As the school, I want old entries deleted after the retention period, so that we do not keep staff IP addresses and access traces longer than needed.

## Implementation Decisions

### The `auditoria_acessos` table
```
auditoria_acessos:
  id               INTEGER      primary key
  usuario_id       INTEGER      not null, references usuarios(id)   -- who acted
  acao             VARCHAR(40)  not null   -- a key of src/audit/actions.py
  recurso          VARCHAR(80)  not null   -- "<kind>:<id>" or "<kind>", e.g. "estudante:25", "observacao:311", "auditoria"
  estudante_id     INTEGER      null, references estudante(id)
  usuario_alvo_id  INTEGER      null       -- the account acted upon, for the lifecycle routes of 0011; not a foreign key
  ip               VARCHAR(45)  not null   -- long enough for IPv6
  created_at       TIMESTAMP    not null
  index (estudante_id, created_at)
  index (usuario_id, created_at)
  index (created_at)
```

The table lives in each tenant database, next to the data it describes, so a school's log is isolated like its records and is deleted with the tenant. `usuario_alvo_id` is a plain integer because refusing a registration in `0011` deletes the user row, and the entry recording that refusal must survive it.

### Append-only, enforced twice
The model refuses updates and deletes by raising on `before_update` and `before_delete`, and the migration installs database triggers that refuse them regardless of the client:

```sql
CREATE TRIGGER auditoria_sem_alteracao BEFORE UPDATE ON auditoria_acessos
BEGIN SELECT RAISE(ABORT, 'auditoria_acessos is append-only'); END;

CREATE TRIGGER auditoria_sem_exclusao BEFORE DELETE ON auditoria_acessos
WHEN OLD.created_at > datetime('now', '-5 years')
BEGIN SELECT RAISE(ABORT, 'auditoria_acessos rows are retained for 5 years'); END;
```

That is the SQLite form used in tests and development; on PostgreSQL the migration installs a trigger function with the same two rules. The delete trigger lets only the retention purge through, since it is the one delete whose rows are past the period. The triggers protect against application bugs and against someone editing rows through a database console with the application's credentials; they do not protect against a database administrator who drops them. Stronger guarantees, a separate database role without `TRIGGER` privilege or shipping entries to write-once storage, are noted in _Further Notes_.

### The logger
`src/audit/logger.py` defines:

```python
class AuditLogger:
    def __init__(self, session_provider, actor_provider, clock): ...

    def registrar(self, acao: str, recurso: str, estudante_id: int | None = None,
                  usuario_alvo_id: int | None = None) -> None:
        """Append one audit entry to the current request's tenant session."""
```

`actor_provider` returns the acting user's id and IP address; in `create_app` it is `flask_actor` from `src/audit/flask_actor.py`, which reads `g.usuario` set by the guard of `0011` and `request.remote_addr`, and tests inject a fixed actor. Routes therefore pass only what they know, the action, the resource, and the student, which is how [0019](0019-observation-severity-review-backend.md), [0021](0021-risk-classification-alerts-backend.md), and the specs after them already call it.

`registrar` raises `ValueError` for an `acao` that is not a key of `ACOES` in `src/audit/actions.py`, the registry mapping each action to the Portuguese description the coordinator reads:

```python
ACOES = {
    "listar_estudantes": "Consultou a lista de estudantes",
    "ler_historico": "Visualizou o histórico do estudante",
    "acesso_negado": "Tentou acessar estudante fora do seu escopo",
    # ...one entry per action in the table below and in later specs
}
```

A registry instead of free strings means the screen never shows a raw key, and a typo in a route fails its tests instead of writing an action nobody can filter by. Later specs add their actions to this dictionary.

The IP address is `request.remote_addr`. Today the `Dockerfile` serves Gunicorn directly on port 80, so that is the client's address. If a reverse proxy is put in front, as the `nginx.conf` question in [0010](0010-backend-foundation-and-delivery-hardening-backend.md) contemplates, `create_app` must wrap the app in Werkzeug's `ProxyFix` with `x_for=1`, or every entry will carry the proxy's address; a test pins that behaviour behind a configuration flag.

### Fail closed
An access that cannot be logged does not happen. The entries are added to the same tenant session as the request's work. A write route commits them in the same transaction as its write, so a rolled-back write leaves no phantom entry. A read route commits them before building its response, and if that commit fails, `AuditWriteError` is raised and an error handler answers 500 with `{"sucesso": false, "mensagem": "Não foi possível registrar o acesso. Tente novamente."}`, without the data. The availability cost is small: the entry is one insert into the same database that is about to serve the read, so a failure here almost always means the read would have failed too.

### What is logged
The rule is one entry per student whose records a request returns or changes, and one entry per request for listings that return only identification and the risk level. Opening a history, a referral, an export, or an attachment is the access a family asks about, so it is recorded per student. A roster of a class of 34 shows names, classes, and risk levels to someone already entitled to them; recording 34 entries every time a teacher opens their class would multiply the volume by roughly 30 without answering any question anyone asks. A request that returns no student data, such as an alert poll with nothing new, writes nothing.

Routes instrumented by this spec:

| Route | `acao` | `recurso` | `estudante_id` |
| --- | --- | --- | --- |
| `GET /api/estudantes` (`0004`, `0013`) | `listar_estudantes` | `estudantes` | none, one entry per request |
| `GET /api/estudantes/<id>/historico` (`0015`) | `ler_historico` | `estudante:<id>` | the student |
| `POST /api/observacoes` (`0015`) | `registrar_observacao` | `observacao:<id>` | the student |
| `POST /api/gestao/ocorrencias` (`0015`) | `registrar_ocorrencia` | `ocorrencia:<id>` | the student, none for a class |
| `GET /api/gestao/ocorrencias` (`0015`) | `ler_ocorrencias` | `ocorrencia:<id>` | each student-targeted item |
| `POST /api/encaminhamentos` (`0006`) | `registrar_encaminhamento` | `encaminhamento:<id>` | the student |
| `GET /api/gestao/encaminhamentos` (`0006`) | `ler_fila_encaminhamentos` | `encaminhamento:<id>` | each item |
| `PUT /api/gestao/encaminhamentos/<id>` (`0006`) | `triar_encaminhamento` | `encaminhamento:<id>` | the student |
| `GET /api/multidisciplinar/encaminhamentos` (`0006`) | `ler_casos_designados` | `encaminhamento:<id>` | each item |
| `PUT /api/multidisciplinar/encaminhamentos/<id>/status` (`0006`) | `alterar_status_encaminhamento` | `encaminhamento:<id>` | the student |
| `GET /api/gestao/estudantes/<id>/exportar` (`0017`) | `exportar_estudante` | `estudante:<id>` | the student |
| `POST /api/gestao/estudantes/<id>/anonimizar` (`0017`) | `anonimizar_estudante` | `estudante:<id>` | the student |
| `POST /api/gestao/usuarios/<id>/aprovar` and the three other lifecycle routes (`0011`) | `aprovar_usuario`, `recusar_usuario`, `suspender_usuario`, `reativar_usuario` | `usuario:<id>` | none; `usuario_alvo_id` set |
| `GET /api/gestao/auditoria` (this spec) | `ler_auditoria` | `auditoria` | the filtered student, if any |

The routes of `0019` and `0021` are listed in those specs; when either ships before this one, this spec adds their calls. Any route that answers 404 because `ScopePolicy` of `0013` excluded an existing student writes `acesso_negado` with the requested `recurso` and that `estudante_id`, committed even though the response is an error. A 404 for an id that does not exist writes nothing, since there is no student to attach it to.

Deliberately not logged: `GET /api/turmas` (class names and counts), the aggregate routes of [0023](0023-emotional-climate-dashboards-backend.md) and the JSON preview of [0025](0025-monthly-climate-report-export-backend.md) (no individual data after suppression), and login. Login and logout are account events, not access to student data; a login history is a separate feature.

### Every route decides
`src/audit/route_registry.py` lists every `/api/` route as either audited, with its actions, or unaudited, with a one-line reason. `backend/test/test_audit_route_registry.py` walks `app.url_map` and fails for a route in neither list, the same pattern `0011` uses for the guard. A new endpoint therefore cannot reach student data without its author deciding, in the diff a reviewer reads, whether it is audited.

### Query route
`GET /api/gestao/auditoria` — `gestor_escolar` only. Parameters, all optional: `estudante_id`, `usuario_id`, `acao` (a key of `ACOES`), `de` and `ate` (`YYYY-MM-DD`, America/Sao_Paulo, inclusive; default the last 30 days), `pagina` (50 entries per page). Newest first.

```json
{
  "registros": [
    {
      "id": 90211,
      "created_at": "2026-10-26T13:58:02Z",
      "usuario": {"id": 12, "nome": "Maria Silva", "perfil": "docente"},
      "acao": "ler_historico",
      "acao_descricao": "Visualizou o histórico do estudante",
      "recurso": "estudante:25",
      "estudante": {"id": 25, "nome": "Lucas Mendes de Oliveira", "turma": "1º Ano A", "anonimizado": false},
      "usuario_alvo": null,
      "ip": "177.12.34.56"
    }
  ],
  "pagina": 1,
  "por_pagina": 50,
  "total": 1,
  "retencao_anos": 5
}
```

`estudante` is `null` when the entry has no student; for an anonymized student it carries the name [0017](0017-lgpd-privacy-compliance-backend.md) left, "Estudante anonimizado", with `anonimizado: true`. `usuario_alvo` is `{"id": 14, "nome": "João Lima"}` for lifecycle entries, or `{"id": 14, "nome": null}` when the account was refused and deleted.

Errors, all 400 with `"sucesso": false`:

- `"Filtro de auditoria inválido."` for a non-integer id, an unknown `acao`, or a page below 1.
- `"Datas inválidas. Use o formato AAAA-MM-DD."`
- `"A data inicial deve ser anterior à data final."`
- `"O período máximo de consulta é de 366 dias."`

`GET /api/gestao/auditoria/acoes` — `gestor_escolar` only — returns the registry for the filter control:

```json
{"acoes": [{"acao": "ler_historico", "descricao": "Visualizou o histórico do estudante"}]}
```

Only the Gestor Escolar reads the log, which also means each coordinator's own accesses are visible to every other coordinator of the school. The Admin AMPARA (`super_admin`) has no access: the log is the school's record of its own staff, and the platform operator reading it would itself be an access the school did not authorize.

### Retention and purge
Entries are kept for 5 years from `created_at` and then deleted. The Marco Civil da Internet (Law 12,965/2014, art. 15) sets 6 months as the minimum for an application's access records, so it is a floor rather than a guide. Five years is my choice to outlast a student's three years of high school plus the three-year limitation period for civil damage claims (Civil Code, art. 206, §3, V), which, for a student under 16, only starts running when they turn 16. That reasoning is mine, not legal advice, and _Further Notes_ asks for it to be confirmed.

`src/audit/purge.py` defines `AuditPurge(tenant_sessions, clock)`, which deletes entries older than 5 years in every tenant, in batches of 10,000 rows so one tenant never holds a long lock. It runs as `./dev.sh audit-purge`, a Flask CLI command, and production schedules it daily on the host. Until the schedule exists, entries simply live longer than the period, and the first run catches up.

Volume is modest. At an estimated 50 logged entries per professional per school day, 60 professionals, and 200 school days, a school writes about 600,000 entries a year and holds about 3 million at the 5-year steady state, roughly 500 MB with its indexes on PostgreSQL. These are estimates, not measurements; the indexes keep the coordinator's queries, which always filter by student or user and a date range, on index scans.

## Testing Decisions
Exercised with in-memory SQLite tenant databases built by `create_app`, with an injected fixed actor and clock.

- `backend/test/test_audit_logger.py`: an entry per call with actor and time; unknown `acao` raises; fail-closed behaviour when the commit fails, returning the 500 body and no data.
- `backend/test/test_audit_actions.py`: every key has a non-empty Portuguese description.
- `backend/test/test_audit_flask_actor.py`: user id from `g.usuario`; IP from `remote_addr`, and from `X-Forwarded-For` only when the proxy flag is on.
- `backend/test/test_models_auditoria.py`: model update and delete refused; the database triggers refuse an `UPDATE` and a `DELETE` of a recent row issued as raw SQL, and allow a `DELETE` of a row older than 5 years.
- `backend/test/test_audit_purge.py`: only rows past the period go, across several tenants, in batches.
- `backend/test/test_audit_route_registry.py`: every `/api/` route is in the audited or unaudited list.
- `backend/test/test_routes_auditoria.py`: one test per instrumented route asserting the entries it writes; `acesso_negado` for an out-of-scope student and nothing for an unknown id; the query's filters, default period, pagination, anonymized and refused-user rendering, and every validation message; `ler_auditoria` written by the query; `docente`, `equipe_multidisciplinar`, and `super_admin` refused.

## Out of Scope
- The audit screen, specified in [todo/0028-access-audit-log-frontend.md](0028-access-audit-log-frontend.md).
- Login and logout history.
- Alerts on suspicious access patterns, such as a teacher opening dozens of histories in an hour; the log makes them possible later.
- Exporting the log as a file.
- Logging the content returned; an entry says what was accessed, not what it contained.

## Further Notes
The 5-year retention must be confirmed by each school's encarregado, and by the education department for public schools, which may have its own document retention table. Changing it is one constant and the purge trigger's interval.

The triggers stop the application and anyone using its credentials, but not a database administrator. If a school or an auditor requires a log nobody can rewrite, the next step is a dedicated database role for the application without the right to drop triggers, or shipping each entry to write-once storage such as an object-lock bucket; both are deployment work outside this spec.

In a school with a single Gestor Escolar, that person's own accesses are reviewed by nobody but themselves. Whether the encarregado, or an Admin AMPARA acting on the school's written request, should have read access is a product and legal decision.
