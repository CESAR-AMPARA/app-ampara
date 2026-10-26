# Risk Classification and Alerts Frontend

*Phase: Increment #2 (walking skeleton). Story-map cards: "As a Teacher, I want to receive real-time alerts when a student in my class shows multiple risk signals" (value 800, 5 points); "As a user, I want to filter dashboards by risk category (mild, moderate, critical) to prioritize actions" (value 300, 2 points).*

*This specification defines the alert center, the risk badges, and the risk filters of the dashboard. Its backend counterpart is [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md), which pins the classification rule, every route, and every payload used here; this spec can be built against that contract before it ships. It builds on the scoped teacher panel of [todo/0014-teacher-class-assignment-frontend.md](0014-teacher-class-assignment-frontend.md) and the history renderer of [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md), and lands after both.*

## Problem
Nothing on the dashboard tells a teacher or the coordinator which students need attention now. The prototype's class cards said "2 alertas emocionais ativos" and the coordinator's class search said "Alertas de Sintomas", both computed from in-page mock data; [0014](0014-teacher-class-assignment-frontend.md) removed the card line rather than keep faking it, so today the cards say nothing at all. A teacher learns that a student of theirs is in trouble only by opening every history, and a pattern spread across several colleagues' records never reaches them.

## Business Vision and Purposes
An alert is worth something only if it arrives while the adult can still act, and only if it is rare and explained enough to be believed. The dashboard has to surface a new critical alert within a minute without the user reloading, say in one sentence why the student was flagged, and let teachers and the coordinator narrow every roster to the students at a given level, so the start of the day goes to those who need it.

## Solution
Teachers and the coordinator get an "Alertas" button in the dashboard header with a count of unread alerts. It opens a panel listing recent alerts: level, student, class, the reason sentence, and when it happened, with "Ver histórico" and "Marcar como lido". The dashboard checks for new alerts every 60 seconds while the tab is visible; a new alert updates the count, is announced to screen readers, and, when critical, also shows a toast. Every student card and search result shows the student's risk level as a labelled badge, every teacher class card shows how many of its students are at moderate or critical risk, and the student history shows the level with its reason. A "Filtrar por risco" control narrows the teacher's classes, the teacher's student grid, and the coordinator's class and student searches.

## User Stories
1. As a Docente, I want a new critical alert about a student of my class to appear within a minute without reloading, so that I can act during the school day.
2. As a Coordenador Pedagógico, I want the alert list to tell me who, which class, which level, and why, so that I decide what to open first.
3. As a user, I want to mark alerts as read, one by one or all at once, so that the count shows only what is new.
4. As a Docente, I want my class cards to show how many students are at moderate or critical risk, so that I know which class to open.
5. As a Docente or Coordenador Pedagógico, I want to filter classes and students by risk level, so that I see only those who need attention.
6. As a screen reader user, I want new alerts announced and every level written as text, so that I do not depend on colour or on watching the badge.

## Implementation Decisions

### Shared risk vocabulary
Two functions in the dashboard script give every screen the same wording, and [0024](0024-emotional-climate-dashboards-frontend.md) reuses them:

- `riskBadge(nivel)` returns a `<span class="risk-badge risk-{nivel}">` reading "Risco leve", "Risco moderado", or "Risco crítico". The classes use the colours already used for severities (`--ok`, `--warn`, and the terracotta of "Alta"), defined in `styles.css` with a high-contrast variant under `body.high-contrast`. The text is always present, so colour is never the only signal.
- `renderRiskFilter(container, onChange)` renders a `<label for>` "Filtrar por risco" and a `<select>` with "Todos os níveis" (no parameter), "Crítico" (`critico`), "Moderado e crítico" (`moderado,critico`), "Moderado" (`moderado`), and "Leve" (`leve`), and calls `onChange` with the parameter value. A native `<select>` was chosen over a row of toggle buttons because it is keyboard and screen-reader accessible without extra ARIA, and it fits a 375 px phone.

### Alert center
The header gains, for `docente` and `gestor_escolar` only, a button `#btn-alertas` reading "Alertas" with a count badge, whose accessible name is "Alertas, {n} não lidos" or "Alertas, nenhum não lido". It opens `#alerts-panel`, a dialog with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at its heading "Alertas de risco", closing on Escape and on a backdrop click and returning focus to `#btn-alertas`, as `#referral-triage-modal` does. On a phone the panel takes the full width.

Each alert is a list item with the level badge ("Crítico" or "Moderado", built from `riskBadge`), "{estudante.nome} · {turma.nome}", the `motivo_regra` sentence verbatim, the date as `dd/mm/aaaa hh:mm`, and two buttons. Unread items have a bold name and a visually hidden "Não lido". "Ver histórico" marks the alert read and opens the student's history: for a `docente`, the student modal of `0016`; for the coordinator, the "Busca & Registros" tab with the student's timeline open. "Marcar como lido" sends `POST /api/alertas/lidos` with that id. The panel header has "Marcar todos como lidos", which sends `{"todos": true}` and is disabled when nothing is unread. Every mark updates the badge from the `nao_lidos` the backend returns.

