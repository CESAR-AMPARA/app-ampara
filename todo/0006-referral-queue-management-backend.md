# Referral Queue Management Backend

*This specification defines the backend implementation of the student referral database model, status transitions, and coordinator/psychologist APIs, which is paired with the frontend specification in [todo/0007-referral-queue-management-frontend.md](0007-referral-queue-management-frontend.md).*

## Problem
Currently, there is no standardized, secure, or audited pipeline within App A.M.P.A.R.A. to escalate students showing critical psychological distress to specialized care. When teachers (Docentes) observe alarming behavioral or emotional patterns in students, they must communicate with the school's Pedagogical Coordinator (Coordenador Pedagógico) or mental health staff (psychologists/social workers) using unstructured channels like papers or text messages. This lacks accountability, leads to delayed or missed care for students in crisis, and violates Brazil's General Data Protection Law (LGPD - Lei Geral de Proteção de Dados) by transmitting sensitive student health data without rigorous access logging and access control.

## Business Vision and Purposes
To ensure timely, coordinated, and compliant psychosocial intervention, the backend must support a robust, automated Referral Queue system. This feature enables pedagogical coordinators to act as secure gatekeepers who can centralize, prioritize, and assign student cases to specific mental health professionals. By tracking referral status from triage to resolution, the school maintains an audited, secure, and privacy-compliant ledger of care, ensuring no vulnerable student is left unassisted while strictly protecting sensitive data.

## Solution
We will implement an `Encaminhamento` (Referral) database model with isolated tables per tenant database and expose restricted APIs for case triage and assignment.
- A referral starts with a status of `"Aguardando Triagem"` (Pending Triage) and a default priority of `"Média"`.
- The Pedagogical Coordinator can list the full queue, set a custom priority (`"Baixa"`, `"Média"`, or `"Alta"`), add private coordinator observations, and assign the student to a specific registered psychologist or social worker.
- Once assigned, the referral's status can transition to `"Em Atendimento"` (Active Care) and ultimately `"Concluído"` (Resolved) or `"Arquivado"` (Archived), tracked via strict role-based access control.

## User Stories
1. As a Docente, I want to submit a formal referral request for a student under my care, describing their behavioral concerns, so that the coordinator can route them to support.
2. As a Coordenador Pedagógico, I want to list all referrals in my school, filtering them by priority and status, so that I can manage my team's workload and quickly identify students in critical need.
3. As a Coordenador Pedagógico, I want to update a referral's priority and assign it to a specific psychologist or social worker, so that they can take immediate action.
4. As an Equipe Multidisciplinar professional (psychologist/social worker), I want to view all referrals assigned specifically to me and transition their status as I provide care, so that I can document the progression of their treatment securely.

## Implementation Decisions

### Tenant-Level Database Models
We will add a new `Encaminhamento` model in `src/models.py` inside each school's tenant database:
1. `Encaminhamento` model:
   - `id` (INTEGER, primary key)
   - `estudante_id` (INTEGER, foreign key referencing `estudante(id)`, nullable=False)
   - `solicitante_id` (INTEGER, foreign key referencing `usuarios(id)`, nullable=False) - The teacher or coordinator who created the referral
   - `designado_id` (INTEGER, foreign key referencing `usuarios(id)`, nullable=True) - The psychologist or social worker assigned to the case
   - `motivo` (TEXT, nullable=False) - Verbatim description of behavioral or emotional distress
   - `observacoes_coordenacao` (TEXT, nullable=True) - Coordinator's private notes and internal logs
   - `prioridade` (VARCHAR(20), default='Média') - Values: `"Baixa"`, `"Média"`, `"Alta"`
   - `status` (VARCHAR(30), default='Aguardando Triagem') - Values: `"Aguardando Triagem"`, `"Em Atendimento"`, `"Concluído"`, `"Arquivado"`
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

### State Machine Transition Rules
State transitions are strictly audited and guarded by Role-Based Access Control (RBAC):
- `"Aguardando Triagem"` -> `"Em Atendimento"`: Can be triggered only by the assigned `designado_id` (Psychologist/Social Worker) or the coordinator. Requires a non-null `designado_id`.
- `"Em Atendimento"` -> `"Concluído"`: Can be triggered only by the assigned `designado_id` or the coordinator. Represents a completed intervention.
- Any state -> `"Arquivado"`: Can be triggered only by the coordinator. Represents a case that was dismissed, resolved, or cancelled.

### API Endpoints and Contracts

#### 1. Submit a Referral
`POST /api/encaminhamentos`
- Description: Initiates a new student referral. Accessible to `docente` and `gestor_escolar` (coordinator) roles.
- Request Body:
```json
{
  "estudante_id": 25,
  "motivo": "Estudante tem se isolado frequentemente dos colegas e apresentou choro descontrolado na biblioteca durante o intervalo."
}
```
- Validations:
  - If `estudante_id` does not exist in the active tenant database, return status 404 Not Found with: `{"sucesso": false, "mensagem": "Estudante não encontrado."}`
