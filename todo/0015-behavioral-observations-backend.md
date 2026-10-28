# Behavioral Observations and Unified Student History Backend

*Phase: MVP #1 (backbone). Story-map cards: "As a Teacher, I want to quickly record a behavioral observation about a student" (value 500, 3 points); "As a user, I want to see a student's unified history of observations with period filters to understand their evolution before intervening" (value 800, 3 points); "As a Teacher, I want to refer a student to the coordination with one click from a recorded observation" (value 500, 3 points).*

*This specification defines the backend of behavioral observations, coordination occurrences, and the unified student history. Its frontend counterpart is [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md), which can be built against this contract before it ships. It depends on the roster of [todo/0004-student-class-management-backend.md](0004-student-class-management-backend.md), the referrals of [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md), the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md), and the scope policy of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md).*

## Problem
Recording what a teacher saw is the first step of everything App A.M.P.A.R.A. does, and today nothing is recorded. The dashboard's observation modal, the emotion chips on each student card, and the coordinator's "Ocorrências da Coordenação" tab all write into JavaScript arrays in the page; a reload erases them, and no one else ever sees them. The "Linha do Tempo Comportamental" with its period filter renders two hardcoded entries about a student named Lucas. A referral, once [0006](0006-referral-queue-management-backend.md) ships, carries a free-text reason but no link to the observation that prompted it, so the psychologist reads a summary instead of what the teacher actually recorded.

## Business Vision and Purposes
The platform's value is spotting a student's change over weeks, which no single teacher sees alone. That requires every observation, from every teacher, plus every coordination intervention and referral, to land in one durable record per student that the right people can read in order and filter by period. The record has to be trustworthy as evidence: what a teacher wrote on a date stays as written.

## Solution
A teacher records an observation about one of their students in under ten seconds: a type, a severity, and an optional description of up to 500 characters, or a single tap on an emotion chip for the quickest case. The coordinator records school occurrences about a student or a whole class. Anyone allowed to see a student opens a single history that merges observations, occurrences, and referrals in date order, filtered by a date range. A teacher can refer a student straight from one of the observations in that history, and the referral carries the link to it. Observations cannot be edited or deleted.

## User Stories
1. As a Docente, I want to record a behavioral observation with type, severity, and an optional description, so that what I saw is not lost.
2. As a Docente, I want to tap an emotion chip on a student's card to record a quick low-severity observation, so that I can register a signal in the middle of a class.
3. As a Coordenador Pedagógico, I want to record an occurrence about a student or a whole class, with the action taken, so that school interventions are part of the record.
4. As any professional allowed to see a student, I want their unified history in date order, filtered by period, so that I understand how they evolved before I act.
5. As a Docente, I want to refer a student from a specific observation, so that the coordination and the psychologist read what I actually recorded.
6. As a Gestor Escolar, I want observations to be impossible to alter after the fact, so that the record holds as evidence.

## Implementation Decisions

### Tenant tables
```
observacoes:
  id              INTEGER     primary key
  estudante_id    INTEGER     not null, references estudante(id)
  autor_id        INTEGER     not null, references usuarios(id)
  tipo            VARCHAR(20) not null  -- "ansiedade" | "tristeza" | "agitacao" | "apatia" | "euforia" | "outro"
  gravidade       VARCHAR(10) not null  -- "Baixa" | "Média" | "Alta"
  descricao       TEXT        null      -- at most 500 characters
  registro_rapido BOOLEAN     not null default false
  created_at      TIMESTAMP   not null
  index (estudante_id, created_at)

ocorrencias_coordenacao:
  id            INTEGER      primary key
  autor_id      INTEGER      not null, references usuarios(id)
  estudante_id  INTEGER      null, references estudante(id)
  turma_id      INTEGER      null, references turma(id)
  tipo          VARCHAR(40)  not null  -- "Conflito entre Alunos" | "Indisciplina Grave" | "Emergência Médica" | "Apoio Familiar" | "Saúde Mental"
  acao          TEXT         not null  -- at most 500 characters
  descricao     TEXT         not null  -- at most 1,000 characters
  created_at    TIMESTAMP    not null
  check (exactly one of estudante_id, turma_id is not null)
```

`encaminhamentos` from `0006` gains `observacao_id INTEGER null, references observacoes(id)`.

The `tipo` values are the ones the dashboard already offers, so no screen copy changes. Severity uses `"Baixa"`, `"Média"`, `"Alta"`, the same scale as the referral priority of `0006`, instead of the prototype's `low`/`medium`/`high`, so one vocabulary covers both.

