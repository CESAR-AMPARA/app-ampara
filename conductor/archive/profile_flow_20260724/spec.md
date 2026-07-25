# Specification: Login-Based RBAC and Profile Flow Correction

## 1. Overview
Currently, the `/dashboard` contains an RBAC Switcher at the top that allows anyone to toggle between the Gestor (Coordinator) and Docente (Teacher) profiles. This spec corrects this flow:
- Teachers (Docentes) registered ONLY as teachers must be locked to the Teacher Behavioral Dashboard and must NOT see or be able to use the RBAC Switcher.
- Coordenadores (Gestores) must land on the Credenciamento dashboard and have full access to switch profiles (or keep it if they contain coordinator options).
- We will clear current storage caches on login and logout.
- A new file `credentials.json` will be created with simulation credentials. The login page will dynamically validate entered credentials against this JSON via Flask and return the user profile. The frontend will persist this profile in `sessionStorage` to govern dashboard rendering.

## 2. Functional Requirements
- **JSON Credentials Database (`credentials.json`):**
  - Create a central `credentials.json` file in the root directory.
  - Define two mock profiles:
    1. **Professor (Teacher):**
       - Email: `professor@ampara.gov.br`
       - Password: `senha123`
       - Profile Role: `docente`
    2. **Coordenador (Gestor):**
       - Email: `coordenador@ampara.gov.br`
       - Password: `senha123`
       - Profile Role: `gestao`
- **Flask Login API (`/api/login` in `app.py`):**
  - Load `credentials.json` and validate incoming email/password against it.
  - If matched, return:
    ```json
    {
      "sucesso": true,
      "usuario": {
        "nome": "...",
        "email": "...",
        "perfil": "docente" // or "gestao"
      }
    }
    ```
  - Fall back to the SQL database lookup if not matched in `credentials.json` for backward compatibility.
- **Login Page (`login.html` & `static/main.js`):**
  - Clear `sessionStorage` and `localStorage` on page load to reset current cache.
  - On login success, store the user object:
    `sessionStorage.setItem("usuarioLogado", JSON.stringify(resultado.usuario));`
- **Dashboard (`dashboard.html`):**
  - Read `usuarioLogado` from `sessionStorage` on DOM load.
  - **If Teacher (`docente`):**
    - Hide the RBAC simulation switcher completely.
    - Directly display the Teacher Behavioral panel (`#panel-docente`) and hide Gestor panel (`#panel-gestor`).
    - Change header title to "Acompanhamento Comportamental".
  - **If Coordinator (`gestao`):**
    - Show the RBAC switcher.
    - Default view is Gestor Panel (`#panel-gestor`), with the switcher active.
- **Logout ("Sair"):**
  - Clear `sessionStorage` on click before redirecting to `/` or `/login`.

## 3. Non-Functional Requirements
- **Simplicity:** High-fidelity simulation on both static preview (`public/`) and live Flask server.
- **Failsafe:** Direct URL typing without login defaults to Gestor Escolar to allow review but warns the user.

## 4. Acceptance Criteria
- [ ] Central `credentials.json` contains specified Professor and Coordenador accounts.
- [ ] Logging in as `professor@ampara.gov.br` redirects to the dashboard, hides the RBAC switcher, and locks the view to Teacher behavioral tools.
- [ ] Logging in as `coordenador@ampara.gov.br` redirects to the dashboard, shows the RBAC switcher, and defaults to Gestor tools.
- [ ] Cache is completely cleared on Login and Logout.

## 5. Out of Scope
- Actually registering new users from the onboarding wizard into `credentials.json` (saved to local database only as normal).