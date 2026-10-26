# Multidisciplinary Meeting Scheduling Backend

*Phase: Increments #3 to N (other). Story-map cards: "As a Pedagogical Coordinator, I want to schedule meetings with the multidisciplinary team to discuss critical cases" (value 100, 3 points).*

*This specification defines the backend of case meetings: storage, agenda, e-mail invitations with a calendar attachment, and administrative minutes. Its frontend counterpart is [todo/0036-multidisciplinary-meeting-scheduling-frontend.md](0036-multidisciplinary-meeting-scheduling-frontend.md), which can be built against the contract below before this ships. It depends on referrals from [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md), the `EmailAdapter` from [todo/0008-password-reset-backend.md](0008-password-reset-backend.md), `require_profile` from [todo/0011-access-management-backend.md](0011-access-management-backend.md), `ScopePolicy` from [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md), the anonymization sweep of [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md), and `AuditLogger` from [todo/0027-access-audit-log-backend.md](0027-access-audit-log-backend.md).*

## Problem
When a case turns critical, the Pedagogical Coordinator has to gather the school psychologist, the social worker, and the student's teachers around the same table, and today that happens over messaging apps and hallway conversations. Nobody knows in advance which students will be discussed, invitations reach some people and not others, and whatever was decided lives in someone's notebook. The next time the case comes up, the team re-discusses it from scratch.

## Business Vision and Purposes
Case meetings are where the school decides what to do about its most fragile students. Scheduling them in the app ties each meeting to the students and referrals it covers, puts it on every participant's own calendar, and keeps an administrative record of what was decided and who owns each next step. The coordination gets a shared agenda, and the school gets an auditable trail of collective decisions without turning the platform into a clinical record.

## Solution
A coordinator schedules a meeting with a title, date and time, duration, optional location and agenda, one or more students (each optionally tied to one of their referrals), and participants chosen among the school's active users. Each participant receives an e-mail with a calendar invitation attached and sees the meeting in the app's agenda. The coordinator can reschedule or cancel, and every change reaches the participants' calendars. After the meeting starts, the coordinator records the minutes: decisions and responsible people, not clinical content.

## User Stories
1. As a Coordenador Pedagógico, I want to schedule a meeting about one or more critical students and invite the multidisciplinary team and the students' teachers, so that the right people meet at the same time.
2. As a participant, I want the invitation to land in my own calendar, so that I do not have to copy it by hand.
3. As a participant, I want to see my upcoming meetings and the students they cover in the app, so that I can prepare.
4. As a Coordenador Pedagógico, I want to reschedule or cancel a meeting and have every participant's calendar follow, so that nobody shows up to a meeting that moved.
5. As a Coordenador Pedagógico, I want to record the meeting's decisions and owners, so that the next meeting starts where this one ended.

## Implementation Decisions

### Tenant tables
Three tables are added to each tenant database:

```
reunioes:
  id                 INTEGER      primary key
  titulo             VARCHAR(120) not null
  inicio             TIMESTAMP    not null      -- UTC
  duracao_minutos    INTEGER      not null      -- 15 to 240
  local              VARCHAR(120) null          -- room or video-call link
  pauta              TEXT         null          -- at most 1,000 characters
  ata                TEXT         null          -- at most 4,000 characters, administrative minutes
  ata_por_id         INTEGER      null, references usuarios(id)
  ata_atualizada_em  TIMESTAMP    null
  status             VARCHAR(12)  not null default 'Agendada'  -- "Agendada" | "Realizada" | "Cancelada"
  organizador_id     INTEGER      not null, references usuarios(id)
  ics_uid            VARCHAR(80)  not null unique -- "reuniao-<id>-<secrets.token_hex(8)>@ampara"
  ics_sequencia      INTEGER      not null default 0
  created_at         TIMESTAMP    not null
  updated_at         TIMESTAMP    not null

reuniao_estudantes:
  reuniao_id         INTEGER  not null, references reunioes(id)
  estudante_id       INTEGER  not null, references estudante(id)
  encaminhamento_id  INTEGER  null, references encaminhamentos(id)
  primary key (reuniao_id, estudante_id)

reuniao_participantes:
  reuniao_id  INTEGER  not null, references reunioes(id)
  usuario_id  INTEGER  not null, references usuarios(id)
  primary key (reuniao_id, usuario_id)
```

