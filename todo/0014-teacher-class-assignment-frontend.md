# Teacher-Class Assignment Frontend

*Phase: MVP #1 (backbone). Story-map cards: "As a Teacher, I want to quickly record a behavioral observation about a student" (value 500, 3 points); "As a user, I want my data and the students' data to be handled according to the LGPD to guarantee full privacy" (value 800, 3 points).*

*This specification defines the coordinator's class-assignment screen and the teacher's scoped class list. Its backend counterpart is [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md), which pins the routes and payloads used here. It builds on the roster wiring of `0009` and lands after it.*

## Problem
The coordinator has no way to say which teacher teaches which class. The teacher panel's "Minhas Turmas" sidebar and the "Visão Geral de Turmas" cards are hardcoded to 1º Ano A, 1º Ano B, 2º Ano A, and 2º Ano B with fixed student counts and alert labels, and `0009` replaces them with every class of the school because no assignment exists. A teacher therefore browses students they do not teach, and the coordinator cannot see that a class has no teacher following it.

## Business Vision and Purposes
Teachers should open the panel and find exactly their classes, so that recording an observation takes seconds and never touches a student outside their care. The coordinator sets this up once per term in the place where they already manage classes.

## Solution
The coordinator's class registration page gains a list of the school's classes, where each class shows its assigned teachers and a "Professores" button that opens a dialog with the school's teachers as checkboxes. Saving replaces the class's teachers. Classes without any teacher are flagged. The teacher panel lists only the teacher's classes, with real student counts, and says so plainly when the teacher has no class yet.

## User Stories
1. As a Coordenador Pedagógico, I want to tick the teachers of each class in one dialog, so that I set up the term quickly.
2. As a Coordenador Pedagógico, I want classes without teachers to stand out, so that no class goes unfollowed.
3. As a Docente, I want my sidebar and class cards to show only my classes with their real student counts, so that I go straight to my students.
4. As a Docente without classes, I want to be told to ask the coordination, so that I do not think the system is broken.

## Implementation Decisions

### Where the coordinator assigns
The assignment lives in `cadastro_turma.html` rather than in the dashboard, because that page is where the coordinator creates classes. The page gains a third section below the manual and spreadsheet panels, "Turmas Cadastradas", a table loaded from `GET /api/turmas` (whose coordinator response now carries `docentes`) and reloaded after each manual registration or import. Each class row shows its name, shift, student count, and "Professores: Maria Silva, João Lima" or, when the list is empty, a warning badge "Sem professor vinculado".

The "Professores" button opens `#assign-teachers-modal`, which loads `GET /api/gestao/docentes` once per page load and renders a checkbox per teacher, pre-checked for the class's current teachers, with a filter field "Buscar professor" for schools with many teachers. Teachers with `status` other than `Ativo` are listed with the suffix "(acesso suspenso)" or "(aguardando aprovação)" so the coordinator can still assign them ahead of approval. "Salvar" sends `PUT /api/gestao/turmas/<id>/docentes` with the ticked ids, shows the backend's `mensagem` in a toast, closes the dialog, and refreshes the class list. The dialog follows the `#referral-triage-modal` pattern: `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape and backdrop close, focus return.

The class import panel's description gains the expected columns: "Colunas: nome, turno e, opcionalmente, docentes_emails (e-mails separados por ponto e vírgula)." The per-row errors the backend returns are already rendered by `#import-summary-turma`.

### Teacher panel
The sidebar buttons and class cards are generated from `GET /api/turmas`, which the backend now scopes to the teacher. Each card shows the class name and "{total_estudantes} estudantes matriculados". The alert line on the cards ("2 alertas emocionais ativos", "Comportamento estável") is removed here, not faked: it returns with real data in [0022](0022-risk-classification-alerts-frontend.md). When the list is empty, the grid shows "Você ainda não está vinculado a nenhuma turma. Peça à coordenação para vincular você às suas turmas." and the sidebar shows only "Formação & Capacitação".

The hardcoded `data-class="1a"` buttons, the four static `.class-select-card` blocks, and the `mockStudents` lookup by class key are deleted; class selection uses the numeric `turma.id`.

### Copies
Every change to the dashboard and to `cadastro_turma.html` is mirrored under `frontend/src/templates/`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
- `frontend/test/test_assign_teachers.js`: against `cadastro_turma.html` with `fetch` doubled; the "Turmas Cadastradas" table loads and reloads after a registration; teacher names and the "Sem professor vinculado" badge render from `docentes`; the dialog pre-checks current teachers, filters by name, labels non-active teachers, sends the ticked ids, and refreshes the list; Escape and focus return.
- `frontend/test/test_teacher_classes_panel.js`: through `dashboard_harness.js` as `docente`; sidebar and cards come from `GET /api/turmas`; the empty state; no hardcoded class keys remain in the markup.
- `frontend/test/test_cadastro_turma_ui.js` (existing): extended for the new help text.

## Out of Scope
- Backend routes and the scope policy, specified in [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md).
- Risk indicators on class cards, specified in [todo/0022-risk-classification-alerts-frontend.md](0022-risk-classification-alerts-frontend.md).
- Assigning classes from the team table of [todo/0012-access-management-frontend.md](0012-access-management-frontend.md).
