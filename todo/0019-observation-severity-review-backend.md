# Observation Severity Review Backend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a Pedagogical Coordinator, I want to review the records made by teachers to validate the severity of the signs" (value 500, 3 points).*

*This specification defines the backend of the coordinator's severity review of teacher observations. Its frontend counterpart is [todo/0020-observation-severity-review-frontend.md](0020-observation-severity-review-frontend.md), which can be built against this contract before it ships. It extends the `observacoes` table and the student history of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md) and relies on the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md) and the scope policy of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md).*

## Problem
Every observation a teacher records carries a severity, `"Baixa"`, `"Média"`, or `"Alta"`, and that severity is the teacher's judgement in the middle of a lesson. Teachers calibrate differently: one marks a student crying in the library as `"Alta"`, another marks the same scene as `"Média"`. Today nobody looks at that judgement again. The coordinator reads observations only by opening one student's history at a time, so a mis-graded `"Alta"` sits unnoticed and a `"Baixa"` that describes self-harm talk is never escalated.

The severity also has consequences downstream. The risk classification of [0021](0021-risk-classification-alerts-backend.md) weighs observations by severity, and the climate dashboards of [0023](0023-emotional-climate-dashboards-backend.md) aggregate them. An uncalibrated severity turns into a false alert or a missed one.

## Business Vision and Purposes
The coordinator is the person accountable for triage in the school, and a second look at the severity of what teachers record is the cheapest point in the pipeline to catch both over- and under-reaction. A validated severity gives the alert rule and the dashboards a number the school stands behind, and the coordinator's short note teaches teachers, over the term, what each level means in their school.

## Solution
The coordinator gets a review queue of observations not yet reviewed, most severe and oldest first. For each one they either validate the teacher's severity as it is or adjust it to another level with a short note explaining why. The teacher's original severity and text never change: the review is recorded next to them, once, with who reviewed it and when. Everyone who can read the student's history sees both the original and the validated severity, and the note. Observations written by the coordinator are validated on creation. Low-severity observations, including one-tap emotion chips, are left out of the default queue and reviewed only when the coordinator asks for them.

## User Stories
1. As a Coordenador Pedagógico, I want a queue of observations awaiting review with the most severe first, so that I look at what matters before the rest.
2. As a Coordenador Pedagógico, I want to validate a teacher's severity in one action, so that reviewing the common case costs seconds.
3. As a Coordenador Pedagógico, I want to adjust a severity with a mandatory note, so that the teacher understands the correction and the record explains itself later.
4. As a Docente, I want to see in the student's history whether my severity was validated or adjusted, and why, so that I calibrate my next records.
5. As a Coordenador Pedagógico, I want a pending count, so that I know how much review work is waiting.

## Implementation Decisions

### Review columns on `observacoes`
The review lives on the observation row, written once. The tenant table of `0015` gains:

```
observacoes (new columns):
  status_revisao      VARCHAR(10)  not null default 'pendente'  -- "pendente" | "validada" | "ajustada"
  gravidade_validada  VARCHAR(10)  null                         -- "Baixa" | "Média" | "Alta"; set when status_revisao != "pendente"
  revisado_por_id     INTEGER      null, references usuarios(id)
  revisado_em         TIMESTAMP    null
  nota_revisao        TEXT         null                         -- at most 500 characters
  index (status_revisao, created_at)
```

The migration sets `status_revisao = 'pendente'` on every existing row. A separate `revisoes_observacao` table, one row per review, was the alternative; I rejected it because the classifier of `0021` and the aggregates of `0023` read the effective severity of thousands of observations per request, and a column on the same row keeps that a single-table read. The cost is that only one review per observation exists, which is also the rule below.

The effective severity of an observation, the value every downstream reader must use, is `gravidade_validada` when `status_revisao` is not `"pendente"`, and `gravidade` otherwise. `src/observations/severity.py` exposes it as `effective_severity(observacao) -> str` so `0021`, `0023`, and `0025` do not each re-derive it.

### One review per observation, and the append-only rule
`0015` makes observations append-only through a `before_update` hook that raises on any update. This spec narrows that hook: an update is allowed only when the changed columns are exactly the five review columns and the stored `status_revisao` is `"pendente"`. Any other update still raises, so the teacher's `tipo`, `gravidade`, `descricao`, and `created_at` remain immutable, and a review cannot be rewritten.

The write is a conditional update, `UPDATE observacoes SET ... WHERE id = :id AND status_revisao = 'pendente'`, so two coordinators reviewing the same observation at once cannot both succeed; the one that updates zero rows answers 409. Allowing a review to be redone was the alternative. I rejected it for the same reason `0015` forbids edits: a severity that changes after a referral or an alert was raised on it undermines the record. A coordinator who erred records the correction in a coordination occurrence of `0015`; _Further Notes_ asks the product owner whether that is enough.