The organizer is always a participant, inserted by the service whether or not the request lists them. `status` moves from `"Agendada"` to `"Realizada"` when minutes are first saved, or to `"Cancelada"`; both are final.

### Modules
A `MeetingService` in `src/meetings/service.py` holds the rules and receives the session, `ScopePolicy`, the `EmailAdapter`, `AuditLogger`, and a clock through `__init__`, per [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md). `src/meetings/ics.py` builds the calendar attachment, and `src/routes/reunioes.py` is a thin blueprint registered in `create_app`, following the `src/routes/` layout of [todo/0010-backend-foundation-and-delivery-hardening-backend.md](0010-backend-foundation-and-delivery-hardening-backend.md). The clock is injected so tests can pin "now" around the past-date and minutes-after-start rules.

### Calendar invitations: `.ics` through the `EmailAdapter`, not a calendar API
Invitations go out as an e-mail with an RFC 5545 `text/calendar` attachment (`METHOD:REQUEST`), sent through the `EmailAdapter` of `0008`. I chose this over writing events through Google Calendar or Microsoft Graph for three reasons. Schools in the network use mixed providers (municipal `gov.br` mailboxes, Google Workspace for Education, Microsoft 365), and an `.ics` attachment is the one format all of them import; a calendar API would mean one integration per provider. A calendar API also needs OAuth consent per user or domain-wide delegation per school, which means storing refresh tokens per tenant, a new class of secret under [ADR-0003](../adr/0003-secrets-handling-credentials.md) and a consent flow the school's IT has to approve. Finally, writing into a provider's calendar puts meeting data under that provider's terms in a store the school does not control. What the API would buy is RSVP tracking and free/busy lookup; neither is worth that cost for a 3-point card, and the in-app agenda stays the source of truth.

The `EmailAdapter` protocol gains an optional `attachments` parameter, a sequence of `Attachment(filename, content_type, content: bytes)`, and `src/adapters/mock_email_adapter.py` records attachments alongside recipient, subject, and body. `0008` ships only the mock adapter; until a real delivery adapter lands, invitations are recorded and not delivered, and the in-app agenda works unchanged.

Updates and cancellations reuse the same `UID` with `ics_sequencia` incremented, which is how calendar clients recognize them as changes to the event they already hold: a reschedule sends `METHOD:REQUEST` to current participants and `METHOD:CANCEL` to removed ones, and a cancellation sends `METHOD:CANCEL` to everyone. Times are written in UTC (`DTSTART:20261029T170000Z`), so the participant's calendar renders them in its own time zone and the tenant needs no time zone setting. `ics.py` is hand-written, about 60 lines: it emits one fixed event shape and needs only text escaping (`\`, `;`, `,`, newlines) and line folding at 75 octets, which the tests pin; a calendar library would be a dependency for a template.

### What leaves the school by e-mail
The invitation never carries student data. The e-mail subject is `"Convite: reunião da equipe multidisciplinar — A.M.P.A.R.A."`, the `.ics` `SUMMARY` is `"Reunião da equipe multidisciplinar — A.M.P.A.R.A."`, and the `DESCRIPTION` and e-mail body read `"Os estudantes, a pauta e os detalhes desta reunião estão disponíveis no A.M.P.A.R.A.: {base_url}/dashboard"`. The coordinator's `titulo` and `pauta` are free text that will often name the student, and e-mail is copied to servers and phones outside the school's control, so they stay in the app. `LOCATION` carries `local`, the one free-text field that leaves, and the frontend labels it for a room or a link only. Attendees appear in the `.ics` with their name and e-mail and `RSVP=FALSE`, and `ORGANIZER` is the platform's sending address, because replies are not processed. The risk is that some clients (Outlook among them, unverified for each version) still offer "Accept" and send the reply to the sending address, where it is discarded; the mitigation is the in-app agenda being authoritative and the e-mail body saying replies are not read.

