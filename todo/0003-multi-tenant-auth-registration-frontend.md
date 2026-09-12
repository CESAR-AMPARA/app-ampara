# Multi-Tenant Authentication and Onboarding Frontend

*This specification defines the frontend implementation of the multi-step user onboarding wizard, multi-tenant login forms, and role-based dashboard routing, which is paired with the backend specification in [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md).*

## Problem
Currently, educators and mental health professionals who access App A.M.P.A.R.A. do not have a visual interface to select their educational institution during onboarding, nor can they complete their profile details, specify their role, or explicitly review and accept the mandatory legal privacy and secrecy agreements (LGPD). This lack of guided onboarding causes extreme friction, increases user registration errors, fails to collect required professional credentials, and puts the application in breach of legal and compliance requirements by not obtaining verified user consent before accessing sensitive behavioral records.

## Business Vision and Purposes
To deliver an onboarding experience that builds trust and complies with legal standards, the frontend must guide new users through a clear, intuitive 4-step registration wizard. This wizard must clearly separate personal data from professional credentials, enforce explicit consent for data privacy (LGPD) and secrecy obligations, and communicate the manual approval process empathetically. It must also route active users to their respective workspace dashboards seamlessly while managing the "Pendente" wait state gracefully.

## Solution
We will implement an interactive multi-step onboarding wizard in `frontend/public/cadastro.html` (managed by `frontend/public/js/main.js`) and update the login page `frontend/public/login.html` to support the multi-tenant routing, multi-factor authentication (MFA) input, and status checking. The onboarding wizard will split the signup process into four sequential steps: Step 1 ("Selecione sua Instituição") dynamically loads active schools from the backend; Step 2 ("Dados Pessoais") collects name, email, and phone; Step 3 ("Vínculo Institucional") requests the user's profile role, matriculation, and CRP/CRESS registration if applicable; Step 4 ("Termos e Segurança") secures the account with a password and requires checking the LGPD and secrecy compliance checkboxes. The login interface will handle dynamic redirection based on whether MFA is required, and will display a friendly "Conta em Análise" screen if the user's account is still pending manager approval.

## User Stories
1. As a new educator or psychologist, I want to be guided through a 4-step signup form, so that I can easily register under my school without feeling overwhelmed by long forms.
2. As a registering professional, I want to see and accept the explicit LGPD terms and absolute secrecy commitments in Step 4, so that I understand my legal obligations before submitting my credentials.
3. As a pending user, I want to see a friendly "Conta em Análise" message after registering and during login attempts, so that I know my account is being reviewed and will be activated soon.
4. As an active user, I want to log in, complete the MFA verification if prompted, and be redirected directly to my specific dashboard based on my profile (Docente or Equipe Multidisciplinar), so that I can immediately start my daily work.

## Implementation Decisions

### Step-by-Step Onboarding Wizard
The file `frontend/public/cadastro.html` will be refactored to house a 4-step wizard container. Navigation between steps will be governed by local JavaScript validation in `frontend/public/js/main.js`. Step elements will be shown/hidden using the `.hidden` utility class via Vanilla CSS in `frontend/public/css/styles.css`.
- **Step 1: Selecione sua Instituição**: A dropdown list populated by making a `GET` request to `/api/schools`. The user must select an active school to proceed.
- **Step 2: Dados Pessoais**: Input fields for Full Name (`nome`), Email (`email`), and Phone (`telefone`). Form validation will enforce proper e-mail formats and telephone masking in Portuguese.
- **Step 3: Vínculo Institucional**: Selection between two profiles: `"Docente"` and `"Equipe Multidisciplinar"`. Form fields dynamically adjust: both profiles require matriculation (`matricula`) and job title (`cargo`), but only `"Equipe Multidisciplinar"` displays an optional professional registration input field (`registro_profissional` for CRP/CRESS).
- **Step 4: Termos e Segurança**: Password and password confirmation inputs, followed by two mandatory, un-checked checkboxes:
  - Checkbox 1: `"Aceito os termos da LGPD e autorizo o tratamento de meus dados profissionais para fins de cadastro no App A.M.P.A.R.A."`
  - Checkbox 2: `"Comprometo-me a manter o sigilo absoluto sobre todas as informações de saúde mental e comportamento dos estudantes acessadas nesta plataforma."`

### Login Flow and Status States
The login script in `frontend/public/js/main.js` (associated with `frontend/public/login.html`) will send credentials to `/api/login`.
- **MFA State**: If the backend response contains `"mfa_required": true`, the login script hides the standard credentials form, slides in a 6-digit MFA verification code input container, and stores the temporary `session_token` in memory. Upon entering the code, it sends a `POST` request to `/api/login/mfa-verify`.
- **Pending Status State**: If the backend returns `"status": "pendente"` during registration or login, the user is redirected to a static "under review" status page `frontend/public/conta_pendente.html` which displays the friendly copy: `"Sua conta está em análise pela gestão escolar. Você receberá uma notificação quando seu acesso for liberado."`
- **Dashboard Redirection (RBAC)**: Upon a successful login with an `"ativo"` status, the user's JWT token is saved to `localStorage`, and the user is redirected based on their profile:
  - `gestor_escolar` -> `frontend/public/dashboard_gestao.html`
  - `docente` -> `frontend/public/dashboard.html` (existing Teacher Panel)
  - `equipe_multidisciplinar` -> `frontend/public/dashboard_saude.html`

### UI/UX & Styling
The styling of the registration wizard, forms, and status pages will strictly adhere to the AMPARA visual palette defined in the project's styling guidelines:
- Background: Soft Cream (`#F2E8DA`)
- Primary Elements: Muted Slate Blue (`#48637A`)
- Secondary Accents: Mint Sage (`#DCEBE4` / `#A7C5BA`)
- Dark Charcoal Text: (`#2F3338`)
- Alert/Attention: Soft Lavender (`#DCCFE1`)
- Layout: Spacing will follow a strict grid layout, and form steps will feature a progress bar at the top (e.g., "Passo 1 de 4") to give users instant visual orientation. All CSS rules will be added surgically to `frontend/public/css/styles.css` using Vanilla CSS, avoiding TailwindCSS as per local conventions.

## Testing Decisions
- `frontend/test/test_cadastro_wizard.js`: Uses a browser automation or mock-DOM setup to verify that step transitions occur only when current step inputs are valid, and that clicking "Próximo" without valid data triggers user-friendly validation tooltips.
- `frontend/test/test_login_routing.js`: Verifies that localStorage correctly stores the returned JWT token on successful authentication, and that the router redirects to the appropriate profile dashboard based on the RBAC claims in the backend response.

## Out of Scope
- Backend database schema definitions, API router setups, and Master database connection pooling (fully specified in the backend specification at [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md)).
- Dynamic email notification generation for account approval.
- Styling or layout of the Admin AMPARA (Super Admin) portal.

## Further Notes
If integration with the federal Single Sign-On (SSO) service (Gov.br) is added in a future phase, it will be placed as a single action button on the login screen, bypassing steps 1 through 3 and jumping directly to the profile confirmation and LGPD acceptance screen.
