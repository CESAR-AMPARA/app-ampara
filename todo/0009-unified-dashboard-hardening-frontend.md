# Unified Dashboard Hardening Frontend

*Phase: MVP #1 (backbone). Story-map cards: "As a user, I want to log in securely from any device to access AMPARA quickly and without additional registration" (value 100, 1 point); "As a Teacher, I want to refer a student to the coordination with one click from a recorded observation" (value 500, 3 points); "As a Pedagogical Coordinator, I want to manage the queue of referrals to psychologists or social workers" (value 500, 5 points).*

*This specification is frontend-only and has no backend counterpart of its own: it consumes contracts already pinned in [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md), [todo/0004-student-class-management-backend.md](0004-student-class-management-backend.md), and [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md). The items under "Shared layout and accessibility fixes" ship independently; the others ship as each backend lands.*

## Problem
Every profile now lands on `/dashboard` after login, and that page was built as a clickable prototype. Real coordinators, teachers, and psychologists therefore meet prototype behaviour: a coordinator sees a "Seletor de Perfil Simulado (RBAC)" box that switches to the teacher or psychologist panel, and anyone who opens `/dashboard` without logging in gets the coordinator panel instead of the login page. The data on screen is not theirs either. The teacher panel, the "Busca & Registros" tab, and the occurrence modal list hardcoded students and classes, and the teacher's class is guessed from a hardcoded list of e-mails.

The coordinator's credentialing tab still talks to the pre-multi-tenant backend. It loads `/api/usuarios` without the session token, approves accounts with a `GET /api/aprovar/<id>` request, and labels profiles with the retired values `"equipe"` and `"gestao"`, so a multidisciplinary professional shows up with the raw value `equipe_multidisciplinar`. Once the endpoints of `0002` require a token, the tab stops working.

Teachers also cannot start the flow the referral queue exists for. `POST /api/encaminhamentos` is specified, but no screen lets a teacher refer a student, so the coordinator's queue only fills through other channels.

Verifying the last three frontend changes surfaced smaller defects that every user hits:

- On a 375 px phone the toast shrinks to half the screen width and wraps short messages over five lines.
- `conta_pendente.html` has neither the accessibility bar nor `main.js`, so the larger font and high contrast preferences do not apply there.
- Pages show two different taglines.
- "Sair" calls `localStorage.clear()`, which also erases the user's accessibility preferences.
- The dashboard's older modals (`#student-modal`, `#add-teacher-modal`, `#occurrence-modal`) do not close with Escape, do not declare `role="dialog"`, and do not return focus to the control that opened them.

## Business Vision and Purposes
The unified dashboard has to be safe to hand to real school staff: each person sees only their own panel, works on their school's real roster, and moves students into care through the app instead of out-of-band messages. Showing a profile switcher or mock students to a professional who handles mental health data undermines the trust the product depends on and invites mistakes, such as a coordinator acting on a student who does not exist. Fixing the shared layout defects keeps the accessibility commitments on every page, not only on the ones built most recently.

## Solution
The dashboard requires a session: without one it redirects to the login page, and with one it opens the panel of the logged profile with no way to switch. The coordinator's credentialing tab lists the school's pending registrations and approves them through the multi-tenant endpoints. The teacher panel, the search tab, and the occurrence modal read classes and students from the roster APIs. Teachers can refer a student to the multidisciplinary team from the student's modal, which feeds the coordinator's "Fila de Encaminhamentos". Every page shares the same header tagline, accessibility bar, readable toast, and logout behaviour, and every dashboard modal behaves like the referral triage modal.

## User Stories
1. As a Coordenador Pedagógico, I want the dashboard to open only my coordination panel, so that I cannot act by mistake as a teacher or psychologist.
2. As any professional, I want an expired or missing session to send me to the login page, so that I never work on a screen that is not backed by my account.
3. As a Coordenador Pedagógico, I want the credentialing tab to list my school's pending registrations and approve them, so that new staff get access through the audited flow.
4. As a Docente, I want my classes and students to come from the school's roster, so that I record observations about real students.
5. As a Docente, I want to refer a student to the multidisciplinary team from the student's record, so that the coordination can triage the case.
6. As a user on a phone, I want notifications to be readable at a glance, so that I do not miss a confirmation or an error.
7. As a user who relies on larger fonts or high contrast, I want my preferences to apply on every page and to survive logging out, so that I do not configure them again.
8. As a keyboard or screen reader user, I want every dashboard modal to announce itself, close with Escape, and return me to where I was.

## Implementation Decisions

### Session guard and panel selection
The dashboard picks its panel from `usuarioLogado.perfil`, which the login stores in `sessionStorage`, and it redirects to `/login` when `localStorage.token` or `usuarioLogado` is missing or the profile is unknown. Panel selection on the client is presentation only: authorization is enforced by every endpoint of `0002`, `0004`, and `0006`, which check the profile carried by the token. I considered decoding the JWT payload in the browser instead of reading `usuarioLogado`, and rejected it, because an unverified decode protects nothing and adds a second source of truth for the profile.

The existing `showRolePanel(role)` stays the single place that shows a panel, and the "no session, default to coordinator" branch of the startup code is removed. Every request the dashboard makes goes through `window.apiRequest` from `main.js`, so it carries the token and treats a `401` as an expired session.