### Append-only records
Observations and occurrences have no update or delete route, and the model layer refuses updates by raising on `before_update`. A teacher who wrote something wrong records a new observation that corrects it. Allowing edits within a grace period was the alternative; I rejected it because the record is read by psychologists and, in serious cases, by families and child-protection services, and an observation that changed after a referral was opened undermines both. The cost is that typos stay; the 500-character limit and the review of [0019](0019-observation-severity-review-backend.md) bound the harm. The one legitimate erasure is the anonymization of [0017](0017-lgpd-privacy-compliance-backend.md), which runs as a privileged service bypassing the hook.

Emotion chips follow the same rule. In the prototype a second tap "deactivated" an emotion; with append-only records a tap always records, and the chip shows as active while the student has an observation of that type in the last 7 days. To draw that without one request per student, each item of `GET /api/estudantes` from `0004` gains `"emocoes_recentes": ["ansiedade", "tristeza"]`, the distinct `tipo` values (excluding `"outro"`) of the student's observations created in the last 7 days, computed in the same query with a grouped subquery. It is returned only to profiles that may read the student's observations, which within `ScopePolicy` is all of them.

### Create an observation
`POST /api/observacoes` — `docente` and `gestor_escolar`. The student must be in the caller's scope per `ScopePolicy` of `0013`.

```json
{
  "estudante_id": 25,
  "tipo": "ansiedade",
  "gravidade": "Média",
  "descricao": "Estudante demonstrou inquietação na aula de matemática, andando pela sala repetidamente.",
  "registro_rapido": false
}
```

- 404 `{"sucesso": false, "mensagem": "Estudante não encontrado."}` when the student does not exist or is outside the scope.
- 400 `{"sucesso": false, "mensagem": "Selecione o tipo de comportamento."}` for a missing or unknown `tipo`.
- 400 `{"sucesso": false, "mensagem": "Selecione o nível de gravidade."}` for a missing or unknown `gravidade`.
- 400 `{"sucesso": false, "mensagem": "A descrição deve ter no máximo 500 caracteres."}`.
- When `registro_rapido` is `true`, `gravidade` defaults to `"Baixa"` and `descricao` must be absent; the chip carries no text.
- `descricao` is stored after trimming; an empty string is stored as `null`.
- 201:

```json
{"sucesso": true, "mensagem": "Observação registrada com sucesso.", "id": 311}
```

### Coordination occurrences
`POST /api/gestao/ocorrencias` — `gestor_escolar` only.

```json
{
  "estudante_id": 25,
  "turma_id": null,
  "tipo": "Apoio Familiar",
  "acao": "Reunião com a responsável para alinhar acompanhamento.",
  "descricao": "Responsável relatou mudança recente de endereço e dificuldades de sono do estudante."
}
```

- 400 `{"sucesso": false, "mensagem": "Informe um estudante ou uma turma."}` when both or neither target is given.
- 404 for an unknown student or class, with the messages of `0004`.
- 400 `{"sucesso": false, "mensagem": "Preencha todos os campos da ocorrência."}` for a missing `tipo`, `acao`, or `descricao`.
- 201 `{"sucesso": true, "mensagem": "Ocorrência registrada com sucesso.", "id": 57}`.

`GET /api/gestao/ocorrencias?de=&ate=&tipo=` — `gestor_escolar` only, newest first, 50 per page with `pagina`:

```json
{
  "ocorrencias": [
    {
      "id": 57,
      "tipo": "Apoio Familiar",
      "alvo": {"tipo": "estudante", "id": 25, "nome": "Lucas Mendes de Oliveira", "turma": "1º Ano A"},
      "acao": "Reunião com a responsável para alinhar acompanhamento.",
      "descricao": "Responsável relatou mudança recente de endereço...",
      "autor": {"id": 3, "nome": "Coord. Helena Prado"},
      "created_at": "2026-10-20T13:05:00Z"
    }
  ],
  "pagina": 1,
  "total": 1
}
```

For a class occurrence, `alvo` is `{"tipo": "turma", "id": 1, "nome": "1º Ano A"}`.

The prototype copied every student occurrence into the student's behavioral log with high severity. The unified history below makes that copy unnecessary: occurrences appear in the history as their own kind, with their own fields, and class occurrences appear in the history of every student of the class.

### Unified student history
`GET /api/estudantes/<int:id>/historico?de=2026-09-01&ate=2026-10-26` — every profile, scoped by `ScopePolicy`. Both dates are optional and inclusive, in the school's local date (America/Sao_Paulo); `de` after `ate` returns 400 `{"sucesso": false, "mensagem": "A data inicial deve ser anterior à data final."}`. Items are newest first, 100 per page with `pagina`.

