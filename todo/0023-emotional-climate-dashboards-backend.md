# Emotional Climate Dashboards Backend

*Phase: Increment #2 (walking skeleton). Story-map cards: "As a Pedagogical Coordinator, I want to see a panel with the emotional situation of every class in the school" (value 800, 8 points); "As a Teacher, I want to see behavior trend charts for my class over the semester" (value 500, 3 points).*

*This specification defines the backend of the aggregated climate data: a school overview by class for the coordinator, and a class trend over time for teachers and the coordinator. Its frontend counterpart is [todo/0024-emotional-climate-dashboards-frontend.md](0024-emotional-climate-dashboards-frontend.md), which can be built against this contract before it ships. It depends on the observations of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), the effective severity of [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md), the `RiskService` of [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md), and the scope of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md). [todo/0025-monthly-climate-report-export-backend.md](0025-monthly-climate-report-export-backend.md) reuses its aggregation and suppression.*

## Problem
The coordinator can read one student at a time, and after [0021](0021-risk-classification-alerts-backend.md) can filter rosters by risk, but cannot answer the question the school's leadership actually asks: how is each class doing, and is it getting better or worse? A class where anxiety records doubled in two weeks, or where four students reached moderate risk at once, looks the same as any other until someone reads every history in it. Teachers have the same blind spot for their own classes over the semester: they remember the last week, not the trend since August.

## Business Vision and Purposes
Class-level patterns call for class-level actions: a talk with the class before exams, a change of seating, a session with the multidisciplinary team, a conversation with the class's teachers. The coordinator needs one screen that ranks classes by need, and teachers need to see whether what they do in class moves the trend. Both views must be safe to show in a staff meeting, which means no number on them may point at an individual student.

## Solution
The coordinator gets a school overview: for each class, its students' distribution across the three risk levels, the number of observations in the last 14 days compared with the 14 days before, a trend word ("em alta", "estável", "em queda"), and the breakdown by observation type, plus the same figures for the whole school. The overview can be filtered to classes with students at a given risk level. Teachers get, for each of their classes, and the coordinator for any class, a trend over a period (the current semester by default) by week or by month: observations by severity and type, how many students were observed, and the risk distribution at the end of each period. Any figure that would describe fewer than three students is replaced by a marker that says it was hidden.

## User Stories
1. As a Coordenador Pedagógico, I want every class of the school on one panel with its risk distribution and recent trend, so that I see which classes need action first.
2. As a Coordenador Pedagógico, I want to filter the panel to classes with students at critical or moderate risk, so that I prioritize.
3. As a Docente, I want a week-by-week trend of my class over the semester, so that I see whether the climate is improving.
4. As a Coordenador Pedagógico, I want to open the same trend for any class, so that I prepare a conversation with its teachers.
5. As a school, I want no aggregate figure to identify a student, so that the panels can be shown in meetings.

## Implementation Decisions

### Small-cell suppression
Every count on these routes is a cell backed by a set of distinct students, and a cell backed by one or two students is suppressed: its value becomes `null` and its path is listed in `celulas_suprimidas`. A cell backed by zero students is shown as `0`, since "nobody" identifies no one. The threshold lives in `src/climate/suppression.py` as `MIN_CELL_SIZE = 3`.

Suppressing a cell is not enough when its group's total is also published, because the total minus the visible cells gives back what is hidden. So, within a group with a published total, while the hidden cells together are backed by one or two distinct students, the smallest non-zero visible cell of the group is hidden too (complementary suppression). This covers both the single hidden cell, which the subtraction would reveal exactly, and two hidden cells whose sum would still point at one or two students. The groups are the risk distribution, whose total is `total_estudantes`, and the breakdowns by type and by severity, whose total is the observation count.

```
distribuicao_risco of a class of 34, raw:        {"leve": 29, "moderado": 4, "critico": 1}
after suppression and complementary suppression: {"leve": 29, "moderado": null, "critico": null}
```

A class with fewer than 3 students has every student-based cell suppressed. A threshold of 3 is the floor commonly used for small-group statistical disclosure; I chose it over 5 because classes in this setting have 25 to 40 students, and at 5 most per-class breakdowns of a quiet fortnight would vanish.

Rosters are not suppressed (see `0021`), so the coordinator can still read each student's level one by one. The suppression exists because these panels are the screens that get projected in a staff meeting or sent to the principal, where an "1 crítico" next to a class of a dozen students points at someone.

