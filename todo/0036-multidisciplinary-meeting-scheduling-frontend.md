# Multidisciplinary Meeting Scheduling Frontend

*Phase: Increments #3 to N (other). Story-map cards: "As a Pedagogical Coordinator, I want to schedule meetings with the multidisciplinary team to discuss critical cases" (value 100, 3 points).*

*This specification defines the frontend of case meetings: the coordinator's agenda and scheduling form, the meeting details and minutes, and the participants' read-only agenda. Its backend counterpart is [todo/0035-multidisciplinary-meeting-scheduling-backend.md](0035-multidisciplinary-meeting-scheduling-backend.md), which pins every route, payload, and message consumed here; this side can be built and tested against that contract before the backend ships. It reuses the roster search of [todo/0004-student-class-management-backend.md](0004-student-class-management-backend.md) and the referral queue and user listing of [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md).*

## Problem
The coordinator's panel has a referral queue but no way to bring the team together around the cases in it. Meetings about critical students are arranged outside the app, so the dashboard does not show who is meeting about whom, and the decisions taken never come back to it.

## Business Vision and Purposes
Putting the agenda next to the referral queue lets the coordinator go from "this case is critical" to "the team meets Thursday at 14:00" in one place, and gives teachers and psychologists a single list of the meetings they are expected at, with the minutes afterwards.

## Solution
The coordination panel gains a "Reuniões" tab with the school's agenda and a form to schedule a meeting about one or more students. The referral triage modal gains a shortcut that opens the same form already filled with the student and the referral. Opening a meeting shows its students, participants, agenda, and, once it has started, the minutes editor. Teachers and the multidisciplinary team see "Minhas Reuniões" in their panels, read-only.

## User Stories
1. As a Coordenador Pedagógico, I want to schedule a meeting from the referral I am triaging, so that I do not re-select the student.
2. As a Coordenador Pedagógico, I want to see upcoming and past meetings in one agenda, so that I know what the team has on its plate.
3. As a Coordenador Pedagógico, I want to reschedule, cancel, and write the minutes of a meeting from its details, so that the record follows what actually happened.
4. As a Docente or Equipe Multidisciplinar professional, I want to see the meetings I am invited to and their minutes, so that I can prepare and follow up.
5. As a keyboard or screen reader user, I want the form and the details to behave as accessible dialogs, so that I can schedule a meeting without a mouse.

## Implementation Decisions

### Coordinator agenda tab
A tab button `btn-gestor-tab-reunioes` labelled `"📅 Reuniões"` and a panel `gestor-tab-reunioes` are added after "Fila de Encaminhamentos", and both join the `gestorTabs` and `gestorPanels` arrays that drive tab switching. The panel is titled `"Agenda de Reuniões"`, has an `"Agendar Reunião"` button, and a two-option toggle, `"Próximas"` (today to 60 days ahead) and `"Anteriores"` (the 90 days before today), each a single `GET /api/reunioes?de=&ate=` call within the 180-day limit of the contract.

Each meeting is a card: the date and time range formatted with `Intl.DateTimeFormat('pt-BR')` in the browser's time zone (`"qui., 29/10/2026 · 14:00 – 15:00"`), the title, the location, a status badge (`"Agendada"`, `"Realizada"`, `"Cancelada"`), and `"2 estudantes · 4 participantes"`. Activating a card opens the details dialog.

- Loading: `"Carregando reuniões..."`.
- Empty, upcoming: `"Nenhuma reunião agendada para os próximos 60 dias."`
- Empty, past: `"Nenhuma reunião nos últimos 90 dias."`
- Error: `"Não foi possível carregar a agenda. Tente novamente."` with a `"Tentar novamente"` button.

### Scheduling form
`#meeting-modal` is a `role="dialog"` with `aria-modal="true"` and `aria-labelledby` on its heading, `"Agendar Reunião"` (or `"Editar Reunião"`). Its fields:

- `"Título"` (required, 120 characters).
- `"Data"` (`<input type="date">`) and `"Horário"` (`<input type="time">`), both required, combined into an ISO 8601 string with the browser's UTC offset before sending.
- `"Duração"`, a select of 30, 45, 60, 90, and 120 minutes, defaulting to 60.
- `"Local"` (optional, 120 characters), with the hint `"Informe apenas a sala ou o link da chamada. Este campo é enviado no convite por e-mail."`
- `"Estudantes"` (1 to 10): a search box backed by `GET /api/estudantes?q=` that adds students as removable chips. When the student has a referral in the coordinator's queue (already loaded from `GET /api/gestao/encaminhamentos`), the chip shows a `"Encaminhamento relacionado"` select with that student's referrals and `"Nenhum"`.
- `"Participantes"` (1 to 15): three checkbox groups, `"Equipe Multidisciplinar"`, `"Docentes"`, and `"Coordenação"`, loaded from `GET /api/usuarios?perfil=equipe_multidisciplinar`, `?perfil=docente`, and `?perfil=gestor_escolar`. The logged coordinator is not listed; the backend adds the organizer.
- `"Pauta"` (optional, 1,000 characters with a live counter), with the hint `"A pauta fica apenas no A.M.P.A.R.A. e não é enviada por e-mail. Não registre informações clínicas."`

