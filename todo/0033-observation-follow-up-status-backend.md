# Observation Follow-Up Status Backend

*Phase: Increments #3 to N (other). Story-map cards: "As a user, I want to mark an observation as 'in follow-up' to signal that the intervention has started" (value 100, 1 point).*

*This specification defines the backend of the follow-up flag on behavioral observations. Its frontend counterpart is [todo/0034-observation-follow-up-status-frontend.md](0034-observation-follow-up-status-frontend.md), which can be built against the contract below before this ships. It depends on the `observacoes` table and the student timeline of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), on `require_profile` from [todo/0011-access-management-backend.md](0011-access-management-backend.md), on `ScopePolicy` from [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md), and on `AuditLogger` from [todo/0027-access-audit-log-backend.md](0027-access-audit-log-backend.md).*

## Problem
When a teacher or coordinator reads an alarming observation in a student's timeline, they cannot tell whether someone already acted on it. Two colleagues may both call the family about the same episode, or, more often, each assumes the other did and nobody does. The only "someone is on it" signal today is a referral moving to `"Em Atendimento"`, and most observations never become a referral: a teacher who talks with the student after class, or a coordinator who calls the guardian, leaves no trace.

## Business Vision and Purposes
A visible, attributed "in follow-up" mark on an observation lets the school see which signals have an adult acting on them and which are still unattended, without opening the heavier referral pipeline for every episode. It turns the timeline from a log into a worklist and records who took responsibility and when.

## Solution
Any professional who can see a student can mark one of that student's observations as in follow-up. The mark records who set it and when, and the timeline shows it on the observation. The person who set it, or a coordinator, can clear it. The mark carries no free text: the intervention itself, if it needs recording, is a coordination occurrence or a referral.

## User Stories
1. As a Docente, I want to mark an observation about a student of my class as in follow-up after I talk with the student, so that colleagues know an intervention has started.
2. As a Coordenador Pedagógico, I want to see in the timeline which observations are in follow-up and by whom, so that I find the episodes nobody is handling.
3. As the professional who started a follow-up, I want to clear the mark if I set it by mistake, so that the timeline stays truthful.
4. As a Coordenador Pedagógico, I want to clear any follow-up mark, so that I can correct the record when the responsible person leaves the school.

## Implementation Decisions

### Columns on `observacoes`
Three columns are added to the tenant table `observacoes`:

```
em_acompanhamento      BOOLEAN    not null default false
acompanhamento_desde   TIMESTAMP  null      -- UTC, set together with the flag
acompanhamento_por_id  INTEGER    null, references usuarios(id)
```

Observations stay append-only in their content (`tipo`, `gravidade`, `descricao`, `registro_rapido`): these columns are workflow state, like the review columns of [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md), and the history of who set and cleared them lives in the audit log, not in extra columns. I rejected a separate `observacao_acompanhamentos` history table: the audit log of `0027` already records every set and clear with user and timestamp, and a second history would be a second place to disagree.

### Who may set and clear
Setting follows visibility: a user may mark an observation when its `estudante_id` is in `ScopePolicy.estudantes_visiveis(g.usuario)`, so a `docente` marks observations of their assigned classes, an `equipe_multidisciplinar` professional those of students referred to them, and a `gestor_escolar` any. Clearing is narrower: only `acompanhamento_por_id` or a `gestor_escolar` may clear, because clearing someone else's mark silently erases their claim of responsibility. An observation outside the caller's scope answers 404, not 403, so the endpoint never confirms that an observation exists about a student the caller cannot see.

Setting an observation that is already in follow-up is a no-op that answers 200 and keeps the original `acompanhamento_desde` and `acompanhamento_por_id`; the first person who took responsibility stays recorded.

