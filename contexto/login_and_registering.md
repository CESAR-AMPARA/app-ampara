# Fluxo de Cadastro e Login (App A.M.P.A.R.A.)

```mermaid
flowchart TD
    %% Definição de Estilos e Cores baseados na Paleta AMPARA
    classDef bgStyle fill:#F2E8DA,stroke:#48637A,stroke-width:2px,color:#2F3338;
    classDef primaryBtn fill:#48637A,stroke:#2F3338,stroke-width:1px,color:#FFFFFF;
    classDef secBtn fill:#DCEBE4,stroke:#A7C5BA,stroke-width:2px,color:#2F3338;
    classDef alertStyle fill:#DCCFE1,stroke:#48637A,stroke-width:2px,color:#2F3338;
    classDef successStyle fill:#A7C5BA,stroke:#48637A,stroke-width:2px,color:#FFFFFF;

    A([Início: Acesso ao App A.M.P.A.R.A.]) --> B{Possui Cadastro?}

    %% FLUXO DE LOGIN
    B -- Sim --> C[Tela de Login]
    C --> E[Informar E-mail e Senha]

    %% Etapa invisível para o usuário, mas vital para a restrição de BDs separados
    E --> DB_ROUTE[[Backend: Roteamento para o BD da Escola]]
    DB_ROUTE --> G{Validação de Credenciais}

    G -- Inválido --> H[Exibir Erro Empático + Opção 'Esqueci Senha']
    H --> C

    G -- Válido --> I{MFA Ativado / Exigido?}
    I -- Sim --> J[Solicitar Código de Verificação SMS / E-mail]
    J --> K{Código Correto?}
    K -- Não --> J
    K -- Sim --> L[Verificar Status da Conta]
    I -- Não --> L

    %% FLUXO DE CADASTRO (ONBOARDING DOCENTE/MULTI)
    B -- Não --> M1[Tela de Cadastro - Etapa 1: Selecionar Instituição/Escola]
    M1 --> M[Tela de Cadastro - Etapa 2: Dados Pessoais]
    M --> N[Selecionar Perfil: Docente / Multidisciplinar]
    N --> O[Tela de Cadastro - Etapa 3: Vínculo Institucional]
    O --> P[Informar Matrícula, Cargo e Registro CRP/CRESS se houver]
    P --> Q[Tela de Cadastro - Etapa 4: Senha e LGPD]
    Q --> R{Aceitou Termos LGPD e Compromisso de Sigilo?}

    R -- Não --> S[Bloquear Cadastro / Exibir Explicação Legal]
    S --> Q

    R -- Sim --> T[Salvar no BD da Escola Selecionada]
    T --> U([Estado: Conta em Análise pela Gestão Escolar])

    %% ROTEAMENTO POR PERFIL (RBAC)
    L -- Conta Pendente --> U
    L -- Conta Ativa --> V{Qual o Perfil do Usuário?}

    %% Perfis do App
    V -- Admin AMPARA --> Z[Painel Super Admin: Gerir Escolas e Provisionar BDs]
    V -- Gestão Escolar --> Y[Painel Gerencial: Aprovar Cadastros, Indicadores e Relatórios]
    V -- Docente --> W[Painel do Professor: Registro de Comportamento e Faltas]
    V -- Equipe Multidisciplinar --> X[Painel de Saúde Mental: Triagem IA e Encaminhamentos]

    %% Atribuição das Classes de Estilo
    class A,U,DB_ROUTE bgStyle;
    class C,M1,M,N,O,P,Q primaryBtn;
    class E,J,T secBtn;
    class H,S alertStyle;
    class W,X,Y,Z successStyle;

```

---

### Notas de Implementação Técnica

1. **Arquitetura de Banco de Dados (Database-per-Tenant)**
* Como cada escola terá um banco de dados separado, você precisará de um **Banco de Dados "Master" (Global)**.
* **No Login:** Quando o usuário digita o e-mail, o backend deve bater nesse Banco Master para descobrir a qual escola aquele e-mail pertence (tabela de mapeamento `usuario_escola: email -> tenant_id/db_url`). Só então a senha é validada no banco de dados específico daquela escola.
* **No Cadastro:** A "Etapa 1: Selecionar Instituição/Escola" consulta o Banco Master para listar as escolas ativas. Quando o usuário finaliza o cadastro, os dados vão para o banco de dados da escola escolhida.


2. **Criação de Contas e Hierarquia (RBAC)**
* **Admin AMPARA (Super Admin):** Perfil criado via infraestrutura (não tem tela de cadastro no app). Tem acesso a um painel onde clica em "Nova Escola", o que dispara o script de provisionamento de um novo banco de dados. Em seguida, ele cria a conta do **Gestor Escolar** para aquela escola.
* **Gestão Escolar:** Recebe o acesso do Admin AMPARA. Faz login no app e seu painel principal (além dos relatórios) terá uma área de "Pendentes de Aprovação", onde caem os cadastros feitos pelos professores e psicólogos/assistentes sociais da sua escola.
* **Docente e Multidisciplinar:** São os únicos perfis que passam pelo fluxo de *Cadastro (Onboarding)* descrito no diagrama. Eles nunca nascem com a conta "Ativa", sempre caem no status "Pendente" aguardando o aceite do Gestor daquela escola específica.


3. **Remoção do Gov.br**
* O fluxo de autenticação via SSO (Secretarias/Gov) foi removido do escopo inicial para reduzir complexidade, focando na validação e aprovação manual in-app via Gestão Escolar. Pode ser reintroduzido futuramente plugado ao nó "C" (Tela de Login).