```json
{
  "estudante": {"id": 25, "nome": "Lucas Mendes de Oliveira", "matricula": "2026.01.0001", "turma": {"id": 1, "nome": "1º Ano A"}},
  "itens": [
    {
      "tipo_registro": "encaminhamento",
      "id": 142,
      "data": "2026-10-21T10:15:00Z",
      "autor": {"id": 12, "nome": "Maria Silva", "perfil": "docente"},
      "status": "Em Atendimento",
      "prioridade": "Alta",
      "motivo": "Estudante tem se isolado frequentemente dos colegas...",
      "observacao_id": 311
    },
    {
      "tipo_registro": "ocorrencia",
      "id": 57,
      "data": "2026-10-20T13:05:00Z",
      "autor": {"id": 3, "nome": "Coord. Helena Prado", "perfil": "gestor_escolar"},
      "tipo": "Apoio Familiar",
      "alvo": "estudante",
      "acao": "Reunião com a responsável para alinhar acompanhamento.",
      "descricao": "Responsável relatou mudança recente de endereço..."
    },
    {
      "tipo_registro": "observacao",
      "id": 311,
      "data": "2026-10-18T09:15:00Z",
      "autor": {"id": 12, "nome": "Maria Silva", "perfil": "docente"},
      "tipo": "tristeza",
      "gravidade": "Alta",
      "descricao": "Estudante isolou-se dos colegas no intervalo e chorou discretamente na biblioteca.",
      "registro_rapido": false
    }
  ],
  "pagina": 1,
  "total": 3
}
```

What each profile reads differs on purpose. A `docente` receives referral items without `motivo` and without the coordinator's notes, only that a referral exists, its status, and its date, because the teacher's role ends at referring and the reason may contain what the family told the coordination. `ocorrencia` items reach a `docente` with `tipo` and `alvo` only. `gestor_escolar` and `equipe_multidisciplinar` receive every field listed above; `observacoes_coordenacao` and `resumo_encerramento` of `0006` never appear in the history and stay on the referral routes.

Merging three tables in one query with `UNION ALL` ordered by date was the alternative to three queries merged in Python. I chose three indexed queries capped at `pagina * 100` rows each and merged in Python, because each table needs a different column projection per profile, which a `UNION` would force into the widest common shape. The cost grows with the page number; a student with more than 1,000 records is outside what one school produces in a year, unverified against real usage.

### Referral from an observation
`POST /api/encaminhamentos` of `0006` accepts an optional `observacao_id`. When present, it must belong to the same `estudante_id`, else 400 `{"sucesso": false, "mensagem": "A observação informada não pertence a este estudante."}`; and when `motivo` is absent, it defaults to the observation's `descricao`, or to "Encaminhamento a partir de observação de {tipo} com gravidade {gravidade}." when the description is empty. The coordinator's queue item of `0006` gains `"observacao": {"id": 311, "tipo": "tristeza", "gravidade": "Alta", "descricao": "...", "data": "2026-10-18T09:15:00Z"}` or `null`.

A second referral for a student who already has one in `"Aguardando Triagem"` or `"Em Atendimento"` is refused with 409 `{"sucesso": false, "mensagem": "Este estudante já possui um encaminhamento em aberto."}`, so one tap from several teachers does not flood the queue with the same student. The teacher's new observation is still recorded and visible to the coordinator in the history.

## Testing Decisions
Routes are exercised through the Flask test client against in-memory tenant databases with tokens for each profile and the scope of `0013`.

- `backend/test/test_models_observacao.py`: constraints and defaults; updates refused by the hook; the occurrence target check.
- `backend/test/test_api_observacoes.py`: each validation message; quick records default to `"Baixa"` and refuse a description; out-of-scope students give 404; `equipe_multidisciplinar` gets 403.
- `backend/test/test_api_ocorrencias.py`: student and class targets, the target check, listing with filters and pages, coordinator-only access.
- `backend/test/test_api_estudante_historico.py`: merge order across the three kinds; date filters inclusive in America/Sao_Paulo; class occurrences included for each student of the class; per-profile field projection, with a `docente` never receiving `motivo`; pagination; out-of-scope 404.
- `backend/test/test_api_estudante.py` (from `0004`, extended): `emocoes_recentes` lists only the last 7 days, deduplicated, without `"outro"`.
- `backend/test/test_api_encaminhamentos_docente.py` (from `0006`, extended): `observacao_id` validation, the default `motivo`, the duplicate-open-referral 409.

## Out of Scope
- Screens, chips, and the timeline, specified in [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md).
- Severity review by the coordinator, specified in [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md).
- Risk classification and alerts, specified in [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md).
- Attachments, specified in [todo/0031-observation-evidence-attachments-backend.md](0031-observation-evidence-attachments-backend.md).
- Marking an observation as in follow-up, specified in [todo/0033-observation-follow-up-status-backend.md](0033-observation-follow-up-status-backend.md).
- Voice dictation of descriptions.
