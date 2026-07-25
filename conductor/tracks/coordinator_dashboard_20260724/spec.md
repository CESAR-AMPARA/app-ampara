# Specification: Coordination & Management Dashboard

## 1. Overview
Enhance the existing **Gestor Escolar** (School Manager/Coordination) dashboard panel in A.M.P.A.R.A. to support full administrative oversight. While teachers deal with day-to-day classroom behavioral monitoring, the Coordination is responsible for school-wide administration, class/student search, approving/adding teachers, viewing student behavioral records, and registering serious coordination occurrences where direct coordination intervention was required.

## 2. Functional Requirements
- **Integrated Gestor Panel:** Extends the default `Gestor Escolar` view in `/dashboard`. It maintains the existing "Total de Profissionais" statistics and "Lista de Profissionais Cadastrados" (Teacher Approvals), but adds tab/section switching.
- **Three Management Tabs under Gestor Panel:**
  1. **Credenciamento (Teacher Management):** Existing teacher approvals table + a new **"Adicionar Professor"** manual form (popup or sub-panel) to quickly register a trusted educator.
  2. **Busca e Registros (Class & Student Search):**
     - **Turmas Grid & Search:** Grid of all classes with a real-time instant search input. Clicking a class reveals its student roster.
     - **Estudantes List & Search:** Search bar that instantly queries students across the school. Clicking a student reveals their historical behavioral timeline (logged by both teachers and previous coordination reports).
  3. **Ocorrências da Coordenação (Coordination Intervention Registry):**
     - Lists all serious school-level occurrences registered by coordination.
     - **"Registrar Ocorrência" button** opening a dedicated Popup Modal.
- **Coordination Occurrence Registry Popup (Modal):**
  - Fields:
    - **Target Selector:** Dropdown or toggle to select if it applies to a whole **Class (Turma)** or an individual **Student (Estudante)**.
    - **Occurrence Type:** Select dropdown (Conflito entre alunos, Indisciplina grave, Emergência médica, Apoio familiar, Saúde mental).
    - **Intervention Action Taken:** Text input of the immediate administrative action (e.g., "Chamou responsáveis legais", "Encaminhou ao psicólogo escolar", "Suspensão temporária").
    - **Detailed Description:** Text area detailing the event.
    - **Date & Time Stamp:** Automatic log of the report timestamp.
  - Successfully logged occurrences are added to a centralized timeline in the Ocorrências tab and appended to the respective Class or Student's historical records.

## 3. Non-Functional Requirements
- **Design Consistency:** Maintain the same warm sand palette (`#efe6d6`, `#3e5871`) and Material Design card shadow structure.
- **Accessibility:** Fully accessible keyboard navigation and modal focus trapping.

## 4. Acceptance Criteria
- [ ] Gestor Panel features tabs for "Credenciamento", "Busca e Registros", and "Ocorrências".
- [ ] Credenciamento tab lists pending professional registrations and has an "Adicionar Professor" button/modal.
- [ ] Busca e Registros tab allows real-time search of classes and students, with collapsible roster details and full behavior logs.
- [ ] Central Ocorrências tab lists registered incidents. "Registrar Ocorrência" opens a Modal that logs Type, Target, Action Taken, and Description, adding it to timelines with automatic timestamps upon submission and firing success Toasts.

## 5. Out of Scope
- Backend database persistence for coordination occurrences or newly added teachers (simulated client-side storage only).