The submit button reads `"Agendar e Enviar Convites"` (`"Salvar e Atualizar Convites"` when editing) and is disabled with `"Enviando..."` while the request runs. Client-side checks mirror the contract (required fields, a date in the future, the student and participant counts) only to save a round trip; the backend's `mensagem` is still shown verbatim in an `aria-live="assertive"` error area at the top of the form when it refuses, and focus moves there. On success the dialog closes, the backend `mensagem` shows in the toast, and the agenda reloads.

### Shortcut from the referral triage modal
`#referral-triage-modal` gains a secondary button, `"Agendar reunião sobre este caso"`, that closes the triage modal and opens `#meeting-modal` with the referral's student as the only chip and the referral preselected. This is the path the story map has in mind: a critical case in the queue becomes a meeting without retyping.

### Details dialog and minutes
`#meeting-details-modal` shows the date and time, location, organizer, agenda, the students with class and, when linked, the referral's status and priority badges, and the participants with their role. When `estudantes_ocultos` is above zero, a line reads `"Mais {n} estudante(s) fora das suas turmas."`

For a coordinator and a meeting in `"Agendada"`, the footer offers `"Editar"`, which opens `#meeting-modal` pre-filled, and `"Cancelar Reunião"`, which asks in a nested `role="alertdialog"`: `"Cancelar esta reunião? Todos os participantes serão avisados por e-mail."` with `"Sim, cancelar reunião"` and `"Voltar"`. A 409 on either shows the backend message and reloads the details, since another coordinator changed the meeting.

From the meeting's start onward, and unless it was cancelled, a coordinator sees the `"Ata da Reunião"` editor: a textarea of 4,000 characters with a counter, the hint `"Registre decisões, responsáveis e prazos. Não registre informações clínicas nem relatos de atendimento."`, and a `"Salvar Ata"` button. The last save shows as `"Atualizada por {nome} em {dd/mm/aaaa hh:mm}"`. Other participants see the minutes as read-only text, or `"A ata ainda não foi registrada."`

### Participants' agenda
`#panel-docente` and `#panel-saude` gain a `"Minhas Reuniões"` card above their current content, listing the next 60 days from `GET /api/reunioes` in the same card format, with the same details dialog in read-only mode. Empty state: `"Você não tem reuniões agendadas para os próximos 60 dias."` The card stays collapsed to the next 3 meetings with a `"Ver todas"` button, so it does not push the teacher's class list below the fold.

### Accessibility
Both dialogs close on Escape and on a backdrop click and return focus to the control that opened them, as `#referral-triage-modal` does; the nested cancel confirmation traps focus until answered. Chips are buttons with `aria-label="Remover {nome}"`. Checkbox groups are `<fieldset>` elements with a `<legend>`. Agenda reloads announce the count through an `aria-live="polite"` line, `"{n} reuniões encontradas."`

No prototype code is deleted: the dashboard has no meeting mock. Copies under `frontend/src/` stay identical to `frontend/public/`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Exercised against the real `dashboard.html` through `frontend/test/dashboard_harness.js`, with `fetch` doubled per route, and with a teacher and a psychologist user alongside `GESTOR`.

- `frontend/test/test_meetings_agenda.js`: the tab joins tab switching; "Próximas" and "Anteriores" send the right `de`/`ate`; card rendering, the three states, and the `aria-live` count; teachers and psychologists see "Minhas Reuniões" and no scheduling button.
- `frontend/test/test_meeting_form.js`: field validation; the ISO string with the browser's offset; the payload sent to `POST /api/gestao/reunioes`; students from `GET /api/estudantes?q=` and the related-referral select; participants loaded per profile; the backend message shown in the error area and focused; editing sends `PUT` with the full body; the triage-modal shortcut pre-fills student and referral.
- `frontend/test/test_meeting_details.js`: students, hidden-student line, and participants; the cancel confirmation and its `POST`; the minutes editor appearing only after `inicio` and never on a cancelled meeting; read-only minutes for participants; the 409 reload; Escape and focus return on both dialogs.

## Out of Scope
- Routes, tables, invitations, and the `.ics` content, specified in [todo/0035-multidisciplinary-meeting-scheduling-backend.md](0035-multidisciplinary-meeting-scheduling-backend.md).
- A month-grid calendar view; the list covers the volume a school produces (a few meetings a week).
- RSVP, reminders, and recurring meetings.
- Showing meetings in the student timeline.
