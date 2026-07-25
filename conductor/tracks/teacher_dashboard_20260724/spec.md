# Specification: Teacher Behavioral Management Dashboard

## 1. Overview
Implement an interactive, high-fidelity frontend dashboard for teachers (Docentes) within the A.M.P.A.R.A. platform. In compliance with school staff RBAC (Role-Based Access Control), teachers cannot register classes or students; instead, their primary responsibility is monitoring student well-being and logging behavioral records. This track will modify the existing `/dashboard` to dynamically present a teacher-specific experience when a teacher account is simulated/accessed.

## 2. Functional Requirements
- **Role-Based Access (RBAC):**
  - The `/dashboard` view will adapt dynamically based on user profiles. For teachers (Docentes), it will hide the administrative user approvals table and present the Behavioral Management Panel.
  - Add a profile switcher or mock-toggle (e.g. "Simular Professor" vs "Simular Gestor") to let reviewers toggle experiences easily.
- **Teacher Landing View (Class Management):**
  - **Sidebar Navigation:** A sidebar listing all linked classes (e.g., 1º Ano A, 2º Ano B) for fast navigation.
  - **Class Cards Grid:** The main content area lists linked classes as Material-inspired cards with metrics (Total Students, Emotional Alerts).
- **Class Detail View (Student Grid):**
  - Clicking on a class opens its roster.
  - Displays a grid of individual Student Cards. Each card contains:
    - Student avatar, name, and registration number (Matrícula).
    - **Emotion Quick-Indicators:** Icon badges for emotional states: Ansiedade (Agitação), Tristeza (Apatia), Euforia, etc. (with active/inactive states for quick tagging).
    - **Action Button:** A button to write/view detailed observations.
- **Student Behavioral Record Popup (Modal):**
  - Opens dynamically upon clicking the student's action button.
  - **Form Fields:**
    - **Textual Input:** Large textarea for observations.
    - **Voice Input (STT Simulator):** A microphone button. When clicked, it simulates voice recording with visual feedback and inserts mock transcribed text (e.g., "Estudante demonstrou alta ansiedade durante a prova, mas acalmou-se após conversa") directly into the textarea.
    - **Severity Level Selector:** Low (Baixo), Medium (Médio), High (Alto) severity indicators.
    - **Date & Time Stamp:** Automatically logs and shows current date/time.
    - **Historical Logs (Timeline):** Displays a scrollable log of previous simulated behavioral entries for that student.

## 3. Non-Functional Requirements
- **Design & Layout:** Maintain total consistency with the A.M.P.A.R.A. design system (warm sand palette, card-based shadows).
- **Accessibility:** Keyboard accessibility for emotion badges, modal focus trapping, and clear ARIA descriptions for microphone simulations.

## 4. Acceptance Criteria
- [ ] Logged-in profile "Docente" hides administrative user table and displays teacher-specific tools.
- [ ] Teacher landing view displays linked classes in both a sidebar and a card grid.
- [ ] Clicking a class shows a grid of student cards with emoji-style emotion badges.
- [ ] Action buttons open a Modal containing severity toggles, current timestamp, text area, microphone STT simulation, and a scrollable timeline of historical logs.
- [ ] All forms validate client-side and trigger Toast alerts upon successful logging.

## 5. Out of Scope
- Server-side database persistence for individual student behavioral logs (simulated frontend storage/state only in this phase).
- Integrating actual hardware voice recording libraries (simulated STT interface only).