### Observations written by the coordinator
`POST /api/observacoes` of `0015` accepts `gestor_escolar`. For those observations the insert sets `status_revisao = "validada"`, `gravidade_validada = gravidade`, `revisado_por_id = autor_id`, and `revisado_em = created_at`, so the coordinator never reviews their own records and they never sit in the queue.

### Review queue
`GET /api/gestao/observacoes/revisao` — `gestor_escolar` only.

Parameters, all optional: `status` (`pendente` by default, or `validada`, `ajustada`), `gravidade` (comma-separated, default `Média,Alta`), `turma_id` (integer), `pagina` (default 1, 50 items per page). Pending items are ordered by `gravidade` descending (`"Alta"`, `"Média"`, `"Baixa"`) and then by `created_at` ascending, so the most severe and oldest come first; reviewed items are ordered by `revisado_em` descending.

```json
{
  "observacoes": [
    {
      "id": 311,
      "estudante": {"id": 25, "nome": "Lucas Mendes de Oliveira", "turma": {"id": 1, "nome": "1º Ano A"}},
      "autor": {"id": 12, "nome": "Maria Silva"},
      "tipo": "tristeza",
      "gravidade": "Alta",
      "descricao": "Estudante isolou-se dos colegas no intervalo e chorou discretamente na biblioteca.",
      "registro_rapido": false,
      "created_at": "2026-10-18T09:15:00Z",
      "status_revisao": "pendente",
      "gravidade_validada": null,
      "nota_revisao": null,
      "revisado_por": null,
      "revisado_em": null
    }
  ],
  "pagina": 1,
  "total": 1,
  "pendentes": {"Baixa": 41, "Média": 6, "Alta": 2}
}
```

`pendentes` counts every pending observation of the school by original severity, regardless of the filters, so the frontend can show the badge and tell the coordinator how many low-severity records the default filter hides.

- 400 `{"sucesso": false, "mensagem": "Filtro de revisão inválido."}` for an unknown `status` or `gravidade` value.
- 404 `{"sucesso": false, "mensagem": "Turma informada não encontrada."}` for an unknown `turma_id`.

Low-severity records are out of the default filter on purpose. One-tap emotion chips are always `"Baixa"` and can reach several hundred a week in a school of 50 teachers (estimate, not measured), which would bury the handful of `"Média"` and `"Alta"` records the review exists for. The coordinator still reaches them with `gravidade=Baixa`, and a `"Baixa"` the coordinator raises to `"Alta"` counts as `"Alta"` everywhere downstream. Pending low-severity records keep `status_revisao = "pendente"` indefinitely, which is accurate: nobody reviewed them.

### Submit a review
`POST /api/gestao/observacoes/<int:id>/revisao` — `gestor_escolar` only.

```json
{
  "decisao": "ajustada",
  "gravidade_validada": "Média",
  "nota_revisao": "Episódio isolado, sem relato de risco. Manter acompanhamento na turma."
}
```

- `decisao` is `"validada"` or `"ajustada"`. For `"validada"`, `gravidade_validada` must be absent or equal to `gravidade`, and is stored as `gravidade`; `nota_revisao` is optional.
- For `"ajustada"`, `gravidade_validada` is required and must differ from `gravidade`, and `nota_revisao` is required, because an unexplained correction teaches the teacher nothing.
- `nota_revisao` is trimmed; an empty string is stored as `null`.

Validation errors, all 400 with `"sucesso": false`:

- `"Selecione validar ou ajustar a gravidade."` for a missing or unknown `decisao`.
- `"Selecione a nova gravidade."` for an adjustment without a valid `gravidade_validada`.
- `"A nova gravidade deve ser diferente da registrada pelo professor."` for an adjustment to the same level, or a validation with a different level.
- `"Explique o ajuste em uma nota para o professor."` for an adjustment without a note.
- `"A nota deve ter no máximo 500 caracteres."`

Other errors:

- 404 `{"sucesso": false, "mensagem": "Registro não encontrado."}` for an unknown observation.
- 409 `{"sucesso": false, "mensagem": "Este registro já foi revisado."}` when the observation is no longer pending, including the lost race above.

Response 200:

```json
{
  "sucesso": true,
  "mensagem": "Gravidade ajustada para Média.",
  "observacao": {
    "id": 311,
    "status_revisao": "ajustada",
    "gravidade": "Alta",
    "gravidade_validada": "Média",
    "nota_revisao": "Episódio isolado, sem relato de risco. Manter acompanhamento na turma.",
    "revisado_por": {"id": 3, "nome": "Coord. Helena Prado"},
    "revisado_em": "2026-10-26T14:02:00Z"
  }
}
```

For a validation, `mensagem` is `"Gravidade validada."`.

