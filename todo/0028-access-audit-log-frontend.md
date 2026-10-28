# Access Audit Log Frontend

*Phase: Increment #2 (walking skeleton). Story-map card: "As an admin, I want an audit log to know who accessed a given student's information" (value 300, 3 points).*

*This specification defines the coordinator's audit screen. Its backend counterpart is [todo/0027-access-audit-log-backend.md](0027-access-audit-log-backend.md), which pins the query routes, the payloads, the action registry, and every message used here; this spec can be built against that contract before it ships. It adds an entry point to the search timeline rewired by [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md) and uses the team listing of [todo/0011-access-management-backend.md](0011-access-management-backend.md).*

## Problem
When a family or the school's encarregado asks who has seen a student's records, the coordinator has nowhere to look. The only "Auditoria" in the dashboard today is the "Aguardando Auditoria" counter of the credentialing tab, which counts pending registrations and has nothing to do with access to student data. Once the backend records every access, the coordinator still needs a screen that turns the log into an answer in a few clicks.

## Business Vision and Purposes
The audit screen is used rarely and under pressure: a complaint, a suspicion, a request from the encarregado. It has to answer "who accessed this student" and "what did this professional access" without training, show enough context to judge each entry, and make plain that the log cannot be altered, so the coordinator can cite it with confidence.

## Solution
The coordination panel gains an "Auditoria de Acessos" tab. Filters at the top select a student by name, a professional from the school team, an action, and a period, which defaults to the last 30 days. The table below lists matching entries, newest first: date and time, professional and profile, the action in plain Portuguese, the student and class, and the IP address, 50 per page. A line under the title states the retention period and that entries cannot be changed. From any student's timeline in "Busca & Registros", a "Ver acessos a este estudante" button opens the tab already filtered to that student.

## User Stories
1. As a Gestor Escolar, I want to pick a student by name and see everyone who accessed their records, so that I can answer a family.
2. As a Gestor Escolar, I want to pick a professional and see what they accessed in a period, so that I can check a concern about them.
3. As a Gestor Escolar, I want to jump from a student's timeline straight to their access log, so that I do not retype the name.
4. As a Gestor Escolar, I want denied attempts to stand out in the list, so that probing is visible at a glance.
5. As a keyboard or screen reader user, I want the filters and table to be operable and announced, so that I can audit without a mouse.

## Implementation Decisions

### The audit tab
The coordinator's `tabs-nav` gains `#btn-gestor-tab-auditoria`, "Auditoria de Acessos", controlling `#gestor-tab-auditoria`. Under the title, a fixed line reads "Os registros de acesso são mantidos por {retencao_anos} anos e não podem ser alterados nem excluídos, inclusive pela coordenação.", filled from `retencao_anos` of the response. The tab loads with the default filters the first time it opens.

### Filters
The filters sit in a `<form>` with a "Filtrar" submit button and a "Limpar filtros" button that restores the defaults; submitting re-requests from page 1. The fields:

- "Estudante": a text input with an autocomplete list built from `GET /api/estudantes?q=` after 3 characters, debounced by 300 ms. It follows the ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls` on a `role="listbox"` of options showing "{nome} · {turma}"), with arrow keys, Enter, and Escape. Choosing a student stores its id and shows a removable chip "Estudante: {nome}" with a "Remover filtro de estudante" button. Anonymized students do not appear in this search, since the roster excludes them; their entries remain reachable by professional and period.
- "Profissional": a `<select>` filled once from `GET /api/gestao/equipe` of `0011`, with "Todos os profissionais" first and each option "{nome} ({perfil})", using the profile labels of `0009`.
- "Ação": a `<select>` filled once from `GET /api/gestao/auditoria/acoes`, with "Todas as ações" first and each `descricao` as the option text.
- "De" and "Até": `<input type="date">`, defaulting to 30 days ago and today. The browser's date picker is acceptable here, unlike the month picker of [0026](0026-monthly-climate-report-export-frontend.md), because every current desktop and mobile browser implements `type="date"`.

A 400 from the backend, such as a period over 366 days, shows its `mensagem` under the form in a `role="alert"` element, and the table keeps its previous content.

### The table
A `<table>` with `<caption>` "Registros de acesso" plus the number of results, and `scope="col"` headers "Data e hora", "Profissional", "Ação", "Estudante", and "IP". Each row shows the date as `dd/mm/aaaa hh:mm:ss` in the browser's local time, the professional's name with the profile label below it, `acao_descricao`, the student's name with the class below it ("—" when the entry has no student), and the IP. Lifecycle entries show "Conta: {usuario_alvo.nome}" in the student column, or "Conta: cadastro recusado" when the name is `null`. Anonymized students read "Estudante anonimizado". Rows with `acao` `"acesso_negado"` carry a warning badge "Acesso negado" next to the description, in text and colour.

Below the table, "Página {pagina} de {total_paginas}" with "Anterior" and "Próxima" buttons, disabled at the ends. The results region is `aria-live="polite"` and announces "{total} registros encontrados." after each load, and focus stays on the control the user activated.

On a 375 px phone the table becomes a list of cards with the same fields in the same order, through CSS on the existing `.table-responsive` container, since a five-column table does not fit and the coordinator may need to answer a request away from a desk.

States: "Carregando registros..." while loading; "Nenhum acesso registrado para os filtros selecionados." when empty; "Não foi possível carregar os registros de acesso. Tente novamente." with "Tentar novamente" on failure.

### Entry point from the student timeline
The header of the search timeline of `0016` gains, for `gestor_escolar` only, a "Ver acessos a este estudante" button. It switches to the audit tab with the student chip set, the other filters at their defaults, and the results loaded, and moves focus to the tab's heading. The button does not appear in the teacher's student modal, since teachers cannot read the log.

### Copies
Every change is mirrored under `frontend/src/templates/dashboard.html` and `frontend/src/static/styles.css`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Both modules drive the real `dashboard.html` through `frontend/test/dashboard_harness.js` with `fetch` doubled per route.

- `frontend/test/test_audit_log_tab.js`: as `gestor_escolar`, the tab loads with the default 30-day period; the retention line from `retencao_anos`; the professional and action selects fill from their routes; the student combobox searches after 3 characters, supports keyboard selection, sets and removes the chip; submitting sends every filter; "Limpar filtros"; rows for a student entry, a no-student entry, a lifecycle entry, a refused account, an anonymized student, and a denied access; pagination buttons and their disabled ends; the live announcement; the inline 400 message; loading, empty, and error states; the tab is absent for `docente` and `equipe_multidisciplinar`.
- `frontend/test/test_audit_log_entry_point.js`: "Ver acessos a este estudante" exists only for the coordinator, opens the tab filtered to the student, and moves focus to the heading.

## Out of Scope
- Logging, retention, and the query routes, specified in [todo/0027-access-audit-log-backend.md](0027-access-audit-log-backend.md).
- Exporting the log, and charts of access volume.
- Renaming the "Aguardando Auditoria" counter of the credentialing tab, which `0012` replaces.