### Removing the developer RBAC switcher
The "Seletor de Perfil Simulado (RBAC)" box and the `btn-rbac-gestor`, `btn-rbac-docente`, and `btn-rbac-saude` buttons are deleted from the markup, not hidden. Keeping them behind a hostname or query-string check was the alternative; I rejected it because the panels would still be one attribute change away for anyone with the page open. The cost is that manual testing needs one seeded account per profile, which the Admin AMPARA provisioning in `0002` already creates. Automated tests are unaffected, since `frontend/test/dashboard_harness.js` picks the panel through `sessionStorage`.

### Credentialing tab on the multi-tenant endpoints
The tab loads `GET /api/gestao/pendentes` and approves with `POST /api/gestao/usuarios/<id>/aprovar`, both specified in `0002`, and re-renders the list after each approval. It is retitled from "Lista de Profissionais Cadastrados" to "Solicitações Pendentes", because the contract returns only pending accounts. For the same reason the "total" and "aprovados" counters cannot be filled and are removed; only the pending count stays. Profile labels map `gestor_escolar`, `docente`, and `equipe_multidisciplinar` to "Gestão / Coordenação", "Docente", and "Equipe Multidisciplinar".

### Roster data from the class and student APIs
The hardcoded `turmas` object, the student options of `#occurrence-target-student`, the class options of `#occurrence-target-class`, and the data behind the "Busca & Registros" tab are replaced by `GET /api/turmas` and `GET /api/estudantes` with its `turma_id` and `q` parameters, as specified in `0004`. `obterClasseDoProfessorLogado()` and its hardcoded e-mail list are deleted. Until the open question in _Further Notes_ is settled, a teacher sees every class of the school, which `0004` already allows for reading.

### Referral submission for teachers
The student modal of the teacher panel gains a button, `"Encaminhar para Equipe Multidisciplinar"`, that reveals a required textarea for the reason and a confirmation button. Submitting sends `POST /api/encaminhamentos` with `{"estudante_id": <id>, "motivo": "<texto>"}` as specified in `0006`, shows the backend's `mensagem` in a toast, and closes the form. The reason is the verbatim text the coordinator and the psychologist will read, so the field's hint reads `"Descreva o comportamento observado, sem diagnósticos."`.

### Shared layout and accessibility fixes
- The toast in `main.js` gets `width: max-content` and `max-width: calc(100vw - 32px)`, so it keeps its natural width on phones instead of the half-screen box that `left: 50%` gives it.
- `conta_pendente.html` gains the accessibility bar and `main.js`, like every other page.
- Every page uses the tagline `"Apoio, Monitoramento Psicológico e Acolhimento Responsável ao Aluno"`, the expansion that spells A.M.P.A.R.A. Today `cadastro.html`, `conta_pendente.html`, `recuperar_senha.html`, and `redefinir_senha.html` show "Acolhimento, Monitoramento e Prevenção no Ambiente Escolar" instead.
- Logout moves into a `logout()` function in `main.js` that removes only `token`, `usuario`, and `usuarioLogado` and then goes to `/login`. The accessibility preferences under `ampara.a11y` survive it.
- `#student-modal`, `#add-teacher-modal`, and `#occurrence-modal` get `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, closing on Escape and on a backdrop click, and focus return to the control that opened them, matching `#referral-triage-modal`.

Every change keeps the copies under `frontend/src/` identical to `frontend/public/` apart from asset paths, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Dashboard behaviour is exercised against the real `dashboard.html` through `frontend/test/dashboard_harness.js`, with `fetch` doubled per route as in the referral tests.

- `frontend/test/test_dashboard_session_guard.js`: no token or no `usuarioLogado` redirects to `/login`; each profile opens only its panel; the switcher markup no longer exists; a `401` from any dashboard request redirects to `/login`.
- `frontend/test/test_dashboard_credenciamento.js`: pending accounts load from `/api/gestao/pendentes` with the bearer token; approving sends the `POST` and re-renders the list; profile labels.
- `frontend/test/test_dashboard_roster.js`: classes and students in the teacher panel, the search tab, and the occurrence modal come from the `0004` APIs, including empty and failed responses.
- `frontend/test/test_referral_submission.js`: an empty reason is blocked; a valid one sends the `0006` payload and shows the backend message.
- `frontend/test/test_shared_layout.js`: every page under `frontend/public/` has the accessibility bar, loads `main.js`, and shows the same tagline; `logout()` keeps `ampara.a11y`; Escape closes each dashboard modal and returns focus.
- `frontend/test/test_psychologist_actions.js`: its switcher test is rewritten to drive the panels through `sessionStorage`, since the switcher is gone.

The toast width is checked by hand at 375 px; asserting computed layout in jsdom would test jsdom, not the browser.

## Out of Scope
- Backend changes: every endpoint used here is already specified in `0002`, `0004`, or `0006`, apart from the open questions below.
- Persistence of behavioral logs, emotions, coordination occurrences, and training materials, which still run on in-page mocks and `localStorage` and have no API contract. They need their own backend and frontend specs.
- Splitting the dashboard's inline script into modules. It is a maintainability concern, not a defect users hit.
- Server-side logout or token revocation.

## Further Notes
`0004` says teachers read students "within their authorized classes" but defines no teacher-to-class assignment, so the frontend cannot show "Minhas Turmas" correctly. Until a backend spec defines that assignment and an endpoint for it, the teacher sees every class of the school; this is the one place where the frontend knowingly shows more than the product intends.

The credentialing counters are dropped because `GET /api/gestao/pendentes` returns only pending accounts. If the coordination needs the approved and total figures back, that is a contract change to `0002`, not a frontend fix.
