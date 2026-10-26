# Monthly Climate Report Export Backend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a Pedagogical Coordinator, I want to export monthly reports on the school's emotional climate to present to the principal" (value 500, 3 points).*

*This specification defines the backend of the monthly emotional climate report, generated as CSV, PDF, or a JSON preview. Its frontend counterpart is [todo/0026-monthly-climate-report-export-frontend.md](0026-monthly-climate-report-export-frontend.md), which can be built against this contract before it ships. It reuses the aggregation and small-cell suppression of [todo/0023-emotional-climate-dashboards-backend.md](0023-emotional-climate-dashboards-backend.md), the `RiskService` and alerts of [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md), the review columns of [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md), and the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md).*

## Problem
Once a month the coordinator reports to the principal, and sometimes to the education department, on how the school is doing emotionally. Today that means screenshots, hand-counted figures, or a spreadsheet typed from memory. Screenshots of the platform carry student names, and copying figures by hand from the climate panel of [0023](0023-emotional-climate-dashboards-backend.md) is slow and loses the safeguards the panel applies: nothing stops a coordinator from typing "1 student in critical risk in the 3º Ano C" into a document that circulates by e-mail.

## Business Vision and Purposes
A monthly report is the artifact that takes the platform's value out of the platform: it is what the principal reads, what goes into the school's records, and what justifies the multidisciplinary team's time. It must be produced in one click, contain only aggregates that are safe to circulate, look official enough to hand over as a PDF, and also come as data a secretary can paste into the department's spreadsheet.

## Solution
The coordinator picks a month and downloads the school's climate report as a PDF or a CSV, or previews it on screen first. The report covers the school and each class: observations recorded in the month by severity and type, students observed, the risk distribution at the end of the month, alerts raised, referrals opened and concluded, severity reviews done, coordination occurrences by type, and the change from the previous month. It contains no student name, no registration number, and no free text, and every figure about fewer than three students is replaced by a marker. The current month can be exported and is marked as partial.

## User Stories
1. As a Coordenador Pedagógico, I want to download a PDF of last month's climate, so that I hand it to the principal as is.
2. As a Coordenador Pedagógico, I want the same figures as a CSV, so that the secretary pastes them into the department's spreadsheet.
3. As a Coordenador Pedagógico, I want to preview the report before downloading, so that I know what I am about to circulate.
4. As a principal reading the report, I want the change from the previous month and a note on how the figures were produced, so that I interpret them correctly.
5. As a school, I want the report to contain nothing that identifies a student, so that it can circulate by e-mail and on paper.

## Implementation Decisions

### Route
`GET /api/gestao/relatorios/clima?mes=2026-09&formato=pdf` — `gestor_escolar` only.

- `mes` is required, `YYYY-MM`, interpreted in America/Sao_Paulo. A missing or malformed value returns 400 `{"sucesso": false, "mensagem": "Informe o mês no formato AAAA-MM."}`; a month after the current one returns 400 `{"sucesso": false, "mensagem": "O relatório só pode ser gerado para meses já iniciados."}`.
- `formato` is `pdf`, `csv`, or `json`, default `pdf`. Any other value returns 400 `{"sucesso": false, "mensagem": "Formato inválido. Use csv, pdf ou json."}`.

The `json` format returns the report model below with `200` and `application/json`, for the on-screen preview. The two file formats return `200` with `Content-Disposition: attachment; filename="clima-escolar-2026-09.pdf"` (or `.csv`), `Content-Type: application/pdf` or `text/csv; charset=utf-8`, and `Cache-Control: no-store`. The route lives in a blueprint in `src/routes/relatorios.py`. A GET with query parameters was chosen over a POST because the request has no body worth the name and changes nothing; the parameters are a month and a format, never student data, so they are safe in a URL.

### Report model
`src/reports/climate_monthly.py` defines `MonthlyClimateReportBuilder(session, aggregator, risk_service, clock)` with `build(mes) -> MonthlyClimateReport`. The JSON format serializes it directly:

