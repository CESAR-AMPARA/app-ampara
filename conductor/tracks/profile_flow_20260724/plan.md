# Implementation Plan: Profile Flow Correction & Credentials-Based RBAC

## Phase 1: JSON Credentials, Flask Login Integration & Cache Reset [checkpoint: 4baa290]
- [x] Task: Create `credentials.json` in the root folder with mock Teacher and Coordinator email, password, and profiles. 4baa290
- [x] Task: Update the `/api/login` POST route in `app.py` to load and check credentials against `credentials.json` as a primary check, falling back to database check on mismatch. 4baa290
- [x] Task: Update `static/main.js` and `public/js/main.js` to clear `sessionStorage` on login page load, and save successful login responses to `sessionStorage` as `usuarioLogado`. 4baa290
- [x] Task: Conductor - User Manual Verification 'Phase 1: JSON Credentials, Flask Login Integration & Cache Reset' (Protocol in workflow.md) 4baa290

## Phase 2: Dynamic Dashboard RBAC Hiding & Logout Cache Clear
- [x] Task: Update `templates/dashboard.html` and `public/dashboard.html` to read `usuarioLogado` from `sessionStorage` on DOM load. 4baa290
- [x] Task: Implement dynamic layout adjustments: If the logged-in user's profile is only `docente` (Teacher), hide the RBAC Switcher completely, directly show `#panel-docente`, and change the dashboard title. 4baa290
- [x] Task: Program the "Sair" (Logout) button on both dashboard views to clear `sessionStorage` before redirecting to ensure a clean session reset. 4baa290
- [~] Task: Conductor - User Manual Verification 'Phase 2: Dynamic Dashboard RBAC Hiding & Logout Cache Clear' (Protocol in workflow.md)