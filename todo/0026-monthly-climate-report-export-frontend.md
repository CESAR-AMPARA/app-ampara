# Monthly Climate Report Export Frontend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a Pedagogical Coordinator, I want to export monthly reports on the school's emotional climate to present to the principal" (value 500, 3 points).*

*This specification defines the coordinator's monthly report screen and the shared authenticated download helper. Its backend counterpart is [todo/0025-monthly-climate-report-export-backend.md](0025-monthly-climate-report-export-backend.md), which pins the route, the formats, the report model, and every message used here; this spec can be built against that contract before it ships. It places the screen in the "Clima Emocional" tab of [todo/0024-emotional-climate-dashboards-frontend.md](0024-emotional-climate-dashboards-frontend.md) and lands after it.*

## Problem
The coordinator has no way to take the school's climate out of the platform in a form fit for the principal. The only options are screenshots, which carry student names from the rosters, or figures copied by hand from the climate panel, which loses the protection the panel applies to small groups. The dashboard also has no way to download a file at all: every request goes through `window.apiRequest`, which parses JSON, and a plain link cannot carry the bearer token that every API route requires.

## Business Vision and Purposes
The monthly report should take one minute: pick the month, glance at the figures, download the PDF for the principal and the CSV for the secretary. The coordinator should know before circulating it that it holds only aggregates, so they can send it without second-guessing what is inside.

## Solution
The "Clima Emocional" tab gains, at its top, a "Relatório Mensal" card with a month and year selector set to the previous month and three buttons: "Pré-visualizar", "Baixar PDF", and "Baixar CSV". The preview shows the school summary and the per-class table in the page, with hidden figures shown as "oculto" and a partial-month banner when the current month is selected. The downloads save the file with its backend name. A fixed note under the buttons says what the report contains and what it never contains.

## User Stories
1. As a Coordenador Pedagógico, I want the previous month selected by default, so that the usual report is two clicks away.
2. As a Coordenador Pedagógico, I want to preview the figures before downloading, so that I know what I am circulating.
3. As a Coordenador Pedagógico, I want to download the PDF and the CSV with clear file names, so that I attach them without renaming.
4. As a Coordenador Pedagógico, I want to be told when the month is not over, so that I do not present partial figures as final.
5. As a keyboard or screen reader user, I want the selector, buttons, and preview to be operable and announced, so that I produce the report without a mouse.

## Implementation Decisions

### Authenticated downloads
`main.js` gains `window.apiDownload(url)`, which fetches with the same bearer header as `apiRequest`, redirects to `/login` on 401 exactly as `apiRequest` does, and on any other non-2xx status parses the JSON body and rejects with its `mensagem`. On success it resolves to `{blob, nomeArquivo}`, taking the name from the `Content-Disposition` header. A companion `window.saveBlob(blob, nomeArquivo)` creates an object URL, clicks a temporary `<a download>`, and revokes the URL on the next tick, so no file data outlives the download in memory.

Putting the token in the URL as a query parameter, so a plain link would work, was the alternative; I rejected it because the token would land in the browser history, in server access logs, and in the `Referer` of any request the downloaded file triggers. The helper is shared: [0030](0030-training-materials-frontend.md) and [0032](0032-observation-evidence-attachments-frontend.md) use it for PDFs and attachments, and whichever of the three specs ships first introduces it with the behaviour above.

### The report card
`#monthly-report-card` sits at the top of `#gestor-tab-clima`, above the summary figures of `0024`, since producing the report is the task the coordinator most often opens the tab for at the start of a month. It contains:

- two `<select>` elements, "Mês" with "janeiro" to "dezembro" and "Ano" from 2026 to the current year, grouped in a `<fieldset>` with the legend "Mês de referência", preset to the previous month. A native `<input type="month">` was the obvious choice and is not used: desktop Firefox and Safari render it as a plain text field, so half the coordinators would be typing "2026-09" by hand. Months after the current one are disabled in the "Mês" list when the current year is selected.
- the buttons "Pré-visualizar", "Baixar PDF", and "Baixar CSV".
- the note "O relatório contém apenas dados agregados por escola e por turma, sem nomes, matrículas ou relatos de estudantes. Valores referentes a menos de 3 estudantes aparecem como “oculto”."

"Baixar PDF" and "Baixar CSV" request `GET /api/gestao/relatorios/clima?mes=AAAA-MM&formato=pdf|csv` through `apiDownload` and save through `saveBlob`. While a request runs, the three buttons are disabled and the pressed one reads "Gerando relatório...". On success the toast reads "Relatório baixado: {nomeArquivo}". On failure the toast shows the backend `mensagem`, or "Não foi possível gerar o relatório. Tente novamente." when there is none, such as a network error.

### Preview
"Pré-visualizar" requests the same route with `formato=json` through `apiRequest` and renders into `#monthly-report-preview`, an `aria-live="polite"` region that announces "Pré-visualização de {mês por extenso} de {ano} carregada." The preview has:

- a banner "Relatório parcial: o mês ainda não terminou." when `parcial` is true, in the warning style, as `role="status"`;
- the header lines "Gerado em {dd/mm/aaaa hh:mm} por {gerado_por}";
- a school table with one row per indicator: "Registros no mês" with the previous month and the variation ("402 (setembro) · 351 (agosto) · +14,5%"), "Estudantes com registro", the three severities, the risk distribution at month end, alerts by level, referrals opened and concluded, reviews validated and adjusted, and occurrences by type;
- a per-class table with columns "Turma", "Estudantes", "Registros", "Variação", "Risco moderado", "Risco crítico", "Alertas", and "Encaminhamentos abertos".

Hidden cells read "oculto" with visually hidden text "(menos de 3 estudantes)". Numbers use the Brazilian format through `toLocaleString('pt-BR')`. Changing the month or year clears the preview, so a stale preview is never shown next to a different selection. Tables have `<caption>` and `scope` headers; on a 375 px phone the per-class table scrolls horizontally inside its own container, which the page already does for `.table-responsive`.

### Copies
Every change is mirrored under `frontend/src/templates/dashboard.html` and `frontend/src/static/main.js`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
The helper is tested on its own; the screen drives the real `dashboard.html` through `frontend/test/dashboard_harness.js`, whose `fetch` double gains response headers and a `blob()` method, with `URL.createObjectURL` and `URL.revokeObjectURL` stubbed, since jsdom implements neither.

- `frontend/test/test_api_download.js`: the bearer header; the filename from `Content-Disposition`; 401 redirects to `/login`; a 400 rejects with the backend `mensagem`; `saveBlob` clicks an anchor with the right `download` name and revokes the URL.
- `frontend/test/test_monthly_report_export.js`: as `gestor_escolar`, the selector defaults to the previous month, including across January; future months disabled; each button sends the right `mes` and `formato`; buttons disabled while generating; success and failure toasts; the preview renders both tables, hidden cells, the partial banner, the variation, and the live announcement; changing the month clears the preview.

## Out of Scope
- Generating the report, its contents, and its suppression, specified in [todo/0025-monthly-climate-report-export-backend.md](0025-monthly-climate-report-export-backend.md).
- Sending the report by e-mail from the platform.
- Printing the preview; the PDF is the printable version.