### Relation to the referral's `"Em Atendimento"`
The follow-up flag and the referral status of [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md) are independent and never update each other. `"Em Atendimento"` is the multidisciplinary team's formal care state of a referral, set only by the assigned professional or the coordinator, with a lifecycle that ends in `"Concluído"` or `"Arquivado"`. The follow-up flag is a lightweight claim on one observation, open to any professional who sees the student, with no end state beyond being cleared. I considered setting the flag automatically on the referral's source observation (`observacao_id`) when the referral enters `"Em Atendimento"`, and rejected it: the flag would then carry an author who never set it, and archiving the referral would leave no consistent rule for clearing it. The timeline already shows both, side by side.

The flag does not feed the `RiskClassifier` of [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md): risk describes the student's state, not whether an adult is acting on it.

### `PUT /api/observacoes/<int:id>/acompanhamento`
The rules live in a `FollowUpService` in `src/observations/follow_up.py`, receiving the session, `ScopePolicy`, and `AuditLogger` through `__init__`; the route joins the observations blueprint that `0015` adds under `src/routes/`. Accessible to `gestor_escolar`, `docente`, and `equipe_multidisciplinar` through `require_profile`.

- Request Body:
```json
{
  "em_acompanhamento": true
}
```
- If `em_acompanhamento` is missing or not a boolean, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "Informe se a observação está em acompanhamento."}`
- If the observation does not exist or its student is outside the caller's scope, return status 404 Not Found with: `{"sucesso": false, "mensagem": "Observação não encontrada."}`
- If `em_acompanhamento` is `false` and the caller is neither `acompanhamento_por_id` nor a `gestor_escolar`, return status 403 Forbidden with: `{"sucesso": false, "mensagem": "Somente quem iniciou o acompanhamento ou a coordenação pode encerrá-lo."}`
- Setting stores `true`, the current UTC time, and `g.usuario.id`; clearing stores `false`, `null`, and `null`. Both call `AuditLogger.registrar` with `acao` `"iniciar_acompanhamento"` or `"encerrar_acompanhamento"`, `recurso` `"observacao:<id>"`, and the `estudante_id`.
- Response Status: 200 OK
```json
{
  "sucesso": true,
  "mensagem": "Observação marcada como em acompanhamento.",
  "acompanhamento": {
    "desde": "2026-10-26T13:40:00Z",
    "por": { "id": 4, "nome": "Prof. Carlos Souza" }
  }
}
```
- On clearing, `mensagem` is `"Acompanhamento encerrado para esta observação."` and `acompanhamento` is `null`.

### Timeline field
Every item with `"tipo_registro": "observacao"` in `GET /api/estudantes/<id>/historico` gains an `acompanhamento` field with the same shape as above, or `null` when the observation is not in follow-up. The field is always present so the client never has to distinguish "absent" from "not in follow-up". Only the author's `id` and `nome` are exposed, the same data the timeline already shows for an observation's author.

### LGPD
The feature adds no free text, so the anonymization sweep of [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md) needs no change: the three columns are structured fields and stay for statistics. The student export of `0017` includes the `acompanhamento` field of each observation, and `backend/test/test_api_estudante_exportar.py` is extended to check it.

## Testing Decisions
Exercised through the Flask test client against an in-memory SQLite tenant database, with the JWT issued by the `0002` login helper used by the other API tests.

- `backend/test/test_observations_follow_up.py`: set and clear by each profile; the 404 for an observation outside the caller's `ScopePolicy`; the 403 when a teacher clears a colleague's mark; the coordinator clearing anyone's mark; setting twice keeps the first author and timestamp; the 400 for a non-boolean body; the audit entries written on set and clear.
- `backend/test/test_api_estudante_historico.py` (from `0015`, extended): `acompanhamento` is present on every observation item, `null` when unset.

## Out of Scope
- The timeline badge and the set and clear controls, specified in [todo/0034-observation-follow-up-status-frontend.md](0034-observation-follow-up-status-frontend.md).
- Any change to referral statuses or to the `RiskClassifier`.
- A note describing the intervention; that is a coordination occurrence or a referral.
- Filtering lists or alerts by follow-up state.