### School overview
`GET /api/gestao/clima` — `gestor_escolar` only. Optional `risco`, comma-separated as in `0021`, keeps only classes with at least one student at one of the given levels; an unknown value returns 400 `{"sucesso": false, "mensagem": "Filtro de risco inválido. Use leve, moderado ou critico."}`. Classes are ordered by `distribuicao_risco.critico` then `moderado`, descending on the raw counts, so the neediest come first even when their counts are hidden.

```json
{
  "gerado_em": "2026-10-26T14:00:00Z",
  "janela_dias": 14,
  "minimo_por_celula": 3,
  "escola": {
    "total_estudantes": 640,
    "distribuicao_risco": {"leve": 598, "moderado": 31, "critico": 11},
    "registros_14_dias": 214,
    "registros_14_dias_anteriores": 180,
    "tendencia": "estavel",
    "registros_por_tipo": {"ansiedade": 71, "tristeza": 52, "agitacao": 40, "apatia": 33, "euforia": 9, "outro": 9},
    "celulas_suprimidas": []
  },
  "turmas": [
    {
      "id": 1,
      "nome": "1º Ano A",
      "turno": "matutino",
      "total_estudantes": 34,
      "distribuicao_risco": {"leve": 29, "moderado": null, "critico": null},
      "registros_14_dias": 22,
      "registros_14_dias_anteriores": 12,
      "tendencia": "alta",
      "estudantes_com_registro": 11,
      "registros_por_tipo": {"ansiedade": 9, "tristeza": 6, "agitacao": 4, "apatia": null, "euforia": 0, "outro": null},
      "celulas_suprimidas": ["distribuicao_risco.moderado", "distribuicao_risco.critico", "registros_por_tipo.apatia", "registros_por_tipo.outro"]
    }
  ]
}
```

`registros_*` count observations by `created_at` in the 14 days up to now and the 14 before. `distribuicao_risco` comes from `RiskService` of `0021` evaluated now, so it always equals what the rosters show. `tendencia` compares the two windows: `"alta"` when the recent count is at least 20% and at least 3 records above the previous one, `"queda"` when it is at least 20% and at least 3 records below, `"estavel"` otherwise, and `null` when either count is suppressed. The 3-record floor keeps a quiet class from flipping between "alta" and "queda" on one record; going from 2 to 3 records is +50% and means nothing.

Presence is disclosed by the filter even when the count is not: a class that appears under `risco=critico` with a suppressed `critico` cell has one or two students at that level. I accept this because hiding such a class from a "critical" filter would hide exactly the students the filter exists to find; the impact is limited to a coordinator who can already read each level in the rosters, and the frontend of [0024](0024-emotional-climate-dashboards-frontend.md) mitigates it by showing the filter's state on screen, so a projected panel says what it was filtered by.

### Class trend
`GET /api/turmas/<int:id>/tendencia` — `gestor_escolar` for any class, `docente` for their assigned classes. A class outside the caller's scope, or unknown, returns 404 `{"sucesso": false, "mensagem": "Turma informada não encontrada."}`, as `0013` does for students. `equipe_multidisciplinar` gets 403: their scope is a set of students, not classes.

Parameters, all optional:

- `de` and `ate`, dates `YYYY-MM-DD` in America/Sao_Paulo, inclusive. `de` defaults to the start of the current semester, taken as 1 January or 1 July; `ate` defaults to today and is clipped to today when later.
- `granularidade`: `semana` (default; ISO weeks, Monday to Sunday) or `mes` (calendar months). The first and last buckets are clipped to `de` and `ate`, so a bucket never counts days outside the requested range.

Errors, all 400 with `"sucesso": false`:

- `"Datas inválidas. Use o formato AAAA-MM-DD."`
- `"A data inicial deve ser anterior à data final."`
- `"Granularidade inválida. Use semana ou mes."`
- `"Período muito longo para a granularidade escolhida."` beyond 184 days for `semana` (27 bars on a phone is already the readable maximum) or 366 days for `mes`.

```json
{
  "turma": {"id": 1, "nome": "1º Ano A", "total_estudantes": 34},
  "de": "2026-07-01",
  "ate": "2026-10-26",
  "granularidade": "semana",
  "minimo_por_celula": 3,
  "series": [
    {
      "inicio": "2026-10-19",
      "fim": "2026-10-25",
      "suprimido": false,
      "registros": 14,
      "estudantes_com_registro": 6,
      "por_gravidade": {"Baixa": 8, "Média": null, "Alta": null},
      "por_tipo": {"ansiedade": 6, "tristeza": 4, "agitacao": null, "apatia": 0, "euforia": 0, "outro": null},
      "risco_ao_fim": {"leve": 30, "moderado": 4, "critico": 0},
      "celulas_suprimidas": ["por_gravidade.Média", "por_gravidade.Alta", "por_tipo.agitacao", "por_tipo.outro"]
    },
    {
      "inicio": "2026-10-26",
      "fim": "2026-10-26",
      "suprimido": true,
      "registros": null,
      "estudantes_com_registro": null,
      "por_gravidade": null,
      "por_tipo": null,
      "risco_ao_fim": {"leve": 34, "moderado": 0, "critico": 0},
      "celulas_suprimidas": ["registros", "estudantes_com_registro", "por_gravidade", "por_tipo"]
    }
  ]
}
```

