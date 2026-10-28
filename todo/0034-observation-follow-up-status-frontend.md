# Observation Follow-Up Status Frontend

*Phase: Increments #3 to N (other). Story-map cards: "As a user, I want to mark an observation as 'in follow-up' to signal that the intervention has started" (value 100, 1 point).*

*This specification defines the frontend of the follow-up flag on behavioral observations. Its backend counterpart is [todo/0033-observation-follow-up-status-backend.md](0033-observation-follow-up-status-backend.md), which pins the contract consumed here; this side can be built and tested against that contract before the backend ships. It extends the student history renderer of [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md), which draws `GET /api/estudantes/<id>/historico` of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), and ships after it.*

## Problem
A professional reading a student's timeline cannot tell which observations someone is already acting on. Nothing on the observation says "I talked with this student" or "the coordination called the family", so colleagues either duplicate the approach or each assume someone else handled it.

## Business Vision and Purposes
Showing, on each observation, whether an adult has taken it up and who, lets teachers and coordinators find the unattended episodes at a glance and claim one with a single action.

## Solution
Each observation in the timeline shows an "Em acompanhamento" badge with the name of the professional and the date when the mark exists. Observations without the mark show a "Marcar em acompanhamento" button to anyone who sees them; the person who set the mark, and any coordinator, see "Encerrar acompanhamento" instead. The badge is visibly different from the referral status `"Em Atendimento"`, which keeps its own badge in the timeline.

## User Stories
1. As a Docente, I want to mark an observation as in follow-up with one click from the student's timeline, so that colleagues see I started an intervention.
2. As a Coordenador Pedagógico, I want to see who is following up each observation and since when, so that I find the ones nobody took.
3. As the professional who set the mark, I want to clear it from the same place, so that I can undo a mistake.
4. As a screen reader user, I want the state change announced, so that I know the action succeeded without looking for the badge.

## Implementation Decisions

### Where the control appears
The badge and the button appear on every observation item of the history wherever it is rendered: the student modal's "Histórico de Registros" and the coordinator's "Busca & Registros" timeline. Both are drawn by `renderStudentHistory(container, payload)` of `0016`, so the control is added once, in that renderer. Coordination occurrences and referrals in the timeline get no control; the flag exists only on observations.

### Copy and states
- Badge: `"🤝 Em acompanhamento · Prof. Carlos Souza · desde 26/10/2026"`, built from `acompanhamento.por.nome` and `acompanhamento.desde` formatted in the browser's locale as `dd/mm/aaaa`.
- Set button: `"Marcar em acompanhamento"`, with the hint `title="Indica que você iniciou uma intervenção com este estudante."`.
- Clear button: `"Encerrar acompanhamento"`, shown only when `acompanhamento.por.id` equals `usuarioLogado.id` or `usuarioLogado.perfil` is `gestor_escolar`. The backend enforces the same rule; hiding the button only avoids offering an action that would answer 403.
- While the request is in flight the button is disabled and reads `"Salvando..."`.
- On success the item re-renders from the response's `acompanhamento`, without reloading the timeline, and the backend `mensagem` shows in the toast.
- On a 403 or 404 the backend `mensagem` shows in the toast and the timeline reloads, since the item the user saw is stale. Any other failure shows `"Não foi possível atualizar o acompanhamento. Tente novamente."` and leaves the item unchanged.

Clearing does not ask for confirmation: the action is reversible with one click and leaves an audit entry, and a dialog would double the cost of the common correction.

### Distinguishing it from `"Em Atendimento"`
The follow-up badge uses the sage palette (`--sage-badge`, `--sage-badge-tx`) and the handshake glyph, while referral status badges keep their current colors and the label `"Em Atendimento"`. The two labels differ in wording on purpose: "acompanhamento" is any adult acting on one observation, "atendimento" is the multidisciplinary team's formal care of a referral. A sighted user must never read one as the other, and a screen reader user hears different words.

### Accessibility
The button is a real `<button>` with `aria-pressed` reflecting `em_acompanhamento`, so assistive technology announces it as a toggle. The timeline container gets one `aria-live="polite"` region that announces the backend `mensagem` after each change. Focus stays on the button after the re-render; the render function restores it by the observation id.

## Testing Decisions
Exercised against the real `dashboard.html` through `frontend/test/dashboard_harness.js`, with `fetch` doubled per route.

- `frontend/test/test_observation_follow_up.js`: the badge renders from a timeline item with `acompanhamento` and is absent when it is `null`; "Marcar em acompanhamento" sends `PUT /api/observacoes/<id>/acompanhamento` with `{"em_acompanhamento": true}` and the bearer token; the clear button shows for the author and for a coordinator but not for another teacher; a 403 reloads the timeline and shows the message; the button is disabled while the request is pending; `aria-pressed` follows the state; occurrences and referrals render no control.

Copies under `frontend/src/` stay identical to `frontend/public/`, as `frontend/test/test_flask_copies.js` enforces.

## Out of Scope
- The endpoint, the columns, and the permission rules, specified in [todo/0033-observation-follow-up-status-backend.md](0033-observation-follow-up-status-backend.md).
- Filtering the timeline or the student lists by follow-up state.
- Any change to referral status badges.
