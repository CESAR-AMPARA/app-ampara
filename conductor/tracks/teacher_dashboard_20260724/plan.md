# Implementation Plan: Teacher Behavioral Management Dashboard

## Phase 1: Teacher Dashboard Layout & RBAC Switcher
- [x] Task: Update `/dashboard` and `templates/dashboard.html` to support Role-Based Access (RBAC) and implement a visual user-role switcher (Gestor vs Docente) at the top of the dashboard for easy preview. 7cc0843
- [x] Task: Create the Teacher Landing View layout within `/dashboard` featuring the Class Sidebar Navigation and the Class Cards Grid. 7cc0843
- [x] Task: Implement the Class Detail View showing the roster grid of Student Cards, each complete with emotive icon badges (Ansiedade, Tristeza, Agitação, Apatia, Euforia). 7cc0843
- [~] Task: Conductor - User Manual Verification 'Phase 1: Teacher Dashboard Layout & RBAC Switcher' (Protocol in workflow.md)

## Phase 2: Behavioral Popup Modal, Voice STT & Interactivity
- [ ] Task: Build the Student Behavioral Popup Modal containing student details, automatic timestamp, and severity selectors (Low, Medium, High).
- [ ] Task: Implement the scrollable Historical Logs (Timeline) component inside the popup showing previous behavioral logs.
- [ ] Task: Code the interactive Voice Input (STT) simulator with a microphone button, animating recording waveforms/indicator, and inserting mock transcribed text into the observation textarea.
- [ ] Task: Bind form submissions to trigger state updates (adding the log to the timeline, updating the active emotions on student card) and Toast success feedback.
- [ ] Task: Perform an accessibility check ensuring keyboard navigation, modal focus trap, and ARIA labels.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Behavioral Popup Modal, Voice STT & Interactivity' (Protocol in workflow.md)