Sending happens after the transaction commits and does not wait on delivery, as in `0008`, so a mail failure never rolls back a meeting.

### Who sees what
Only a `gestor_escolar` creates, edits, cancels, or writes minutes. A meeting is readable by any `gestor_escolar` and by its participants; anyone else gets 404, so the endpoint never confirms that a meeting exists.

Teachers are the risk of over-sharing. A `docente` may be invited only when every student of the meeting is in `ScopePolicy.estudantes_visiveis` for that teacher, and when reading a meeting a `docente` sees only the students currently in their scope, with the rest counted in `estudantes_ocultos`. An `equipe_multidisciplinar` participant sees every student of the meeting, but only name, class, and the linked referral's `status` and `prioridade`; being invited does not widen their access to timelines, which still goes through `ScopePolicy`. I considered applying the teacher rule to the multidisciplinary team too and rejected it: those meetings exist precisely to bring a case to the team before it is assigned to one of them, and the coordinator's invitation is the need-to-know decision, recorded by `AuditLogger`.

Every read of a meeting's details calls `AuditLogger.registrar` once per visible student with `acao` `"ler_reuniao"` and `recurso` `"reuniao:<id>"`; create, edit, cancel, and minutes write `"criar_reuniao"`, `"editar_reuniao"`, `"cancelar_reuniao"`, and `"registrar_ata"`.

### Minutes are administrative, not clinical
`ata` records decisions, owners, and deadlines ("Psicóloga fará contato com a família até 05/11; coordenação ajusta horário do estudante"). It is not a session record or a clinical note, the same stance `0006` takes on `resumo_encerramento`, and the frontend tells the coordinator so. The minutes can be rewritten after saving; each save updates `ata_por_id` and `ata_atualizada_em`, and the audit log keeps the history of who saved.

### Anonymization
`titulo`, `pauta`, and `ata` are free text that can name a student, so the anonymization of `0017` gains one step. The `registrar_tabela` registry of `AnonymizerService` cannot express it, because the text lives in `reunioes` and the student link in `reuniao_estudantes`, so this spec adds `AnonymizerService.registrar_passo(callback)`, a callback run in the anonymization transaction, and registers `MeetingService.anonymize_student` with it in `create_app`. For every meeting linked to the anonymized student through `reuniao_estudantes`, `titulo` becomes `"Reunião multidisciplinar"` and `pauta` and `ata` become `null`. The link rows, dates, status, and participants stay for statistics. This erases the minutes for every student of a shared meeting, not only the anonymized one; partial redaction of free text cannot be made reliable, and a surviving sentence about a sibling case is an acceptable loss next to a surviving name. The student export of `0017` includes the meetings linked to the student with their `titulo`, `inicio`, `status`, and `ata`. Neither `reunioes` nor `reuniao_estudantes` has both an `estudante_id` and a `TEXT` column, so the registry test of `0017` does not flag them; the anonymization test below is what guards this step.

### `POST /api/gestao/reunioes`
Accessible only to `gestor_escolar`.