- Actions:
  - Inserts a new row in the tenant's `encaminhamentos` table with `status="Aguardando Triagem"` and `prioridade="Média"`. Sets `solicitante_id` to the logged-in user.
- Response Status: 201 Created
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Encaminhamento registrado com sucesso.",
  "id": 142
}
```

#### 2. List Referral Queue (Coordinator)
`GET /api/gestao/encaminhamentos`
- Description: Retrieves all student referrals inside the active tenant database. Accessible only to `gestor_escolar` / coordinator.
- Parameters: `status` (optional, string), `prioridade` (optional, string), `q` (optional, string - searches student name)
- Response Status: 200 OK
- Response Body:
```json
{
  "encaminhamentos": [
    {
      "id": 142,
      "estudante": {
        "id": 25,
        "nome": "Lucas Mendes de Oliveira",
        "matricula": "2026.01.0001",
        "turma": "1º Ano A"
      },
      "solicitante": {
        "id": 4,
        "nome": "Prof. Carlos Souza"
      },
      "designado": {
        "id": 8,
        "nome": "Psicóloga Amanda Costa"
      },
      "motivo": "Estudante tem se isolado frequentemente...",
      "prioridade": "Média",
      "status": "Aguardando Triagem",
      "created_at": "2026-09-12T10:15:00Z"
    }
  ]
}
```

#### 3. Manage a Referral (Coordinator Triage)
`PUT /api/gestao/encaminhamentos/<int:id>`
- Description: Allows coordinators to triage a case by setting its priority, assigning it to a professional, or adding coordination notes.
- Headers: `Authorization: Bearer <token>` (Accessible only to coordinator)
- Request Body:
```json
{
  "prioridade": "Alta",
  "designado_id": 8,
  "observacoes_coordenacao": "Conversei com o professor e o caso requer atenção prioritária devido a recorrência de crises emocionais."
}
```
- Validations:
  - If the referral `id` does not exist, return 404.
  - If `designado_id` is provided but is not a user with the role `"equipe_multidisciplinar"`, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "O profissional designado deve pertencer à equipe multidisciplinar."}`
- Actions:
  - Updates `prioridade`, `designado_id`, and `observacoes_coordenacao`. Updates `updated_at`.
- Response Status: 200 OK
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Encaminhamento atualizado e designado com sucesso."
}
```

#### 4. List Assigned Referrals (Psychologist/Social Worker)
`GET /api/multidisciplinar/encaminhamentos`
- Description: Lists all referrals assigned to the currently logged-in professional. Accessible only to `"equipe_multidisciplinar"`.
- Parameters: `status` (optional, string)
- Response Status: 200 OK
- Response Body:
```json
{
  "encaminhamentos": [
    {
      "id": 142,
      "estudante": {
        "nome": "Lucas Mendes de Oliveira",
        "turma": "1º Ano A"
      },
      "motivo": "Estudante tem se isolado frequentemente...",
      "prioridade": "Alta",
      "status": "Aguardando Triagem",
      "created_at": "2026-09-12T10:15:00Z"
    }
  ]
}
```

#### 5. Update Care Status (Psychologist/Social Worker)
`PUT /api/multidisciplinar/encaminhamentos/<int:id>/status`
- Description: Allows assigned professionals to transition the status of their cases as they deliver care.
- Request Body:
```json
{
  "status": "Em Atendimento"
}
```
- Validations:
  - The logged-in user must be the `designado_id` of the referral or the coordinator; otherwise, return status 403 Forbidden with: `{"sucesso": false, "mensagem": "Você não tem permissão para alterar o status deste caso."}`
  - The requested state must follow the State Machine Transition Rules (e.g., cannot move a concluded case back to awaiting triage).
- Response Status: 200 OK
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Status do atendimento atualizado para 'Em Atendimento'."
}
```

## Testing Decisions
We will write exhaustive unit and behavioral tests under `backend/test/`:
- `test/test_models_encaminhamento.py`: Tests the `Encaminhamento` model constraints, foreign keys, and default values.
- `test/test_api_encaminhamentos_gestao.py`: Tests coordinator-only endpoints (`GET /api/gestao/encaminhamentos` and `PUT /api/gestao/encaminhamentos/<id>`), checking state validations, profile checks, and assigning invalid user roles (which must be blocked).
- `test/test_api_encaminhamentos_docente.py`: Tests the creation of referrals by teachers and blocks them from triaging or viewing other teachers' referrals.
- `test/test_api_encaminhamentos_multidisciplinar.py`: Tests psychologist-specific list and status transitions, verifying that a psychologist cannot transition or modify referrals assigned to other colleagues.

## Out of Scope
- Frontend dashboard screens, management tables, filters, and assignment modals (fully covered in [todo/0007-referral-queue-management-frontend.md](todo/0007-referral-queue-management-frontend.md)).
- Creation of electronic medical/psychological records (PEP). The system only tracks the state of the referral pipeline, not clinical session notes, protecting student medical privacy.
- External SMS/email notifications to parents or health clinics.

## Further Notes
The routing uses the same `database_router.py` database connection context to ensure that all query transactions and audits occur inside the isolated school database.
