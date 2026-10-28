# Risk Classification and Alerts Backend

*Phase: Increment #2 (walking skeleton). Story-map cards: "As a Teacher, I want to receive real-time alerts when a student in my class shows multiple risk signals" (value 800, 5 points); "As a user, I want to filter dashboards by risk category (mild, moderate, critical) to prioritize actions" (value 300, 2 points).*

*This specification defines the backend of the student risk classification, the alerts it raises, and the risk filter on the roster listings. Its frontend counterpart is [todo/0022-risk-classification-alerts-frontend.md](0022-risk-classification-alerts-frontend.md), which can be built against this contract before it ships. It depends on the observations of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), the effective severity of [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md), the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md), and the scope policy of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md).*

## Problem
Each teacher sees a student for a few hours a week. When the Portuguese teacher records sadness on Monday, the math teacher records apathy on Wednesday, and the PE teacher records agitation on Friday, each record looks minor to its author, and nobody sees the three together unless they open that student's history. The signal that matters, several adults noticing something within days of each other, is exactly the one the platform holds and nobody reads.

The coordinator has the same problem at school scale. Rosters list students alphabetically with no indication of who needs attention first, so prioritizing means reading every history.

## Business Vision and Purposes
The platform exists to catch a student's deterioration before it becomes a crisis. A transparent rule that combines the records of every teacher into a risk level, and that tells the right adults within a minute when a student crosses into a higher level, turns scattered notes into a prompt to act. The same level, exposed as a filter on every roster, lets teachers and the coordinator start their day with the students who need them.

## Solution
Every student has a risk level, `"leve"`, `"moderado"`, or `"critico"`, computed by a fixed, documented rule from the observations of the last 14 days. The level appears next to the student in rosters and in the history header, with the reason in plain Portuguese. When a new observation, or a coordinator's review, moves a student up a level, the platform records an alert: the coordinator is alerted when a student reaches `"moderado"` or `"critico"`, and the teachers of the student's class are alerted when the student reaches `"critico"`, the level that by construction requires more than one signal. Open dashboards check for new alerts every 60 seconds. Rosters and class lists can be filtered by level.

The classifier is a deterministic rule written in code, not a machine-learning model and not AI. The same records always produce the same level, every level comes with the arithmetic that produced it, and nothing is trained on student data. Model-based classification belongs to Increments #3 to N and, if it comes, replaces this rule behind the same interface.

## User Stories
1. As a Docente, I want to be alerted within a minute when a student of my class accumulates several risk signals from different records, so that I can act on a pattern I could not see alone.
2. As a Coordenador Pedagógico, I want to be alerted when any student reaches moderate or critical risk, so that I triage before it escalates.
3. As any professional, I want each student's risk level and the reason for it, so that I trust the level and know what to look at.
4. As a Docente or Coordenador Pedagógico, I want to filter classes and students by risk level, so that I start with those who need attention.
5. As a user, I want alerts I have read to stop asking for my attention, so that new ones stand out.

## Implementation Decisions

### The classification rule
The rule is pinned here in full, because teachers and the coordinator will be told how it works, and a level nobody can explain will not be trusted.

1. **Window.** Observations with `created_at` in the 14 × 24 hours before the evaluation instant. Coordination occurrences and referrals do not count; they are reactions to risk, not signals of it.
2. **Effective severity.** `effective_severity(observacao)` of `0019`: the coordinator's `gravidade_validada` when reviewed, the teacher's `gravidade` otherwise.
3. **One signal per teacher per day.** Observations by the same `autor_id` on the same local date (America/Sao_Paulo) collapse into one signal carrying the highest effective severity among them.
4. **Points.** A signal is worth 4 points if `"Alta"`, 2 if `"Média"`, 1 if `"Baixa"`. The `"Baixa"` points of a window are capped at 3 in total.
5. **Level.** `"critico"` when the score is 8 or more; `"moderado"` from 4 to 7; `"leve"` below 4, which includes students with no observations at all.

Worked examples, which become test cases verbatim:

| Signals in the last 14 days | Score | Level |
| --- | --- | --- |
| none | 0 | `leve` |
| 1 `Alta` | 4 | `moderado` |
| 2 `Média` from different teachers or days | 4 | `moderado` |
| 2 `Média` from the same teacher on the same day | 2 | `leve` |
| 6 `Baixa` on different days | 3 | `leve` |
| 6 `Baixa` + 1 `Média` | 5 | `moderado` |
| 1 `Alta` + 2 `Média` | 8 | `critico` |
| 2 `Alta` from two teachers | 8 | `critico` |
| 3 `Média` + 2 `Baixa` | 8 | `critico` |

