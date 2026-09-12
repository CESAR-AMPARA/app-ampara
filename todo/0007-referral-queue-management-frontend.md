# Referral Queue Management Frontend

*This specification defines the frontend implementation of the student referral queue dashboard views, prioritization controls, and professional assignment modals, which is paired with the backend specification in [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md).*

## Problem
Pedagogical coordinators currently lack a unified, structured, and secure digital interface to track and process students referred for psychological or social care. Instead of having a centralized queue, coordinators must rely on manual, out-of-band communications with teachers and psychologists (such as emails or paper forms). This creates a high risk of sensitive student information being exposed to unauthorized individuals, prevents coordinators from quickly filtering and identifying urgent high-priority cases, and provides no clear history of who was assigned to deliver care or what stage the intervention is in.

## Business Vision and Purposes
To facilitate rapid, organized, and compliant psychosocial triage, the coordinator's panel must feature an interactive, real-time Referral Queue dashboard. This screen empowers pedagogical coordinators to instantly review incoming student escalations, adjust priority levels based on urgency, assign professionals with appropriate specializations, and keep track of case status from triage to closure. A secure, visual queue inside the app guarantees that no vulnerable student is overlooked and that care delivery is tracked securely in compliance with the General Data Protection Law (LGPD - Lei Geral de Proteção de Dados).

## Solution
We will implement an interactive dashboard tab named `"📋 Fila de Encaminhamentos"` inside the coordinator's dashboard (`panel-gestor` in `frontend/public/dashboard.html`) and an assigned cases section inside the psychologist's dashboard (`panel-saude` in `frontend/public/dashboard.html`).
- The coordinator's queue will render a dynamic table listing all student referrals. Each row will display the Student's Name, Class, Submission Date, Requesting Teacher, Priority Level (with color-coded pills), and Current Status (e.g., `"Aguardando Triagem"`, `"Em Atendimento"`, `"Concluído"`).
- Clicking a referral opens a `"Gerenciar Encaminhamento"` modal, allowing the coordinator to set its priority, assign it to a member of the Equipe Multidisciplinar, and add private observations.
- Psychologists will have a tailored, read-only list of cases assigned specifically to them, with intuitive buttons to transition the status from `"Aguardando Triagem"` to `"Em Atendimento"` and `"Concluído"`.

## User Stories
1. As a Coordenador Pedagógico, I want to access a dedicated "Fila de Encaminhamentos" tab, so that I can see all students in my school who have been referred for mental health or social support.
2. As a Coordenador Pedagógico, I want to filter the referral list by priority level and current status, so that I can focus my immediate attention on critical, pending cases.
3. As a Coordenador Pedagógico, I want to click on a pending referral to open a triage modal, select an assigned psychologist from a list, and set the priority to high, so that the case is routed to them instantly with clear context.
4. As an Equipe Multidisciplinar professional, I want to view my assigned cases in my panel and click a button to change a student's status to "Em Atendimento" when we begin sessions, so that the coordinator can track progress in real-time.

## Implementation Decisions

### Tab Navigation inside `panel-gestor`
We will append a new button to the internal tab navigation of the coordinator's view inside `frontend/public/dashboard.html`:
```html
<button class="tab-btn" role="tab" aria-selected="false" aria-controls="gestor-tab-encaminhamentos" id="btn-gestor-tab-encaminhamentos" style="font-size: 0.95rem; padding: 10px 16px;">
  📋 Fila de Encaminhamentos
</button>
```
When clicked, the script will fetch data from `/api/gestao/encaminhamentos` and render the referral queue table in the container `#gestor-tab-encaminhamentos`.

### Interactive Referral Queue Table
The queue table will display:
- **Estudante**: Full name of the student and their class (e.g., `"Lucas Mendes (1º Ano A)"`).
- **Data de Envio**: Formatted date (e.g., `"12/09/2026"`).
- **Solicitante**: Name of the teacher who initiated the request.
- **Prioridade**: Color-coded badges:
  - `"Alta"`: Soft Crimson background (`#DCCFE1` or custom `#FCE8E6` with dark red text).
  - `"Média"`: Soft Yellow background with dark orange text.
  - `"Baixa"`: Mint Sage background with dark green text.
- **Status**: Standardized status badges matching the backend schema: `"Aguardando Triagem"`, `"Em Atendimento"`, `"Concluído"`, or `"Arquivado"`.
- **Ações**: A button labeled `"Avaliar"` (or `"Gerenciar"`) which opens the triage modal.

### Triage Modal (`#referral-triage-modal`)
The modal structure will contain:
- A title with the student's name and details.
- A read-only block showing the teacher's verbatim referral reason (`motivo`).
- A dropdown select for **Prioridade** (Options: `"Baixa"`, `"Média"`, `"Alta"`).
- A dropdown select for **Profissional Designado** (dynamically populated by calling `/api/usuarios?perfil=equipe_multidisciplinar` and listing active psychologists/social workers).
- A textarea for **Observações da Coordenação** (Coordinator's private triage notes).
- A submit button labeled `"Salvar Atribuição"` and a close button labeled `"Cancelar"`.
- Submitting the form triggers a `PUT` request to `/api/gestao/encaminhamentos/<id>`. Upon success, the modal closes, the queue table is re-rendered, and a toast displays: `"Encaminhamento designado com sucesso!"`

### Psychologist Dashboard Case Actions
Within the mental health panel (`panel-saude` in `frontend/public/dashboard.html`), we will render a list of assigned referrals from `/api/multidisciplinar/encaminhamentos`.
- Each case card or row will include a dynamic actions container.
- If status is `"Aguardando Triagem"`, renders a button: `"Iniciar Atendimento"` which sends `PUT` with `{"status": "Em Atendimento"}` and refreshes the list.
- If status is `"Em Atendimento"`, renders a button: `"Concluir Caso"` which sends `PUT` with `{"status": "Concluído"}` and opens a brief textarea to capture a closing summary.

## Testing Decisions
We will write frontend integration and component tests under `frontend/test/`:
- `frontend/test/test_referral_queue_table.js`: Mocks the API response of `/api/gestao/encaminhamentos` to verify that rows, names, priorities, and status badges are rendered correctly and display correct CSS classes.
- `frontend/test/test_triage_modal_interactions.js`: Verifies that opening the triage modal correctly populates fields, that the psychologist dropdown lists the mocked multidisciplinary users, and that submitting the form triggers the correct PUT request with headers.
- `frontend/test/test_psychologist_actions.js`: Verifies that clicking `"Iniciar Atendimento"` correctly transitions the state and updates the UI button layout in the psychologist's interface.

## Out of Scope
- Backend database routing, SQLAlchemy schemas, status validation logic, and session controllers (covered in [todo/0006-referral-queue-management-backend.md](todo/0006-referral-queue-management-backend.md)).
- Creation of electronic medical record entries or text editors inside the app.
- Student-facing portal pages (since students have no direct access to App A.M.P.A.R.A. behavioral tracking interfaces as per privacy rules).

## Further Notes
To prevent visual clutter, the coordinator notes text is truncated in the main table and only expanded in full inside the interactive modal.
