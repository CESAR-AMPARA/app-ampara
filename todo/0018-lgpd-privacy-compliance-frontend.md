# LGPD Privacy Compliance Frontend

*Phase: MVP #1 (backbone). Story-map card: "As a user, I want my data and the students' data to be handled according to the LGPD to guarantee full privacy" (value 800, 3 points).*

*This specification defines the privacy notice page, the terms acceptance flow, and the coordinator's student export and anonymization actions. Its backend counterpart is [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md), which pins every route and payload used here.*

## Problem
The pages promise more than the product does. `login.html` says "Todos os acessos são auditados e os dados sensíveis criptografados" and `index.html` says "Dados sensíveis criptografados", while no access is audited today and nothing is encrypted by the application. The registration wizard asks professionals to accept "os termos da LGPD" without ever showing those terms, and no page says who controls the data or whom to contact. A coordinator who receives a family's request to see or erase their child's data has no screen to do it.

## Business Vision and Purposes
Transparency is the cheapest LGPD obligation to meet and the most visible one to fail. Professionals must be able to read what they accept, families must find who answers for the data, and the coordinator must fulfil access and erasure requests in a few clicks, with enough friction on erasure that it never happens by accident. Claims on screen must match what the system does, because a false compliance claim is itself a liability.

## Solution
A public "Privacidade" page explains, in plain Portuguese, what the platform processes, why, who the controller and the encarregado are for the chosen school, and how to exercise rights. The registration wizard links to it and to the full terms, and sends the terms version accepted. When the terms change, the professional sees a blocking dialog after login with the new terms and cannot use the dashboard until they accept. In "Busca & Registros", the coordinator's student view gains "Exportar dados" and "Anonimizar estudante". Compliance claims on the landing and login pages are rewritten to match what is true.

## User Stories
1. As anyone, I want a privacy page linked from every page footer, so that I find who is responsible for the data.
2. As a professional registering, I want to read the terms I am accepting, so that my acceptance is informed.
3. As a professional, I want to be shown the updated terms after login and accept them once, so that I keep working under the current rules.
4. As a Gestor Escolar, I want to download a student's data with a reminder to review it, so that I answer an access request correctly.
5. As a Gestor Escolar, I want anonymization to require typing the student's registration number and to explain that it is irreversible, so that I never erase a student by mistake.

## Implementation Decisions

### Privacy page
A new page `privacidade.html`, served at `/privacidade` by a page route the backend adds alongside the others, reads `GET /api/privacidade` with the `escola_id` from its query string, or from `usuarioLogado.escola_id` when logged in. It renders the static notice text (sections "Quem somos", "Quais dados tratamos", "Para que usamos", "Com quem compartilhamos", "Por quanto tempo guardamos", "Seus direitos", "Como entrar em contato") followed by the controller and encarregado block from the response. Without a school it shows "Selecione sua escola no cadastro para ver o encarregado responsável." The full terms of use and confidentiality live on the same page under "Termos de Uso e Compromisso de Sigilo", with the heading "Versão {termos_versao}".

The notice text is drafted by the team with the encarregado of the pilot school and committed as the page copy; this spec does not invent legal text. Until it is approved, the page ships with the section headings and a visible notice "Texto em revisão pelo encarregado de dados." so nobody mistakes a draft for the final notice.

Every page's footer gains a "Privacidade" link. The pages under `frontend/public/` and `frontend/src/templates/` stay identical, as `frontend/test/test_flask_copies.js` enforces.

### Registration and the terms version
Step 4 of `cadastro.html` adds a "Leia os termos" link that opens `/privacidade#termos` in a new tab, and the two checkbox labels link their key words to the same anchor. The wizard sends `termos_versao` from `GET /api/privacidade`, fetched when step 4 opens. A 400 for a stale version shows the backend message and reloads the version.

### Terms acceptance after login
When the login response has `termos_pendentes: true`, `main.js` stores the flag in `sessionStorage` and the dashboard opens `#terms-update-modal` before loading any panel data. The dialog shows "Os termos de uso foram atualizados" with a scrollable summary of the changes, a link to the full terms, the two checkboxes from registration, and "Aceitar e continuar". It cannot be dismissed with Escape or the backdrop; its only other control is "Sair", which calls the `logout()` of [0009](0009-unified-dashboard-hardening-frontend.md). On success it clears the flag and loads the panel. Any 403 with `status: "termos_pendentes"` from `apiRequest` reopens the dialog instead of showing an error, so a stale tab still lands in the right place.

A non-dismissable dialog breaks the modal pattern of the rest of the dashboard on purpose: the backend refuses every data route until acceptance, so a dismissable dialog would only lead to a panel full of errors. Focus is trapped inside it and starts on the summary heading.

### Export and anonymization
In the student view of "Busca & Registros", visible only to `gestor_escolar`, a "Dados do estudante (LGPD)" group holds two buttons.

"Exportar dados" fetches `GET /api/gestao/estudantes/<id>/exportar` through `apiRequest` with the blob handling added to it for this purpose, and saves the file with the name from `Content-Disposition`. A toast confirms "Arquivo gerado. Revise o conteúdo antes de entregá-lo ao responsável: ele inclui anotações internas da coordenação.".

"Anonimizar estudante" opens `#anonymize-student-modal` titled "Anonimizar estudante?", with the body "Esta ação é irreversível. O nome, a matrícula e todos os textos descritivos sobre {nome} serão apagados. Os registros estruturados continuam nas estatísticas da escola de forma anônima.", a field "Digite a matrícula {matricula} para confirmar", and the buttons "Cancelar" and "Anonimizar definitivamente", the latter enabled only when the typed value matches. A 409 shows the backend message inside the dialog; on success the toast shows the backend message, the dialog closes, and the student view closes and the search results refresh. The dialog follows the `#referral-triage-modal` pattern, with initial focus on "Cancelar".

### Truthful compliance claims
`login.html` replaces both claims with "Conformidade com a LGPD. Acesso restrito por perfil e por escola." and `index.html` replaces "Dados sensíveis criptografados" with "Dados isolados por escola". [0028](0028-access-audit-log-frontend.md) restores an audit claim once accesses are actually logged.

## Testing Decisions
- `frontend/test/test_privacy_page.js`: renders controller and encarregado from the doubled response, the generic state without a school, the draft notice, and the footer link on every page under `frontend/public/`.
- `frontend/test/test_terms_update_modal.js`: opens before panel requests when `termos_pendentes` is set; Escape and backdrop do not close it; acceptance sends the version and both flags, then loads the panel; a 403 `termos_pendentes` reopens it; "Sair" logs out.
- `frontend/test/test_student_lgpd_actions.js`: buttons visible only to `gestor_escolar`; export saves the blob with the header's filename and shows the review toast; the anonymize button stays disabled until the registration number matches; 409 inside the dialog; success refreshes the search.
- `frontend/test/test_cadastro_wizard.js` (existing): extended for the terms link and `termos_versao` in the payload.
- `frontend/test/test_shared_layout.js` (from `0009`): asserts the old encryption and audit claims are gone.

## Out of Scope
- Backend routes, the guard rule, and the anonymization sweep, specified in [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md).
- The legal text of the privacy notice and terms, which the team and the encarregado write.
- A cookie banner: the platform sets no cookies, only `localStorage` and `sessionStorage` entries needed for the session and accessibility preferences.
- Self-service requests from families; requests reach the school, and the coordinator acts.