Every number above is a starting calibration, not clinical evidence, and I chose each one for a stated reason. Fourteen days is two school weeks: long enough for a teacher who sees a class twice a week to record three or four times, short enough that last month's crisis does not keep a recovered student flagged. `"Alta"` weighs twice `"Média"` because the teacher, and after `0019` the coordinator, already graded it as acute. The `"Baixa"` cap means a pile of one-tap emotion chips can bring a student close to `"moderado"` but never cross it alone; at least one `"Média"` or `"Alta"` is required. Collapsing one teacher's day into one signal means a teacher tapping the same chip three times in a lesson is one signal, while the same observation from a second teacher, or on a second day, is corroboration. Since a single signal is worth at most 4 points, `"critico"` always requires at least two independent signals, which is what the teachers' card asks for.

The constants live at the top of `src/risk/classifier.py` (`WINDOW_DAYS = 14`, `POINTS`, `LOW_SEVERITY_CAP = 3`, `MODERATE_THRESHOLD = 4`, `CRITICAL_THRESHOLD = 8`) so calibration after the pilot is a one-line change with the table above as its regression test. A weighted decay, where older signals count less, was the alternative; I rejected it because a level that changes overnight with no new record is harder to explain than one where a record simply leaves the window.

### The reason text
Each classification carries `motivo`, a Portuguese sentence built from the signal counts and shown to users verbatim, listing only the non-zero severities:

```
"2 sinais de gravidade Alta e 1 de gravidade Média nos últimos 14 dias (pontuação 10)."
"Nenhum sinal nos últimos 14 dias."
```

Singular and plural follow the count ("1 sinal", "2 sinais"). The sentence names no teacher and quotes no description, so it can appear in an alert list without leaking a narrative.

### Modules and seams
`src/risk/classifier.py` defines `RiskClassifier.classify(signals, now) -> RiskAssessment`, a pure function over a list of `Signal(autor_id, severidade, created_at)` returning `RiskAssessment(nivel, pontuacao, motivo)`. It touches no database and no clock, so the table above tests it directly. `src/risk/service.py` defines `RiskService(session, classifier, clock)`, which loads the window's observations for a set of students in one query on the `(estudante_id, created_at)` index of `0015` and returns an assessment per student. `src/risk/alerts.py` defines `AlertService(session, risk_service, clock)`. The two alert routes live in a blueprint in `src/routes/alertas.py`. All three services are built in `create_app` and injected, per [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md). `RiskClassifier` is the seam a future model would replace; any replacement must still produce `motivo`.

The level is computed when read, not stored. A stored level would go stale the moment a signal leaves the window, which happens with no write to trigger a recomputation, and would need a scheduled job to stay true; a live computation is one indexed query per listing. For a coordinator searching a school of 2,000 students with about 3,000 observations in the window, that is one query returning 3,000 small rows and a Python pass over them, estimated well under 100 ms, not measured.

### When alerts are raised
An alert records an upward level transition caused by a write. `POST /api/observacoes` of `0015` and `POST /api/gestao/observacoes/<id>/revisao` of `0019` call `AlertService` in the same transaction as their write:

- after an observation is recorded, `on_observation_recorded(observacao)` classifies the student's window with and without the new observation;
- after a review, `on_observation_reviewed(observacao, gravidade_anterior)` classifies it with the previous and the new effective severity, using the value `ObservationReviewService` of `0019` returns.

When the second level is higher than the first and is `"moderado"` or `"critico"`, one `alertas` row is inserted. Computing "before" from the same records, rather than comparing with a stored last level, makes detection stateless: a student who decayed back to `"leve"` and rises again is alerted again, and a student who stays `"critico"` while signals keep coming is not alerted twice. Downward transitions raise nothing.

Both write paths first lock the student row (`SELECT ... FROM estudante WHERE id = :id FOR UPDATE` on PostgreSQL; SQLite serializes writers anyway). Without the lock, two teachers recording at the same moment could each see the other's observation as absent, both compute a score of 7, and miss the transition to 8 that their records produce together. The lock serializes writes for one student only, so the contention cost is nil in practice.

The 201 response of `POST /api/observacoes` gains the student's level after the write, so the recording teacher learns of the change at once:

```json
{"sucesso": true, "mensagem": "Observação registrada com sucesso.", "id": 311, "risco": {"nivel": "critico", "alerta_gerado": true}}
```