Both routes live in a blueprint in `src/routes/revisao_observacoes.py`, registered in `create_app`. The review route delegates to `ObservationReviewService.review(observacao_id, decisao, gravidade_validada, nota, revisor)` in `src/observations/review.py`, which receives the tenant session and a clock through `__init__` per [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md) and which returns the reviewed observation together with its previous effective severity. That return value is the seam `0021` uses to re-evaluate the student's risk after a review; this spec calls nothing downstream itself.

### Review fields in the student history
Observation items of `GET /api/estudantes/<id>/historico` from `0015` gain the review fields, for every profile that already receives the item:

```json
{
  "tipo_registro": "observacao",
  "id": 311,
  "data": "2026-10-18T09:15:00Z",
  "autor": {"id": 12, "nome": "Maria Silva", "perfil": "docente"},
  "tipo": "tristeza",
  "gravidade": "Alta",
  "descricao": "Estudante isolou-se dos colegas no intervalo e chorou discretamente na biblioteca.",
  "registro_rapido": false,
  "status_revisao": "ajustada",
  "gravidade_validada": "Média",
  "nota_revisao": "Episódio isolado, sem relato de risco. Manter acompanhamento na turma.",
  "revisado_por": {"id": 3, "nome": "Coord. Helena Prado"},
  "revisado_em": "2026-10-26T14:02:00Z"
}
```

The note reaches teachers on purpose: it is addressed to them, and it is about the severity of a record they can already read. The frontend tells the coordinator so next to the note field. Showing the teacher only the validated level, without the original, was the alternative; I rejected it because the teacher needs to see that their own grading was changed to learn from it.

### Audit and anonymization
Reading the queue and submitting a review touch student records, so both routes call `AuditLogger.registrar` of [0027](0027-access-audit-log-backend.md): the queue once per observation returned, with `acao` `"ler_fila_revisao"`, `recurso` `"observacao:<id>"`, and its `estudante_id`; the review with `acao` `"revisar_observacao"` and the same `recurso` and `estudante_id`. Both actions join the registry of `0027` with the descriptions "Consultou a fila de revisão de registros" and "Revisou a gravidade de um registro". If this spec ships before `0027`, `0027` adds those calls when it instruments the existing routes.

`nota_revisao` is free text about a student, so the composition root adds it to the `observacoes` entry of `AnonymizerService.registrar_tabela(...)` of [0017](0017-lgpd-privacy-compliance-backend.md), next to `descricao`; `status_revisao` and `gravidade_validada` are structured and stay for statistics. The anonymizer already bypasses the `before_update` hook, so the narrowed hook does not block it. The student export of `0017` adds `status_revisao`, `gravidade_validada`, `nota_revisao`, and the reviewer's name to each item of `observacoes`, since the review is data about the student.

## Testing Decisions
Routes are exercised through the Flask test client against in-memory tenant databases built by `create_app`, with tokens for each profile as in `0011`.

- `backend/test/test_observations_severity.py`: `effective_severity` for pending, validated, and adjusted observations.
- `backend/test/test_observations_review.py`: `ObservationReviewService` validates and adjusts, returns the previous effective severity, refuses a second review, and loses the conditional-update race cleanly when two sessions review the same row.
- `backend/test/test_models_observacao.py` (from `0015`, extended): the narrowed hook allows exactly the review columns from `"pendente"` and still refuses every other update, including a second review written directly through the model.
- `backend/test/test_routes_revisao_observacoes.py`: queue ordering, default `Média,Alta` filter, `pendentes` independent of filters, `turma_id` and `status` filters, pagination; every validation message; 404 and 409; `docente` and `equipe_multidisciplinar` get 403.
- `backend/test/test_api_observacoes.py` (from `0015`, extended): a coordinator's observation is created as validated by its author.
- `backend/test/test_api_estudante_historico.py` (from `0015`, extended): review fields present for each profile, `null` while pending.

## Out of Scope
- The review queue screen and the history badges, specified in [todo/0020-observation-severity-review-frontend.md](0020-observation-severity-review-frontend.md).
- Re-evaluating risk and raising alerts after a review, specified in [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md).
- Reviewing coordination occurrences or referrals; only observations carry a teacher-assigned severity.
- Bulk validation of many observations in one request.
- Notifying the teacher when their observation is reviewed; they see it in the history.

## Further Notes
A review cannot be redone. If the product owner wants coordinators to correct their own review mistakes, the smallest change is a second, append-only review row that supersedes the first, which means moving to the separate table rejected above. That should be decided before `0021` and `0023` ship, because both read the review columns directly.

Whether a `docente` should see `nota_revisao` for observations written by other teachers of the same class is a product call. This spec shows it to everyone who can read the observation, because the note is about the record and not about the teacher; restricting it to the author is a projection change in the history route only.
