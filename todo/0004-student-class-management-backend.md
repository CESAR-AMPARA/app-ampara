# Student and Class Management Backend

*This specification defines the backend implementation of the student and class database schemas, manual registration, and spreadsheet-based batch import APIs, which is paired with the frontend specification in [todo/0005-student-class-management-frontend.md](0005-student-class-management-frontend.md).*

## Problem
Currently, App A.M.P.A.R.A. has a database model for users but lacks schemas and endpoints for managing classes (`Turmas`) and students (`Estudantes`) in its backend. Without these underlying models, school coordinators cannot register their school's structure, and teachers cannot select a class or student to record behavioral alerts, render metrics, or escalate psychosocial concerns. Furthermore, manual entry of hundreds of students is a high-friction process that would prevent real-world adoption unless supported by efficient batch-import APIs.

## Business Vision and Purposes
To enable reliable and compliant behavioral monitoring, the backend must support structured class and student registries with strict isolation per school tenant. This feature enables school managers (coordenadores e diretores) to build their school's roster and allows teachers to immediately begin tracking and registering real-time behavioral observations for specific, verified students, ensuring maximum data integrity, auditability, and compliance with the General Data Protection Law (LGPD - Lei Geral de Proteção de Dados).

## Solution
We will implement isolated `Turma` and `Estudante` database models within each school's tenant database and expose a set of secure RESTful APIs. These APIs will support:
- Creating and listing classes manually.
- Registering individual students and associating them with specific classes.
- Processing bulk spreadsheet uploads (.csv or .xlsx files) to import whole classes and student lists in seconds.
- Restricting access so that coordinators can read/write data in their tenant database, while teachers have read-only access to search and view students within their authorized classes.

## User Stories
1. As a Coordenador Pedagógico, I want to create a new class with its name and academic period, so that I can organize my school's structure.
2. As a Coordenador Pedagógico, I want to add a student manually by providing their full name and registration number, so that I can keep my student rosters updated.
3. As a Coordenador Pedagógico, I want to upload a CSV spreadsheet containing a list of students, so that I can import whole classes at once without manual typing.
4. As a Docente, I want to search and list students within my classes, so that I can select them to log behavioral annotations or absences.

## Implementation Decisions

### Tenant-Level Database Models
We will add two new models in `src/models.py` inside each school's tenant database to represent classes and students:
1. `Turma` model:
   - `id` (INTEGER, primary key)
   - `nome` (VARCHAR(100), unique per tenant, nullable=False) - e.g., `"1º Ano A"`
   - `turno` (VARCHAR(30), nullable=False) - Values: `"matutino"`, `"vespertino"`, `"noturno"`, `"integral"`
   - `created_at` (TIMESTAMP)
2. `Estudante` model:
   - `id` (INTEGER, primary key)
   - `nome` (VARCHAR(150), nullable=False)
   - `matricula` (VARCHAR(50), unique per tenant, nullable=False)
   - `turma_id` (INTEGER, foreign key referencing `turma(id)`, nullable=False)
   - `created_at` (TIMESTAMP)

### API Endpoints and Contracts

#### 1. Create a Class
`POST /api/turmas`
- Description: Creates a new class manually in the active tenant database.
- Headers: `Authorization: Bearer <token>` (Accessible only to profiles: `gestor_escolar` / coordinator)
- Request Body:
```json
{
  "nome": "1º Ano A",
  "turno": "matutino"
}
```
- Validations:
  - If `nome` already exists in this tenant, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "Turma já cadastrada."}`
- Response Status: 201 Created
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Turma cadastrada com sucesso.",
  "id": 1
}
```

#### 2. List Classes
`GET /api/turmas`
- Description: Lists all registered classes in the active tenant database.
- Headers: `Authorization: Bearer <token>`
- Response Status: 200 OK
- Response Body:
```json
{
  "turmas": [
    {
      "id": 1,
      "nome": "1º Ano A",
      "turno": "matutino",
      "total_estudantes": 34
    }
  ]
}
```

#### 3. Register a Student
`POST /api/estudantes`
- Description: Registers an individual student in the active tenant database and binds them to an existing class.
- Headers: `Authorization: Bearer <token>` (Accessible only to coordinator)
- Request Body:
```json
{
  "nome": "Lucas Mendes de Oliveira",
  "matricula": "2026.01.0001",
  "turma_id": 1
}
```
- Validations:
  - If `matricula` already exists in this tenant, return status 400 Bad Request with: `{"sucesso": false, "mensagem": "Matrícula de estudante já cadastrada."}`
  - If `turma_id` does not exist in this tenant, return status 404 Not Found with: `{"sucesso": false, "mensagem": "Turma informada não encontrada."}`
- Response Status: 201 Created
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Estudante cadastrado com sucesso.",
  "id": 25
}
```

#### 4. Search and List Students
`GET /api/estudantes`
- Description: Lists or searches students in the active tenant database. Can be filtered by `turma_id` or searched by name query.
- Headers: `Authorization: Bearer <token>`
- Parameters: `turma_id` (optional, integer), `q` (optional, string)
- Response Status: 200 OK
- Response Body:
```json
{
  "estudantes": [
    {
      "id": 25,
      "nome": "Lucas Mendes de Oliveira",
      "matricula": "2026.01.0001",
      "turma": {
        "id": 1,
        "nome": "1º Ano A"
      }
    }
  ]
}
```

#### 5. Bulk Import Students
`POST /api/estudantes/import`
- Description: Accepts a CSV file or Excel spreadsheet in a multipart form-data payload, parses student rows, and registers them in bulk under the active tenant database.
- Headers: `Authorization: Bearer <token>` (Accessible only to coordinator)
- Payload: multipart/form-data with file key `file` (maximum size 5MB)
- File Format Requirements (CSV columns): `nome`, `matricula`, `nome_turma`
- Actions:
  - Parses each row. If `nome_turma` does not exist, the API dynamically creates the class using a default `turno` of `"integral"`.
  - Performs batch inserts to insert up to 1,000 students in a single transaction. Duplicate matriculas are skipped or flagged in the response.
- Response Status: 200 OK
- Response Body:
```json
{
  "sucesso": true,
  "mensagem": "Planilha importada com sucesso.",
  "importados": 120,
  "erros": [
    {
      "linha": 4,
      "motivo": "Matrícula 2026.01.0001 já cadastrada."
    }
  ]
}
```

## Testing Decisions
We will write comprehensive tests in the following new modules under `backend/test/`:
- `test/test_models_turma_estudante.py`: Verifies database constraints (uniqueness of matricula within tenant, foreign keys, cascade deletes).
- `test/test_api_turma.py`: Tests the manual `/api/turmas` endpoints, checking role-based permissions (allowing gestor_escolar, denying docente from writing).
- `test/test_api_estudante.py`: Tests manual student registration and search filtering.
- `test/test_api_estudante_import.py`: Tests bulk CSV parsing. Uses mock stream objects to simulate file upload and verifies bulk database transactions and error reports.

## Out of Scope
- Interactive frontend forms, upload fields, and progress bar animations (fully specified in the paired frontend specification [todo/0005-student-class-management-frontend.md](0005-student-class-management-frontend.md)).
- Dynamic synchronization of school rosters with state or federal education databases.
- Deletion or editing of students' past academic records.

## Further Notes
The bulk import mechanism is built in a memory-efficient streaming format to prevent server resource exhaustion when processing spreadsheets with up to 10,000 rows.