### The `alertas` table
```
alertas:
  id              INTEGER      primary key
  estudante_id    INTEGER      not null, references estudante(id)
  nivel           VARCHAR(10)  not null  -- "moderado" | "critico"
  nivel_anterior  VARCHAR(10)  not null  -- "leve" | "moderado"
  pontuacao       INTEGER      not null
  motivo_regra    VARCHAR(200) not null  -- the generated reason text
  observacao_id   INTEGER      not null, references observacoes(id)  -- the record that triggered it
  created_at      TIMESTAMP    not null
  index (created_at)
  index (estudante_id, created_at)

alertas_leituras:
  alerta_id   INTEGER    not null, references alertas(id) on delete cascade
  usuario_id  INTEGER    not null, references usuarios(id)
  lido_em     TIMESTAMP  not null
  primary key (alerta_id, usuario_id)
```

Read state is a separate table rather than a JSON list of readers on the alert. "Unread alerts for this user" is the query every poll runs, and on a join table it is an indexed anti-join; on a JSON column it means loading and parsing every alert. Recipients are not stored: they are derived when read from the student's current class and `docente_turma`, so a teacher assigned to a class mid-term sees its open alerts, and one removed from it stops seeing them.

### Who receives which alert
- `gestor_escolar`: every alert, `"moderado"` and `"critico"`.
- `docente`: `"critico"` alerts of students in `ScopePolicy.estudantes_visiveis(usuario)`, that is, of their assigned classes.
- `equipe_multidisciplinar`: none; the routes below answer 403.

Teachers do not receive `"moderado"` alerts because a single `"Alta"` is `"moderado"`, and the card asks for alerts on multiple signals. A class with eight teachers would otherwise ping eight people for one record that its author already knows about. Teachers still see the `"moderado"` level in their rosters; only the interruption is reserved for `"critico"`.

### List alerts
`GET /api/alertas` — `gestor_escolar` and `docente`. Parameters, all optional: `desde_id` (integer, return only alerts with a greater `id`), `nao_lidos` (`true` to return only unread). Returns at most 50 alerts from the last 30 days visible to the caller, newest first.

```json
{
  "alertas": [
    {
      "id": 87,
      "nivel": "critico",
      "nivel_anterior": "moderado",
      "motivo_regra": "2 sinais de gravidade Alta e 1 de gravidade Média nos últimos 14 dias (pontuação 10).",
      "created_at": "2026-10-26T13:41:00Z",
      "lido": false,
      "estudante": {"id": 25, "nome": "Lucas Mendes de Oliveira", "turma": {"id": 1, "nome": "1º Ano A"}}
    }
  ],
  "nao_lidos": 3,
  "ultimo_id": 87
}
```

`nao_lidos` counts every unread alert visible to the caller in the last 30 days, independent of `desde_id`, so the badge stays right when the poll returns nothing new. `ultimo_id` is the highest visible alert id, or `null` when there is none, and is what the client sends as `desde_id` next. A `desde_id` that is not an integer returns 400 `{"sucesso": false, "mensagem": "Parâmetro desde_id inválido."}`.

### Mark alerts as read
`POST /api/alertas/lidos` — `gestor_escolar` and `docente`.

```json
{"ids": [87, 85]}
```

or `{"todos": true}` for every visible unread alert. Ids not visible to the caller are ignored rather than refused, so the endpoint never confirms that an alert about an out-of-scope student exists. Marking is idempotent: an alert already read keeps its first `lido_em`.

- 400 `{"sucesso": false, "mensagem": "Informe os alertas a marcar como lidos."}` when neither a non-empty `ids` list nor `todos: true` is given.
- 200 `{"sucesso": true, "mensagem": "Alertas marcados como lidos.", "nao_lidos": 1}`.

### Polling every 60 seconds, not a push channel
"Real time" here means an alert reaches an open dashboard within 60 seconds of the triggering record, because the client polls `GET /api/alertas?desde_id=...` once a minute. Server-Sent Events or WebSockets were the alternative and do not fit the deployment: the `Dockerfile` runs Gunicorn with 2 sync workers, and each open stream pins a worker for its whole life, so two connected users would block every other request. Moving to async workers is a deployment change with its own risks, out of scope here. The polling cost is small: with 60 users online, 1 request per second, each one primary-key lookup in the guard and one indexed query on `alertas`, against a server that handles routine API requests in tens of milliseconds (estimate, not measured).

### Risk level on the roster listings
`GET /api/estudantes` of `0004` and `0013` gains `risco` on each item and an optional `risco` filter, comma-separated (`?risco=moderado,critico`). An unknown value returns 400 `{"sucesso": false, "mensagem": "Filtro de risco inválido. Use leve, moderado ou critico."}`.

```json
{
  "estudantes": [
    {"id": 25, "nome": "Lucas Mendes de Oliveira", "matricula": "2026.01.0001", "turma": {"id": 1, "nome": "1º Ano A"}, "emocoes_recentes": ["tristeza"], "risco": "critico"}
  ]
}
```