- Request Body:
```json
{
  "titulo": "Casos críticos do 1º Ano A",
  "inicio": "2026-10-29T14:00:00-03:00",
  "duracao_minutos": 60,
  "local": "Sala da Coordenação",
  "pauta": "Revisar o plano de acolhimento e definir responsáveis pelo contato com as famílias.",
  "estudantes": [
    { "estudante_id": 25, "encaminhamento_id": 142 },
    { "estudante_id": 31 }
  ],
  "participantes_ids": [8, 4, 12]
}
```
- Validations, each answering 400 Bad Request with `{"sucesso": false, "mensagem": ...}` unless stated otherwise:
  - `titulo` missing, blank, or over 120 characters: `"Informe um título de até 120 caracteres."`
  - `inicio` missing, unparseable, or without a UTC offset: `"Informe a data e o horário da reunião."`
  - `inicio` not in the future: `"A reunião deve ser agendada para uma data futura."`
  - `duracao_minutos` not an integer from 15 to 240: `"A duração deve estar entre 15 e 240 minutos."`
  - `local` over 120 characters: `"O local deve ter até 120 caracteres."`
  - `pauta` over 1,000 characters: `"A pauta deve ter até 1.000 caracteres."`
  - `estudantes` empty or longer than 10: `"Selecione de 1 a 10 estudantes para a reunião."`
  - an `estudante_id` that does not exist: 404 Not Found with `"Estudante não encontrado."`
  - an `encaminhamento_id` that does not exist or belongs to another student: `"O encaminhamento informado não pertence ao estudante."`
  - `participantes_ids` empty or longer than 15: `"Selecione de 1 a 15 participantes."`
  - a participant who is not an `Ativo` user of the tenant: `"Todos os participantes devem ser usuários ativos da escola."`
  - a `docente` participant without every student in their scope: `"Docentes só podem participar de reuniões sobre estudantes das suas turmas."`
- Response Status: 201 Created
```json
{
  "sucesso": true,
  "mensagem": "Reunião agendada. Os participantes receberão o convite por e-mail.",
  "id": 57
}
```

### `GET /api/reunioes?de=YYYY-MM-DD&ate=YYYY-MM-DD`
The agenda. Accessible to all three profiles: a `gestor_escolar` sees every meeting of the school, anyone else only the meetings they participate in. `de` defaults to today and `ate` to `de` plus 60 days; a range over 180 days answers 400 with `"O período consultado deve ter no máximo 180 dias."`. The list carries no student names, which keeps an agenda glance from becoming a disclosure; titles are the coordinator's text and are shown as written. Ordered by `inicio`.

```json
{
  "reunioes": [
    {
      "id": 57,
      "titulo": "Casos críticos do 1º Ano A",
      "inicio": "2026-10-29T17:00:00Z",
      "duracao_minutos": 60,
      "local": "Sala da Coordenação",
      "status": "Agendada",
      "organizador": { "id": 1, "nome": "Diretor João" },
      "total_estudantes": 2,
      "total_participantes": 4
    }
  ]
}
```

### `GET /api/reunioes/<int:id>`
Details for a `gestor_escolar` or a participant; anyone else gets 404 Not Found with `"Reunião não encontrada."`.

```json
{
  "id": 57,
  "titulo": "Casos críticos do 1º Ano A",
  "inicio": "2026-10-29T17:00:00Z",
  "duracao_minutos": 60,
  "local": "Sala da Coordenação",
  "pauta": "Revisar o plano de acolhimento e definir responsáveis pelo contato com as famílias.",
  "status": "Agendada",
  "organizador": { "id": 1, "nome": "Diretor João" },
  "estudantes": [
    {
      "id": 25,
      "nome": "Lucas Mendes de Oliveira",
      "turma": "1º Ano A",
      "encaminhamento": { "id": 142, "status": "Em Atendimento", "prioridade": "Alta" }
    },
    { "id": 31, "nome": "Beatriz Lima", "turma": "1º Ano A", "encaminhamento": null }
  ],
  "estudantes_ocultos": 0,
  "participantes": [
    { "id": 8, "nome": "Psicóloga Amanda Costa", "perfil": "equipe_multidisciplinar", "cargo": "Psicóloga Escolar" }
  ],
  "ata": null,
  "ata_por": null,
  "ata_atualizada_em": null
}
```

