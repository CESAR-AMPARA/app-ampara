# Access Management Frontend

*Phase: MVP #1 (backbone). Story-map card: "As an admin, I want to manage access permissions so that only authorized people see sensitive data" (value 500, 5 points).*

*This specification defines the coordinator's team management screen. Its backend counterpart is [todo/0011-access-management-backend.md](0011-access-management-backend.md), which pins every route and payload used here; this spec can be built and tested against that contract before the backend ships. It builds on the credentialing tab as rewired by [todo/0009-unified-dashboard-hardening-frontend.md](0009-unified-dashboard-hardening-frontend.md) and should land after it.*

## Problem
After `0009`, the coordinator's "Credenciamento & Equipe" tab shows only pending registrations with an approve button. The coordinator cannot see who already has access to student data, cannot turn down a registration from a stranger, and cannot cut off a teacher who left the school; the only action available is to let more people in.

The same tab also offers "Adicionar Professor", a modal that adds a teacher marked as approved to the on-screen list without calling any API. It looks like it grants access, does not, and if it were wired to a backend as designed it would create accounts that skip the registration terms (`aceite_lgpd`, `aceite_sigilo`) every professional must accept.

## Business Vision and Purposes
The coordinator is the person accountable for who reads the school's mental-health records. The screen must show the full team at a glance and make every change of access a deliberate, confirmed action, so that granting and withdrawing access are equally easy and equally visible.

## Solution
The tab becomes "Equipe da Escola": counters for active, pending, and suspended accounts on top, filters by status and profile, and one table of the whole team. Each row offers only the actions valid for its status: approve or refuse a pending registration, suspend an active account, reactivate a suspended one. Refusing and suspending ask for confirmation in a dialog that says what will happen. The coordinator's own row and the last active manager show no suspend action. The "Adicionar Professor" button and modal are removed; the tab instead tells the coordinator to share the registration link.

## User Stories
1. As a Gestor Escolar, I want counters and a table of my whole team, so that I see who has access right now.
2. As a Gestor Escolar, I want to filter the team by status and profile, so that I find pending requests or the psychologists quickly.
3. As a Gestor Escolar, I want to refuse a registration after confirming, so that I do not remove a real colleague by a misclick.
4. As a Gestor Escolar, I want to suspend and reactivate access from the same row, so that I handle departures and returns without leaving the panel.
5. As a Gestor Escolar, I want to be warned when a professional I am suspending still has open cases, so that I reassign those students in the referral queue.
6. As a Gestor Escolar, I want the screen to explain how a new teacher gets access, so that I do not look for a shortcut that does not exist.

## Implementation Decisions

### Data source and rendering
The tab loads `GET /api/gestao/equipe` through `window.apiRequest` on open and after every action, and renders the counters from `resumo` and the rows from `usuarios`. Filters re-request with `status` and `perfil` query parameters instead of filtering on the client, so the table always matches the backend. The pending-only list that `0009` built on `GET /api/gestao/pendentes` is replaced by this table filtered to `Pendente`, which is the filter selected when the tab opens if `resumo.pendentes > 0`, and `Ativo` otherwise.

The counters are three `.stat-card` elements labelled "Ativos", "Aguardando Aprovação", and "Suspensos". The table columns are "Nome", "Perfil", "Cargo", "Status", "Desde", and "Ações". "Desde" shows `status_alterado_em` when present and `created_at` otherwise, formatted `dd/mm/aaaa`. Profile labels reuse the map defined in `0009`.

### Actions per status
Each action is a button whose label names the action and the person, for screen readers: `aria-label="Suspender acesso de Maria Silva"`.

- `Pendente`: "Aprovar" and "Recusar".
- `Ativo`: "Suspender", hidden on the coordinator's own row and on the only active `gestor_escolar`.
- `Suspenso`: "Reativar".

Approve and reactivate act immediately and show the backend's `mensagem` in a toast. Refuse and suspend open a confirmation dialog first, because they are the two that remove access or data:

- Refuse: title "Recusar solicitação de cadastro?", body "Os dados enviados por {nome} serão excluídos. A pessoa poderá se cadastrar novamente.", buttons "Cancelar" and "Recusar cadastro".
- Suspend: title "Suspender acesso?", body "{nome} perderá o acesso imediatamente, inclusive em sessões já abertas.", buttons "Cancelar" and "Suspender acesso". When `casos_abertos > 0`, the body adds "Esta pessoa tem {n} caso(s) em aberto na Fila de Encaminhamentos. Redesigne-os após a suspensão."

Hiding the suspend button for the last manager duplicates a rule the backend already enforces with a 409. I kept both because the button would otherwise invite an action that always fails; the backend remains the authority, and any 409 `mensagem` is shown in a toast as is.

The dialog follows the pattern of `#referral-triage-modal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus on "Cancelar" when it opens, Escape and backdrop click cancel, focus returns to the button that opened it. Action buttons are disabled while their request is in flight, so a double click cannot send two transitions.

### Removing "Adicionar Professor"
The `#btn-open-add-teacher` button, the `#add-teacher-modal` markup, and the script that pushes a fake approved teacher into `cachedUsuarios` are deleted. In their place the tab shows a note: "Novos profissionais solicitam acesso pelo cadastro em {origem}/cadastro e aparecem aqui para aprovação.", with a "Copiar link de cadastro" button that writes the absolute registration URL to the clipboard and confirms with the toast "Link de cadastro copiado.". Wiring the modal to a backend "create user" route was the alternative; I rejected it because an account created by the coordinator never accepts the LGPD and confidentiality terms, which `0002` requires of every professional. `0009`'s modal accessibility fixes for `#add-teacher-modal` therefore no longer apply.

### Copies and states
Loading shows the existing "Carregando lista de profissionais..." row; an empty filter result shows "Nenhum profissional encontrado com estes filtros."; a failed request shows "Não foi possível carregar a equipe. Tente novamente." with a "Tentar novamente" button. The changes are mirrored in `frontend/src/templates/dashboard.html`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Behaviour is exercised against the real `dashboard.html` through `frontend/test/dashboard_harness.js`, logged in as `gestor_escolar`, with `fetch` doubled per route.

- `frontend/test/test_team_management.js`: counters and rows render from the `0011` payload; the initial filter depends on `resumo.pendentes`; filters send the query parameters; each status shows exactly its actions; the own row and the last manager have no suspend button; refuse and suspend open the dialog and send nothing on cancel; confirming sends the `POST` and reloads the list; the open-cases warning appears only when `casos_abertos > 0`; a 409 shows the backend message; buttons are disabled during the request.
- `frontend/test/test_team_management_dialog.js`: dialog roles, initial focus, Escape, backdrop click, focus return.
- `frontend/test/test_dashboard_credenciamento.js` (from `0009`): reduced to the pieces that remain, since this spec replaces its pending-only list.
- The "Adicionar Professor" markup is asserted absent in `test_team_management.js`.

## Out of Scope
- Backend routes, the guard, and the lifecycle rules, specified in [todo/0011-access-management-backend.md](0011-access-management-backend.md).
- Assigning teachers to classes, specified in [todo/0014-teacher-class-assignment-frontend.md](0014-teacher-class-assignment-frontend.md).
- Showing the audit trail of access changes, specified in [todo/0028-access-audit-log-frontend.md](0028-access-audit-log-frontend.md).
- Inviting professionals by e-mail from the panel.
