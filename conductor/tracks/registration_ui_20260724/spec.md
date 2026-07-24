# Specification: Class and Student Registration Screens

## 1. Overview
Implement the frontend user interfaces for registering new Classes (Turmas) and Students (Estudantes) into the A.M.P.A.R.A. platform. This track will focus strictly on creating high-fidelity, interactive frontend prototypes using HTML/CSS/Vanilla JS, without backend API integration at this stage. The goal is to provide a seamless, simple experience for overwhelmed teachers, including bulk import capabilities to save time.

## 2. Functional Requirements
- **UI/UX Approach:** Given the need for simplicity and speed, we will use clean, straight-forward Single Page Forms (or simple, fast-loading Modals) that require minimal clicks.
- **Class Registration View:**
  - **Manual Entry:** Form with fields for Name / Code (e.g., 1º Ano A), Shift / Turno, and Coordinator.
  - **Bulk Import (Prototype):** A dedicated area or tab to upload a CSV/Excel file containing multiple classes, with a simulated progress/success indicator.
- **Student Registration View:**
  - **Manual Entry:** Form with fields for Full Name, Registration Number (Matrícula), and Class Assignment (Dropdown).
  - **Bulk Import (Prototype):** A dedicated area or tab to upload a CSV/Excel file containing a roster of students, with a simulated progress/success indicator.
- **Interactive Prototyping:**
  - Forms must include client-side validation.
  - Use asynchronous UI updates (Toast notifications) to simulate form submission and file upload success rapidly without page reloads.

## 3. Non-Functional Requirements
- **Design:** Follow the "Material Design Inspired" guidelines defined in the product guidelines (card-based layouts, subtle shadows).
- **Accessibility:** Ensure high contrast, keyboard navigation, and proper ARIA labels.

## 4. Acceptance Criteria
- [ ] Class registration UI (manual and bulk import) is complete, accessible, and interactive.
- [ ] Student registration UI (manual and bulk import) is complete, accessible, and interactive.
- [ ] Manual forms validate inputs client-side.
- [ ] Bulk import areas allow file selection and simulate processing.
- [ ] Both manual and bulk actions simulate success using Toast notifications.

## 5. Out of Scope
- Backend integration (Flask routes, SQLAlchemy models, actual CSV parsing logic on the server).