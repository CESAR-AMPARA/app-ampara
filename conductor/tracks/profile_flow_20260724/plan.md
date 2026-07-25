# Implementation Plan: Profile Flow Correction & Credentials-Based RBAC

## Phase 1: JSON Credentials, Flask Login Integration & Cache Reset
- [ ] Task: Create `credentials.json` in the root folder with mock Teacher and Coordinator email, password, and profiles.
- [ ] Task: Update the `/api/login` POST route in `app.py` to load and check credentials against `credentials.json` as a primary check, falling back to database check on mismatch.
- [ ] Task: Update `static/main.js` and `public/js/main.js` to clear `sessionStorage` on login page load, and save successful login responses to `sessionStorage` as `usuarioLogado`.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: JSON Credentials, Flask Login Integration & Cache Reset' (Protocol in workflow.md)

## Phase 2: Dynamic Dashboard RBAC Hiding & Logout Cache Clear
- [ ] Task: Update `templates/dashboard.html` and `public/dashboard.html` to read `usuarioLogado` from `sessionStorage` on DOM load.
- [ ] Task: Implement dynamic layout adjustments: If the logged-in user's profile is only `docente` (Teacher), hide the RBAC Switcher completely, directly show `#panel-docente`, and change the dashboard title.
- [ ] Task: Program the "Sair" (Logout) button on both dashboard views to clear `sessionStorage` before redirecting to ensure a clean session reset.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Dynamic Dashboard RBAC Hiding & Logout Cache Clear' (Protocol in workflow.md)