A bucket observed in only one or two students is suppressed whole (`suprimido: true`), because its total alone would say "these records are about one or two students", and in a teacher's own class that is often enough to name them. `por_gravidade` uses the effective severity of `0019`. `risco_ao_fim` is the risk distribution evaluated by `RiskService` at the last instant of the bucket, so the chart shows how many students were at each level week by week, which is the trend the teachers' card asks for; its cells follow the same suppression.

Students are counted in their current class. There is no class history in the roster of [0004](0004-student-class-management-backend.md), so a student who changed class mid-semester brings their earlier observations into the new class's trend. This is accepted for the walking skeleton, since class changes are rare during a semester, and noted for later.

### Modules and cost
`src/climate/suppression.py` holds `MIN_CELL_SIZE` and `suppress_group(cells, total_published) -> (values, suppressed_paths)`, a pure function over cells carrying a value and their distinct student ids. `src/climate/periods.py` computes the semester default and the clipped weekly and monthly buckets. `src/climate/aggregator.py` defines `ClimateAggregator(session, risk_service, clock)` with `school_overview(risco)` and `class_trend(turma_id, de, ate, granularidade)`; `0025` calls the same class with a month. The routes live in a blueprint in `src/routes/clima.py`. Everything is built in `create_app` and injected, per [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md).

Each route runs one query: the overview loads the last 28 days of observations of the school (about 6,000 rows for 2,000 students at the volume `0021` assumes), the trend loads one class's observations over the range plus the 14 days before its start. Aggregation happens in Python; both are estimated under 200 ms, not measured. If the pilot measures the overview above 1 s, a 60-second per-tenant cache in the aggregator is the next step; I left it out because a cache of student-derived data is one more thing to invalidate on anonymization.

### Audit and data protection
These routes return no individual data once suppression has run, so they do not write to the audit log of [0027](0027-access-audit-log-backend.md); `0027` lists them among the routes it deliberately leaves out. Anonymized students keep counting, as [0017](0017-lgpd-privacy-compliance-backend.md) intends, so the school's figures do not shift when a student leaves.

## Testing Decisions
Pure functions are tested directly; routes through the Flask test client against in-memory tenant databases with tokens for each profile and a fixed injected clock.

- `backend/test/test_climate_suppression.py`: cells of 0, 1, 2, and 3 students; complementary suppression when one cell is hidden, when two hidden cells are backed by only two students together, and none when the hidden cells are backed by three or more; a group whose total is itself hidden; the paths listed in `celulas_suprimidas`.
- `backend/test/test_climate_periods.py`: semester defaults on both halves of the year; ISO weeks across a year boundary; clipping of first and last buckets; months.
- `backend/test/test_climate_aggregator.py`: risk distribution equal to `RiskService`; 14-day windows; every `tendencia` case including the 3-record floor and the suppressed case; effective severity used in `por_gravidade`; `risco_ao_fim` evaluated at each bucket end; anonymized students counted.
- `backend/test/test_routes_clima.py`: overview access (`gestor_escolar` only), ordering, the `risco` filter and its 400; trend access per profile with 404 for an unassigned class and 403 for `equipe_multidisciplinar`; every validation message; the 184 and 366-day limits; a fully suppressed bucket.

## Out of Scope
- The panels and charts, specified in [todo/0024-emotional-climate-dashboards-frontend.md](0024-emotional-climate-dashboards-frontend.md).
- The monthly report file, specified in [todo/0025-monthly-climate-report-export-backend.md](0025-monthly-climate-report-export-backend.md).
- Per-student trends; the student history of `0015` already orders a student's records over time.
- Class membership history, and comparisons across schools.
- Any predictive or AI-based climate indicator, which belongs to Increments #3 to N.

## Further Notes
The semester boundaries (1 January and 1 July) are a placeholder for the school calendar, which the platform does not model. Brazilian schools usually start the year in February and the second semester in late July or August, so the default range shows a few empty weeks at its start. If the product owner wants real term dates, the smallest change is two tenant settings for the start of each semester.

Whether `MIN_CELL_SIZE` should be 3 or 5 should be confirmed with each school's encarregado, since it is a disclosure-control choice the school answers for.
