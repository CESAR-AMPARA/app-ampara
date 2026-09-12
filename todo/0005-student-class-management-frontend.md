# Student and Class Management Frontend

*This specification defines the frontend implementation of the student and class registration forms, dynamic dropdown listings, and batch spreadsheet import UI, which is paired with the backend specification in [todo/0004-student-class-management-backend.md](0004-student-class-management-backend.md).*

## Problem
Although static UI mockups exist in the project for `cadastro_turma.html` and `cadastro_estudante.html`, they lack functional javascript integrations to fetch or send data to the backend APIs. School managers currently cannot interact with these forms to build their school's roster, register new classes, or upload CSV rosters, rendering the application's administrative layer non-functional and preventing teachers from selecting students in the dashboard.

## Business Vision and Purposes
Providing an intuitive, robust, and responsive front-end interface for student and class registration is crucial to reduce administrative overhead during school setup. A clean, interactive manual registration form alongside a drag-and-drop batch importer enables school coordinators to register hundreds of students and setup their campus roster in minutes, empowering the school to begin psychosocial monitoring with minimal setup delay.

## Solution
We will implement the frontend controller logic inside `frontend/public/js/main.js` (or page-specific scripts) to fully integrate `cadastro_turma.html` and `cadastro_estudante.html` with our backend endpoints.
The manual forms will perform real-time client-side validations and submit payloads to `/api/turmas` and `/api/estudantes`. The "Importação em Lote" tabs will integrate an interactive drag-and-drop `drop-zone` that handles file validation, displays a progressive loading bar during file processing, and renders user-friendly summaries of the import results (e.g., total imported rows and specific skipped line numbers due to validation errors). The student registration page will dynamically query `/api/turmas` to populate its class selection dropdown list on load.

## User Stories
1. As a Coordenador Pedagógico, I want to fill in a manual form with a class name and select its shift (turno), so that I get instant validation and confirmation when a class is added.
2. As a Coordenador Pedagógico, I want to drag and drop a student roster spreadsheet (.csv) into a dropzone, so that I can see a progress bar indicating upload status and receive a detailed report of successful and failed rows.
3. As a Coordenador Pedagógico, I want the student registration page to list all my active classes in a dropdown, so that I can easily select the correct class for a new student.

## Implementation Decisions

### Page Integrations and State Management
We will write dedicated initialization scripts at the bottom of `frontend/public/cadastro_turma.html` and `frontend/public/cadastro_estudante.html` that bind event listeners to form controls. They will read the JWT authorization token from `localStorage` and include it in request headers.

### Manual Registration Forms
- **Class Form (`#form-cadastro-turma`)**:
  - Intercepts submit. Validates that `#nome-turma` is not empty and `#turno-turma` is selected.
  - Sends a `POST` request to `/api/turmas` with a JSON payload.
  - Displays a success toast or alert: `"Turma cadastrada com sucesso!"` on success and clears the form. On error, displays the backend's message.
- **Student Form (`#form-cadastro-estudante`)**:
  - Dynamically fetches `/api/turmas` on page load to populate `#turma-estudante` options. If no classes are registered, displays a warning: `"Aviso: Nenhuma turma cadastrada. Por favor, crie uma turma primeiro."` and redirects the user after 3 seconds.
  - Validates fields and sends a `POST` request to `/api/estudantes`.
  - Displays a success toast or alert: `"Estudante cadastrado com sucesso!"`.

### Batch Spreadsheet Importers
- **Drag-and-Drop Event Listeners**:
  - Binds `'dragover'`, `'dragleave'`, and `'drop'` events to `.drop-zone`.
  - Prevents default browser navigation. Adds and removes the visual class `.dragover` to change background borders dynamically on hover.
- **File Processing & Progress Bar**:
  - Validates that the dropped or selected file is under 5MB and matches `.csv` or `.xlsx` mime types. If invalid, displays: `"Erro: Formato de arquivo não suportado. Use apenas planilhas CSV ou Excel."`
  - When the user clicks the upload button, a `FormData` object is compiled. The script fires an asynchronous `POST` to `/api/estudantes/import` (or `/api/turmas/import`).
  - Animates `.progress-bar-container` and `.progress-bar-fill` to 100% using timed CSS transitions to mimic backend processing phases.
  - Displays an interactive summary: `"Importação concluída: 120 alunos cadastrados com sucesso. 1 registro ignorado devido a duplicidade."`

## Testing Decisions
We will write frontend integration and UI tests under `frontend/test/`:
- `frontend/test/test_cadastro_turma_ui.js`: Tests manual form submissions, checking that submitting empty fields triggers browser validation errors and blocks API requests.
- `frontend/test/test_cadastro_estudante_dropdown.js`: Mocks the `/api/turmas` response to verify that the select element is populated with class objects and handles empty lists gracefully.
- `frontend/test/test_dropzone_behavior.js`: Simulates drag, drop, and file-select events on the bulk import container, checking that the process button is correctly enabled/disabled based on file type validations.

## Out of Scope
- Backend database schema definitions, API routes, and CSV file parser code (covered in [todo/0004-student-class-management-backend.md](todo/0004-student-class-management-backend.md)).
- Client-side excel parsing or spreadsheet data cell editing.
- Integration of school calendars or student grade portals.

## Further Notes
Toast notifications and error messages are written in Portuguese to maintain user empathy and professional tone.