Panel states: "Carregando alertas..." while loading; "Nenhum alerta nos últimos 30 dias." when empty; "Não foi possível carregar os alertas. Tente novamente." with a "Tentar novamente" button on failure.

### Polling
The alert center loads `GET /api/alertas` once when the panel of a recipient profile opens, then every 60 seconds requests `GET /api/alertas?desde_id={ultimo_id}`, prepending new items and updating the badge from `nao_lidos`. The poller lives in one object, `window.alertasPoller`, with `start()`, `stop()`, and `tick()`, so tests drive ticks directly instead of waiting on timers.

The poller stops while `document.hidden` is true and, on `visibilitychange` back to visible, polls at once and restarts the interval; a teacher who left the tab in the background all morning does not send 240 useless requests, and still sees what arrived as soon as they return. A failed poll is skipped silently and retried at the next tick, since a toast every minute during a Wi-Fi drop would be worse than a late alert; a 401 goes through `window.apiRequest`, which sends the user to `/login`, and the poller stops. `logout()` from `0009` also calls `stop()`.

Each new alert is announced in a visually hidden `aria-live="polite"` region outside the dialog: "Novo alerta: {nome} ({turma}) em risco {nível}." For `"critico"`, the toast also shows "Alerta crítico: {nome} ({turma})." Several new alerts in one poll are announced as one sentence, "{n} novos alertas de risco.", so a screen reader is not flooded.

### Risk on the teacher panel
Each teacher class card gains the line [0014](0014-teacher-class-assignment-frontend.md) removed, now built from `risco_contagem`: "{c} em risco crítico · {m} em risco moderado", omitting a zero part, or "Nenhum estudante em risco moderado ou crítico" when both are zero. The line's colour follows the highest level present, and its text carries the meaning. The class grid gains `renderRiskFilter` above the cards, re-requesting `GET /api/turmas?risco=...`; an empty result reads "Nenhuma turma com estudantes neste nível de risco."

In a class's student grid, each card shows `riskBadge(estudante.risco)` under the student's name, and the grid gains its own filter, re-requesting `GET /api/estudantes?turma_id={id}&risco=...`; an empty result reads "Nenhum estudante neste nível de risco nesta turma."

After an observation is saved, when the 201 response has `risco.alerta_gerado: true`, the toast becomes "Registro salvo. {primeiro nome} agora está em risco {nível}." instead of the plain confirmation, and the student's card badge updates without reloading the grid.

### Risk on the coordinator's search
In "Busca & Registros", each class result replaces the prototype's "Alertas de Sintomas" / "Normal / Estável" badge with the same counts line as the teacher cards, and each student result gains `riskBadge`. Both searches gain a filter, sending `risco` with the `q` they already send. The prototype code that computed those badges from `activeEmotions` is deleted, if `0016` has not already removed it.

### Risk in the student history
The header of the history, in the student modal and in the search timeline, shows `riskBadge(risco.nivel)` and, under it, "Motivo: {risco.motivo}". The sentence is the explanation the rule promises, so it is shown in full, never truncated.

### Copies
Every change is mirrored under `frontend/src/templates/dashboard.html` and `frontend/src/static/styles.css`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
All modules drive the real `dashboard.html` through `frontend/test/dashboard_harness.js` with `fetch` doubled per route; the harness gains a `DOCENTE` user constant next to `GESTOR` and `PSICOLOGA`.

- `frontend/test/test_alert_center.js`: the button exists for `docente` and `gestor_escolar` and not for `equipe_multidisciplinar`; badge count and accessible name; list rendering with `motivo_regra` verbatim; marking one and all, with the badge taken from `nao_lidos`; "Ver histórico" opens the right view per profile and marks read; dialog semantics, Escape, and focus return; loading, empty, and error states.
- `frontend/test/test_alert_polling.js`: `tick()` sends `desde_id` from the previous `ultimo_id`, prepends new items, announces one or several alerts in the live region, and toasts only critical ones; `stop()` on `visibilitychange` to hidden and an immediate poll on return; a failed poll shows nothing; `logout()` stops the poller; the interval is registered at 60,000 ms (the harness stubs `window.setInterval` to record it).
- `frontend/test/test_risk_badges_filters.js`: badges for the three levels; the class-card counts line in each combination; the filter sends the right `risco` value on the teacher class grid, the student grid, and both coordinator searches; the empty filtered states; the history header shows the level and reason; the post-save toast when an alert was generated.

## Out of Scope
- The classification rule, alert generation, and routes, specified in [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md).
- The risk filter on the school climate panel, which [todo/0024-emotional-climate-dashboards-frontend.md](0024-emotional-climate-dashboards-frontend.md) wires with `renderRiskFilter` on its own screen.
- Browser push notifications and sounds; the dashboard alerts only while open.
- Alerts for the multidisciplinary team, which the backend does not send.
