# Observation Severity Review Frontend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a Pedagogical Coordinator, I want to review the records made by teachers to validate the severity of the signs" (value 500, 3 points).*

*This specification defines the coordinator's review queue and the review badges in the student history. Its backend counterpart is [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md), which pins every route, payload, and message used here; this spec can be built against that contract before it ships. It builds on the history renderer of [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md) and lands after it.*

## Problem
The coordinator has no screen where teachers' observations arrive. To see what was recorded this week they would open each student's history in "Busca & Registros" one by one, so in practice a mis-graded severity is never looked at again. Teachers, in turn, never learn whether the coordination agrees with how they grade what they see, because the history shows only their own severity.

## Business Vision and Purposes
The review is only worth doing if it is fast: the coordinator should clear a morning's worth of records in a few minutes, validating most with one click and spending their time on the few that need a correction. Teachers should see the outcome where they already look, the student's history, so the feedback reaches them without a new screen to visit.

## Solution
The coordination panel gains a "Revisão de Registros" tab with a badge counting pending records. The tab lists pending observations with the most severe first, each as a card with the student, class, teacher, date, type, severity, and description. Each card offers "Validar gravidade" and "Ajustar gravidade"; adjusting reveals the three levels and a required note. A reviewed card leaves the list. A filter shows low-severity records and already reviewed ones on request. In every student history, an observation shows "Aguardando revisão", "Gravidade validada pela coordenação", or "Gravidade ajustada pela coordenação: Alta → Média" with the coordinator's note.

## User Stories
1. As a Coordenador Pedagógico, I want a tab with a pending count, so that I know when there is review work waiting.
2. As a Coordenador Pedagógico, I want to validate a record with one click, so that the common case is quick.
3. As a Coordenador Pedagógico, I want adjusting to require a note and tell me who will read it, so that I write it for the teacher.
4. As a Coordenador Pedagógico, I want to include low-severity records or see what I already reviewed, so that I can audit my own queue.
5. As a Docente, I want each of my observations in the history to show whether it was validated or adjusted, and why, so that I calibrate how I grade.

## Implementation Decisions

### The review tab
A new button joins the coordinator's `tabs-nav`, `#btn-gestor-tab-revisao`, labelled "Revisão de Registros" with a count badge, controlling `#gestor-tab-revisao`. The badge shows the sum of `pendentes["Média"]` and `pendentes["Alta"]`, the records the default filter shows, and its accessible name reads "Revisão de Registros, {n} pendentes". The count is loaded when the coordination panel opens, so it is visible before the tab is clicked, and refreshed after every review.

The tab loads `GET /api/gestao/observacoes/revisao` through `window.apiRequest`. Above the list, a filter row has a `<select>` labelled "Situação" with "Pendentes", "Validadas", "Ajustadas", a checkbox "Incluir gravidade baixa", and a class `<select>` labelled "Turma" filled from `GET /api/turmas` with "Todas as turmas" first. Changing any filter re-requests from page 1. Under the filters, when "Incluir gravidade baixa" is off and `pendentes["Baixa"] > 0`, a muted line reads "{n} registros de gravidade baixa aguardando revisão não estão sendo exibidos.", so hiding them is never silent.

Each item is an `<article>` card with the student's name and class, "Registrado por {autor} em {dd/mm/aaaa hh:mm}", the type label, the severity badge with its text, the description or "Sem descrição" for quick records (with "Registro rápido" next to the type), and the actions. The severity colours are the ones `0016` uses in the history, always with the text label.

### Validating and adjusting
"Validar gravidade" sends `{"decisao": "validada"}` immediately, without a confirmation step. A validation cannot be undone, but it only confirms what the teacher already wrote, and a confirmation on the most frequent action would double the clicks of the whole review. "Ajustar gravidade" expands an inline form inside the card, not a modal, so the coordinator keeps the description in view while writing. The form has a radio group with the legend "Nova gravidade" offering the two levels different from the teacher's, a textarea labelled "Nota para o professor" with a character counter "0 / 500 caracteres", the hint "Esta nota fica visível para quem pode ver o histórico do estudante, incluindo os professores da turma.", and the buttons "Confirmar ajuste" and "Cancelar". Opening it moves focus to the first radio; "Cancelar" collapses it and returns focus to "Ajustar gravidade".

While a request runs, both actions of the card are disabled and the pressed button reads "Salvando...". On 200 the card is removed from the list, the toast shows the backend `mensagem`, focus moves to the next card's heading (or to the list's empty state), and the badge count is decremented from a re-request of the first page. On 400 the backend `mensagem` appears inside the card in a `role="alert"` element and the form keeps its values. On 409 the toast shows the backend `mensagem` and the list reloads, since another coordinator reviewed it first.

### States
- Loading: the list shows "Carregando registros..." in an `aria-live="polite"` region.
- Empty, pending filter: "Nenhum registro aguardando revisão. Bom trabalho!"
- Empty, other filters: "Nenhum registro encontrado para os filtros selecionados."
- Error: "Não foi possível carregar os registros. Tente novamente." with a "Tentar novamente" button.
- More than 50 results: "Carregar mais" appends the next page, as in the history of `0016`.

In "Validadas" and "Ajustadas", cards show the review outcome, reviewer, date, and note instead of the actions.

### Review outcome in the student history
`renderStudentHistory` of `0016` renders the review fields on observation items, in the student modal and in the search tab alike:

- `"pendente"`: a muted tag "Aguardando revisão".
- `"validada"`: a tag "Gravidade validada pela coordenação".
- `"ajustada"`: the severity badge shows the validated level, followed by "Gravidade ajustada pela coordenação: {gravidade} → {gravidade_validada}", and below it "Nota da coordenação: {nota_revisao}" with "{revisado_por.nome}, {dd/mm/aaaa}".

The arrow is text, and the tag's accessible text reads "Gravidade ajustada pela coordenação de {gravidade} para {gravidade_validada}", so a screen reader does not read an arrow symbol. The adjusted badge uses the validated level's colour, because that is the level the platform now acts on.

### What is deleted
Nothing in the prototype implements review, so nothing is deleted. Every change is mirrored in `frontend/src/templates/dashboard.html`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Both modules drive the real `dashboard.html` through `frontend/test/dashboard_harness.js` with `fetch` doubled per route.

- `frontend/test/test_observation_review_queue.js`: as `gestor_escolar`, the badge loads with the panel and announces its count; default request parameters; the hidden low-severity line; filters re-request from page 1; validate sends the payload and removes the card; adjust requires a level and a note, shows the 400 `mensagem` inline, and returns focus on cancel; 409 reloads the list; loading, empty, error, and "Carregar mais" states; the tab is absent for `docente`.
- `frontend/test/test_history_review_badges.js`: as `docente` and as `gestor_escolar`, the three review states render in the student modal and the search timeline, the adjusted badge uses the validated level, and the accessible text of the adjustment.

## Out of Scope
- Backend routes, the one-review rule, and the effective severity, specified in [todo/0019-observation-severity-review-backend.md](0019-observation-severity-review-backend.md).
- Notifying teachers of a review outside the history.
- Bulk validation from the list.