`GET /api/turmas` gains `risco_contagem` on each item and the same `risco` filter, which keeps only classes with at least one student at one of the given levels:

```json
{
  "turmas": [
    {"id": 1, "nome": "1º Ano A", "turno": "matutino", "total_estudantes": 34, "risco_contagem": {"leve": 31, "moderado": 2, "critico": 1}}
  ]
}
```

These counts are not suppressed for small numbers, unlike the aggregates of [0023](0023-emotional-climate-dashboards-backend.md): every caller of these routes already sees each student's individual level through `GET /api/estudantes`, so a count reveals nothing they cannot read one row at a time.

`GET /api/estudantes/<id>/historico` of `0015` gains the student's current assessment in its `estudante` header, the one place where the reason is shown next to the record it comes from:

```json
{"estudante": {"id": 25, "nome": "Lucas Mendes de Oliveira", "matricula": "2026.01.0001", "turma": {"id": 1, "nome": "1º Ano A"}, "risco": {"nivel": "critico", "pontuacao": 10, "motivo": "2 sinais de gravidade Alta e 1 de gravidade Média nos últimos 14 dias (pontuação 10)."}}}
```

### Data protection
The classification is profiling of adolescents under art. 20 of the General Data Protection Law (LGPD), so its limits are deliberate. It decides nothing about the student: it orders the attention of adults who already have access, and every level is explained by `motivo` and traceable to records the user can open. Alert reads are student data: `GET /api/alertas` calls `AuditLogger.registrar` of [0027](0027-access-audit-log-backend.md) once per alert returned, with `acao` `"ler_alerta"`, `recurso` `"alerta:<id>"`, and the `estudante_id`; a poll that returns no alert writes nothing. The action joins the registry of `0027` with the description "Visualizou um alerta de risco". `motivo_regra` is generated text that names no one and quotes nothing, so the anonymization of [0017](0017-lgpd-privacy-compliance-backend.md) keeps alerts as structured rows; the student export of `0017` adds an `alertas` list with `nivel`, `motivo_regra`, and `created_at`.

## Testing Decisions
The classifier is tested as a pure function; the rest through the Flask test client against in-memory tenant databases with tokens for each profile and a fixed injected clock.

- `backend/test/test_risk_classifier.py`: every row of the worked-examples table; the window edge (an observation at exactly 14 days is out); the per-teacher-per-day collapse across the America/Sao_Paulo midnight; the `"Baixa"` cap; `effective_severity` respected; the `motivo` text in singular, plural, and empty forms.
- `backend/test/test_risk_service.py`: one query for many students; students without observations are `"leve"`.
- `backend/test/test_risk_alerts.py`: an upward transition inserts one alert with `nivel_anterior`; staying at a level or going down inserts none; decay then rise alerts again; a review that raises a severity alerts, one that lowers it does not; the student-row lock is taken on both paths.
- `backend/test/test_routes_alertas.py`: recipients per profile (coordinator both levels, teacher only `"critico"` of assigned classes, psychologist 403); `desde_id`, `nao_lidos`, `ultimo_id`, the 30-day window, and the 50-item cap; marking by ids and `todos`, idempotency, out-of-scope ids ignored; audit rows only when alerts are returned.
- `backend/test/test_api_estudante.py` and `backend/test/test_api_turma.py` (extended): `risco` and `risco_contagem` values, the `risco` filter on both, the 400 for unknown values.
- `backend/test/test_api_observacoes.py` (extended): the `risco` block in the 201 response.

## Out of Scope
- The alert bell, risk badges, and filters, specified in [todo/0022-risk-classification-alerts-frontend.md](0022-risk-classification-alerts-frontend.md).
- School and class aggregates of risk, specified in [todo/0023-emotional-climate-dashboards-backend.md](0023-emotional-climate-dashboards-backend.md).
- Any machine-learning or AI classification, which belongs to Increments #3 to N.
- E-mail, SMS, or push notifications outside the open dashboard.
- Alerts for the multidisciplinary team; see _Further Notes_.
- Automatic referral creation when a student becomes `"critico"`: the coordinator decides.

## Further Notes
The thresholds need validation by the product owner and a school psychologist before the pilot, and again after four weeks of real data. The test to apply then is the share of students at each level: if more than about 5% of a school sits at `"critico"`, the alert loses meaning and `CRITICAL_THRESHOLD` should rise. The 5% figure is my guess at what a coordinator can follow up in a week, not a measured number.

Whether a psychologist with an open referral for a student should also receive that student's alerts is a product decision. The scope policy of `0013` already lets them see the student, so it would be a recipient rule change only.