```json
{
  "escola": "Escola Estadual João de Barro",
  "mes": "2026-09",
  "parcial": false,
  "gerado_em": "2026-10-02T11:20:00Z",
  "gerado_por": "Coord. Helena Prado",
  "minimo_por_celula": 3,
  "escola_resumo": {
    "total_estudantes": 640,
    "registros": 402,
    "registros_mes_anterior": 351,
    "variacao_percentual": 14.5,
    "estudantes_com_registro": 188,
    "por_gravidade": {"Baixa": 250, "Média": 118, "Alta": 34},
    "por_tipo": {"ansiedade": 131, "tristeza": 97, "agitacao": 80, "apatia": 61, "euforia": 17, "outro": 16},
    "risco_ao_fim": {"leve": 601, "moderado": 29, "critico": 10},
    "alertas": {"moderado": 33, "critico": 12},
    "encaminhamentos": {"abertos": 14, "concluidos": 9, "por_prioridade": {"Baixa": 3, "Média": 6, "Alta": 5}},
    "revisoes": {"validadas": 120, "ajustadas": 17},
    "ocorrencias_por_tipo": {"Conflito entre Alunos": 6, "Indisciplina Grave": 4, "Emergência Médica": null, "Apoio Familiar": 5, "Saúde Mental": 3},
    "celulas_suprimidas": ["ocorrencias_por_tipo.Emergência Médica"]
  },
  "turmas": [
    {
      "id": 1,
      "nome": "1º Ano A",
      "total_estudantes": 34,
      "registros": 41,
      "registros_mes_anterior": 30,
      "variacao_percentual": 36.7,
      "estudantes_com_registro": 15,
      "por_gravidade": {"Baixa": 27, "Média": 11, "Alta": 3},
      "risco_ao_fim": {"leve": 29, "moderado": null, "critico": null},
      "alertas": {"moderado": 4, "critico": null},
      "encaminhamentos_abertos": 3,
      "celulas_suprimidas": ["risco_ao_fim.moderado", "risco_ao_fim.critico", "alertas.critico"]
    }
  ]
}
```

The definitions, each counted over the calendar month in America/Sao_Paulo:

- `registros`, `por_gravidade`, `por_tipo`, `estudantes_com_registro`: observations of `0015` created in the month, by effective severity of `0019`.
- `risco_ao_fim`: `RiskService` of `0021` evaluated at the last instant of the month, or now for a partial month.
- `alertas`: `alertas` rows of `0021` created in the month, by `nivel`.
- `encaminhamentos`: referrals of [0006](0006-referral-queue-management-backend.md) created in the month (`abertos`, and by `prioridade`), and those whose `updated_at` falls in the month with `status` `"Concluído"` (`concluidos`).
- `revisoes`: observations of `0019` whose `revisado_em` falls in the month, by `status_revisao`.
- `ocorrencias_por_tipo`: coordination occurrences of `0015` created in the month.
- `variacao_percentual`: `(registros - registros_mes_anterior) / registros_mes_anterior × 100`, rounded to one decimal, `null` when the previous month had zero records or either count is hidden.

Per-class rows carry the subset that is meaningful per class; occurrences and reviews are school-level only, because per class they would almost always fall under the threshold.

### Suppression
Every figure goes through `suppress_group` of `0023` with the same threshold of 3 and the same complementary rule. Each cell is backed by the distinct students behind it: observations, alerts, referrals, and reviews by their `estudante_id`; a student-targeted occurrence by its student; a class-targeted occurrence by every student of the class. A row's `total_estudantes` below 3 hides the whole row. The suppression is the same function the panel uses, so the report can never show a figure the panel hid; a test compares the two for the same month.

The report also omits by construction everything that could identify a student: no `nome`, no `matricula`, no `descricao`, `motivo`, `nota_revisao`, or any other free text, and no per-student row. Class names are kept, since the report is about classes. `gerado_por` is the coordinator's name, which the principal needs to know who issued the document.

### CSV format
One file in long format, one figure per line, so it pastes into any spreadsheet and re-aggregates without parsing nested headers:

```
secao;turma;indicador;categoria;valor;observacao
escola;;registros;;402;
escola;;por_gravidade;Alta;34;
escola;;ocorrencias_por_tipo;Emergência Médica;;oculto (menos de 3 estudantes)
turma;1º Ano A;risco_ao_fim;critico;;oculto (menos de 3 estudantes)
```

The file is UTF-8 with a byte order mark, `;` as separator, and CRLF line endings. These three choices are what make a CSV open correctly by double-click in Excel configured for Brazilian Portuguese, which uses the comma as decimal separator and otherwise misreads accented characters; the decimal values themselves use a comma (`14,5`) for the same reason. A hidden value is an empty `valor` with the reason in `observacao`, rather than a text marker like `<3` in `valor`, so a column sum in a spreadsheet does not break. The writer is `src/reports/csv_writer.py` on the standard library's `csv` module.

### PDF format and library
The PDF is rendered by fpdf2 behind an adapter, per [ADR-0002](../adr/0002-infrastructure-adapters-encapsulation.md). The report builder produces a library-neutral `ReportDocument` (title, metadata lines, sections of paragraphs and tables) in `src/reports/document.py`; `src/adapters/pdf_fpdf2.py` defines `Fpdf2Renderer.render(document) -> bytes`, the only module that imports `fpdf`. A `PdfRenderer` protocol in `src/reports/document.py` is what the route receives from `create_app`, so tests inject a fake renderer and a later library change touches one module.