### `PUT /api/gestao/reunioes/<int:id>`
Reschedules or edits a meeting; accessible only to `gestor_escolar`. The body and validations are those of the creation route, as a full replacement. A meeting whose `status` is not `"Agendada"` answers 409 Conflict with `"Somente reuniões agendadas podem ser alteradas."`. On success `ics_sequencia` is incremented, current participants receive an updated `REQUEST` and removed ones a `CANCEL`, and the response is 200 OK with `{"sucesso": true, "mensagem": "Reunião atualizada. Os participantes receberão o convite atualizado."}`.

### `POST /api/gestao/reunioes/<int:id>/cancelar`
Accessible only to `gestor_escolar`, with no body. A meeting not in `"Agendada"` answers 409 Conflict with `"Somente reuniões agendadas podem ser canceladas."`. On success `status` becomes `"Cancelada"`, every participant receives a `CANCEL`, and the response is 200 OK with `{"sucesso": true, "mensagem": "Reunião cancelada. Os participantes serão avisados por e-mail."}`.

### `PUT /api/gestao/reunioes/<int:id>/ata`
Accessible only to `gestor_escolar`.

- Request Body: `{"ata": "Psicóloga fará contato com a família até 05/11. Coordenação ajusta o horário do estudante."}`
- `ata` missing or blank: 400 with `"Escreva a ata antes de salvar."`; over 4,000 characters: 400 with `"A ata deve ter até 4.000 caracteres."`
- Before `inicio`: 409 Conflict with `"A ata só pode ser registrada após o início da reunião."`; on a cancelled meeting: 409 Conflict with `"Reuniões canceladas não recebem ata."`
- Response Status: 200 OK with `{"sucesso": true, "mensagem": "Ata registrada com sucesso."}`; `status` becomes `"Realizada"`.

The participant picker consumes `GET /api/usuarios?perfil=` from `0006`, which already returns only active users of a profile; no new route is needed for it.

## Testing Decisions
Routes are exercised through the Flask test client against an in-memory SQLite tenant database, with `MockEmailAdapter` capturing every message and attachment and a fixed clock injected into `MeetingService`.

- `backend/test/test_meetings_service.py`: every validation above; the organizer added as participant; the teacher scope rule on invitation and on reading (`estudantes_ocultos`); status transitions and the 409s; the anonymization step blanking `titulo`, `pauta`, and `ata` of linked meetings only.
- `backend/test/test_meetings_ics.py`: `REQUEST` and `CANCEL` output, `UID` stable across updates and `SEQUENCE` incremented, UTC times, escaping of `;`, `,`, and newlines in `LOCATION`, folding of lines over 75 octets, and no student name or `titulo` anywhere in the attachment or the e-mail body.
- `backend/test/test_routes_reunioes.py`: role access per route, 404 for non-participants, the agenda filtered by participation and by `de`/`ate`, the 180-day limit, audit entries per visible student.
- `backend/test/test_adapters_mock_email_adapter.py` (extended): attachments are recorded with filename, content type, and bytes.
- `backend/test/test_lgpd_anonymizer.py` (from `0017`, extended): `registrar_passo` callbacks run in the anonymization transaction and roll back with it.
- `backend/test/test_api_estudante_exportar.py` (from `0017`, extended): linked meetings appear in the export.

## Out of Scope
- The agenda, scheduling form, details view, and minutes editor, specified in [todo/0036-multidisciplinary-meeting-scheduling-frontend.md](0036-multidisciplinary-meeting-scheduling-frontend.md).
- A real e-mail delivery adapter; this spec extends the `EmailAdapter` protocol and its mock only.
- RSVP tracking, free/busy lookup, recurring meetings, and video-call link generation.
- Reminders before the meeting.
- Showing meetings in the student timeline of `0015`.
- Clinical records of what was discussed about each student.

## Further Notes
Showing "discussed in a multidisciplinary meeting on 2026-10-29" in the student's timeline would help the next reader of the case; it is a contract change to `GET /api/estudantes/<id>/historico` (a new `tipo_registro`) and belongs in its own spec once the agenda is in use.