I chose fpdf2 over the alternatives for the deployment, not the features:

- WeasyPrint renders HTML and CSS, which would make the layout pleasant to write, but it needs Pango and its native libraries installed in the `python:3.14-slim` image through the system package manager, which adds a native dependency chain to build and patch for a three-table document.
- ReportLab is the most capable option and BSD-licensed, but its layout engine is far larger than three tables and a header need, and its native extensions add a wheel to wait for on each new Python version.
- fpdf2 is pure Python, has a table API that covers this layout, and its dependencies (Pillow, fontTools, defusedxml) are pure Python or ship wheels widely; Pillow is also what [0031](0031-observation-evidence-attachments-backend.md) needs to strip metadata from photos, so the platform gains one image library, not two. fpdf2 is LGPL-3.0; using it unmodified as a library is compatible with how the platform is distributed. The availability of Pillow wheels for Python 3.14 is unverified; the CI image build of [0010](0010-backend-foundation-and-delivery-hardening-backend.md) fails before deploy if one is missing.

The core PDF fonts cover only Latin-1, and class names are typed by coordinators, so the adapter embeds DejaVu Sans (regular and bold, permissive licence) from `backend/src/adapters/fonts/`. `fpdf2` and the font files are added to `requirements.txt` and the repository respectively.

The document is A4 portrait: a title "Relatório Mensal de Clima Emocional", the school, "Mês de referência: setembro de 2026", "Gerado em 02/10/2026 às 08:20 por Coord. Helena Prado", and, for a partial month, "Relatório parcial: o mês ainda não terminou." in bold. Then the school summary as two tables, the per-class table, and a closing section "Como ler este relatório" with three fixed paragraphs: the risk levels come from a deterministic rule over the last 14 days of records, not from a diagnosis or from artificial intelligence; figures about fewer than 3 students are shown as "oculto"; and figures for past months reflect reviews made after the month ended. Every page footer reads "Documento com dados agregados. Não contém nomes de estudantes." and "Página {n} de {total}". A school of 40 classes fits in about 3 pages, estimated.

### Regenerating a past month
A report is computed when requested, never stored, so regenerating September in November can differ from the September copy downloaded on 1 October: reviews of `0019` done in between change effective severities, and new students change `total_estudantes`. Storing each generated report was the alternative; I rejected it because a stored file is one more copy of school data to secure and retain, while the generation timestamp printed on every page already tells two readers why their copies differ.

### Audit
Exports leave the platform, so the route calls `AuditLogger.registrar` of [0027](0027-access-audit-log-backend.md) for `pdf` and `csv`, with `acao` `"exportar_relatorio_clima"`, `recurso` `"relatorio_clima:2026-09"`, and no `estudante_id`; the action joins the registry of `0027` with the description "Exportou o relatório mensal de clima". The `json` preview is an on-screen aggregate like the panel of `0023` and is not logged.

## Testing Decisions
Routes are exercised through the Flask test client against in-memory tenant databases with a fixed injected clock; the PDF adapter is tested against the real fpdf2.

- `backend/test/test_reports_climate_monthly.py`: each definition on seeded data across a month boundary in America/Sao_Paulo; the partial flag; `variacao_percentual` including the zero and hidden cases; suppression identical to the panel of `0023` for the same data; no field of the model carries a student name, registration, or free text (the test walks the serialized model and fails on any seeded student string).
- `backend/test/test_reports_csv_writer.py`: byte order mark, separator, CRLF, decimal comma, empty `valor` with `observacao` for hidden cells.
- `backend/test/test_reports_document.py`: the `ReportDocument` built from a model has the title, metadata, partial notice, tables, and the reading notes.
- `backend/test/test_adapters_pdf_fpdf2.py`: renders a document with accented class names to bytes starting with `%PDF-`, containing the page footer text, and with the expected page count for a 40-class fixture.
- `backend/test/test_routes_relatorios.py`: every validation message; the three formats with their headers and filenames; `gestor_escolar` only; audit rows for file exports and none for the preview.

## Out of Scope
- The download screen and preview, specified in [todo/0026-monthly-climate-report-export-frontend.md](0026-monthly-climate-report-export-frontend.md).
- Charts inside the PDF; they would need a plotting library for one page, and the panel of `0023` already draws them.
- Scheduled or e-mailed reports; the coordinator downloads and sends.
- Reports for periods other than a calendar month, and reports by class for the class's teachers.
- Reports across schools for the education department.
