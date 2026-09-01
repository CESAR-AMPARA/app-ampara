# Planejamento de Implementação Backend: Transição para Multi-Tenant e Novo Fluxo de Onboarding (A.M.P.A.R.A.)

Este documento serve como backlog de tarefas técnicas para a equipe de desenvolvimento backend. O objetivo é migrar a aplicação atual (baseada em um único banco de dados SQLite/PostgreSQL, com cadastro simples) para a arquitetura **Database-per-Tenant** e o novo fluxo de **Onboarding Multi-Etapas (com RBAC e LGPD)** definido em `contexto/login_and_registering.md`.

---

## 📌 Contexto Técnico Atual vs. Futuro

* **Atualmente (`app.py`, `models.py`):**
  * Banco de dados único e centralizado.
  * Cadastro em etapa única salvando diretamente na tabela local de usuários.
  * Login simples com autenticação local ou fallback em `credentials.json`.
  * Status do usuário controlado por um booleano simples `validado` (padrão `False`).

* **Futuro Planejado (Multi-Tenant & Multi-Etapas):**
  * **Banco Master (Global):** Centraliza o cadastro das escolas ativas e mapeia o e-mail de cada usuário à sua respectiva escola (`usuario_escola`).
  * **Banco Local (Por Escola):** Cada escola possui seu próprio banco de dados isolado com dados de alunos, turmas, diários e usuários (Docentes, Gestores, Saúde Mental).
  * **Cadastro Multi-Etapas:** Processo dividido em 4 fases no frontend que deve ser consolidado no backend com validações específicas para LGPD, sigilo, perfil e dados de registro.
  * **Autenticação com Roteamento Dinâmico:** O login resolve a escola do usuário no Banco Master, conecta dinamicamente ao banco correspondente, e valida as credenciais.

---

## 🗺️ Visão Geral da Arquitetura de Dados

```
                        [ Cliente / Frontend ]
                                  │
                                  ▼
                        [ API Flask (Backend) ]
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ Banco Master (Global) ]                       [ Bancos de Dados Local (Tenants) ]
 - Tabela: escolas                              - Banco Escola A (PostgreSQL / SQLite)
 - Tabela: usuario_escola                          - Tabela: usuarios (Locais)
   (Mapeamento email -> escola_id/db_url)          - Tabela: observacoes, turmas, etc.
                                                - Banco Escola B (PostgreSQL / SQLite)
```

---

## 📋 Backlog de Tasks Backend

### 🛠️ Fase 1: Infraestrutura e Camada de Dados (Multi-Tenant)

#### [ ] Task 1.1: Configuração e Migração do Banco de Dados Master/Global
* **Descrição:** Criar e configurar o banco de dados Master que armazenará os dados de roteamento global do sistema.
* **Requisitos Técnicos:**
  * Criar os modelos `Escola` e `UsuarioEscola` (Tabela de mapeamento).
    * `Escola`: `id` (PK), `nome` (String), `estado` (String), `municipio` (String), `db_url` (Text - criptografado ou seguro), `ativo` (Boolean).
    * `UsuarioEscola`: `email` (PK/String), `escola_id` (FK para Escola).
  * Criar um script de inicialização do Banco Master no Flask.
  * Configurar o Alembic (Flask-Migrate) para gerenciar o schema do banco Master separadamente dos bancos de cada tenant se necessário, ou garantir migrações limpas.
* **Critério de Aceite:**
  * O banco Master é provisionado com sucesso e armazena registros de escolas e mapeamentos de e-mail.
  * Testes unitários validam a inserção e consulta no banco Master.

#### [ ] Task 1.2: Implementação do Dynamic Database Router (Roteamento Dinâmico de Sessões)
* **Descrição:** Desenvolver o mecanismo que permite ao Flask-SQLAlchemy alternar dinamicamente a conexão do banco de dados com base na escola resolvida para o usuário logado ou em processo de cadastro.
* **Requisitos Técnicos:**
  * Criar um utilitário/gerenciador de conexão (ex: `TenantSessionManager`) que recebe um `db_url` e retorna ou vincula uma sessão do SQLAlchemy correspondente.
  * *Abordagem recomendada:* Utilizar o suporte do SQLAlchemy para `create_engine` dinâmico com cache de conexões para evitar sobrecarga de novas conexões a cada request.
  * Implementar tratamento seguro para fechamento de conexões inativas (Pool pooling) e controle de escopo (releasing da conexão no final de cada rota/request).
* **Critério de Aceite:**
  * Requisições consecutivas para escolas diferentes acessam e gravam em bancos físicos separados de forma isolada.
  * Zero vazamento de conexões entre tenants em ambientes concorrentes (testado com simulação de requests paralelos).

---

### 📝 Fase 2: Onboarding e Cadastro Multi-Etapas

#### [ ] Task 2.1: Endpoint para Listagem de Escolas (/api/escolas)
* **Descrição:** Criar rota pública para listar as escolas cadastradas e ativas a fim de alimentar a Etapa 1 do formulário de onboarding.
* **Requisitos Técnicos:**
  * Rota `GET /api/escolas` com filtros opcionais de `estado` e `municipio`.
  * Consulta exclusiva ao Banco Master.
  * Retorno em formato JSON amigável contendo apenas `id`, `nome`, `estado` e `municipio` (nunca expor `db_url` do banco no JSON público).
* **Critério de Aceite:**
  * Endpoint funcional e rápido.
  * Dados sensíveis de infraestrutura de banco de dados não são expostos.

#### [ ] Task 2.2: Refatoração do Endpoint de Cadastro (/api/cadastro)
* **Descrição:** Modificar o endpoint `POST /api/cadastro` para consolidar o fluxo de 4 etapas enviado pelo frontend de onboarding.
* **Requisitos Técnicos:**
  * O payload enviado deve conter todas as informações unificadas do formulário de onboarding:
    * **Etapa 1:** `escola_id`.
    * **Etapa 2 (Dados Pessoais):** `nome`, `email`, `telefone`, `perfil` (`docente` ou `multidisciplinar`).
    * **Etapa 3 (Vínculo):** `matricula`, `cargo`, `crp_cress` (obrigatório se perfil for `multidisciplinar`).
    * **Etapa 4 (Senha & LGPD):** `senha`, `aceite_lgpd` (Boolean - deve ser `True`), `aceite_sigilo` (Boolean - deve ser `True`).
  * **Lógica do Backend:**
    1. Validar unicidade do e-mail no Banco Master (tabela `usuario_escola`). Se já existir, retornar erro empático ("E-mail já cadastrado").
    2. Buscar o `db_url` da escola associada ao `escola_id` recebido no Banco Master.
    3. Abrir conexão temporária com o banco da respectiva escola.
    4. Validar se o e-mail também não existe no banco local daquela escola (prevenção de inconsistência).
    5. Gerar hash seguro da senha com `generate_password_hash`.
    6. Salvar o novo registro de usuário na tabela local da escola com `validado = False` (Status Pendente) e registrar os metadados de aceitação da LGPD e Termo de Sigilo (salvar data, hora e versão dos termos em novos campos na tabela `usuarios`).
    7. Em caso de sucesso, salvar a entrada de roteamento `email -> escola_id` na tabela global `usuario_escola` do Banco Master.
    8. Utilizar transações atômicas de duas fases ou bloco `try/except` para garantir consistência: se falhar ao salvar na escola local, não deve salvar no Master, e vice-versa.
* **Critério de Aceite:**
  * O cadastro cria corretamente o mapeamento no Master e o usuário pendente no banco específico da escola selecionada.
  * Validações de obrigatoriedade de campos específicos por perfil (ex: `crp_cress` para multidisciplinar) impedem cadastros inconsistentes.

---

### 🔑 Fase 3: Login, Autenticação e Controle de Acesso (RBAC)

#### [ ] Task 3.1: Refatoração do Endpoint de Login Multi-Tenant (/api/login)
* **Descrição:** Adequar a rota `POST /api/login` para localizar a base de dados do usuário antes de realizar a validação de credenciais.
* **Requisitos Técnicos:**
  * Fluxo de execução da rota:
    1. Recebe `email` e `senha`.
    2. Consulta o Banco Master para obter o `escola_id` e a URL de conexão (`db_url`) associados ao `email`.
    3. Se não encontrar o mapeamento, retornar mensagem genérica e empática: `"E-mail ou senha inválidos."` (proteção contra enumeração de usuários).
    4. Conectar ao banco de dados da escola correspondente.
    5. Buscar o registro do usuário na tabela local pelo `email`.
    6. Validar o hash da senha usando `check_password_hash`.
    7. Verificar o status da conta do usuário:
       - Se `validado == False` (Pendente): bloquear o login e retornar um JSON com status customizado (ex: `"status": "pendente_aprovacao"`) e mensagem de acolhimento legal explicativa, sem gerar token/sessão ativa.
       - Se `validado == True` (Ativo): inicializar a sessão do Flask ou gerar o JWT contendo dados do usuário e do tenant (`escola_id`, `perfil`, `nome`).
* **Critério de Aceite:**
  * Usuários pendentes são impedidos de fazer login e recebem feedback empático.
  * Usuários ativos logam com sucesso, apontando para sua respectiva escola.
  * Login falha com tratamento de erro correto em caso de senha incorreta ou e-mail inexistente.

#### [ ] Task 3.2: Middleware de Autorização e RBAC
* **Descrição:** Proteger as rotas de API do backend garantindo que os usuários acessem apenas recursos permitidos ao seu respectivo perfil (RBAC) e que pertençam à escola autenticada.
* **Requisitos Técnicos:**
  * Desenvolver decorators do Flask para controle de acesso:
    * `@login_required`: Garante que há uma sessão/JWT ativo.
    * `@roles_required(*perfis)`: Limita o acesso de rotas específicas a perfis (ex: apenas `gestao` pode acessar endpoints de aprovação).
  * Validar em cada requisição de escrita se o `escola_id` da rota ou do recurso pertence de fato ao tenant autenticado na sessão do usuário (prevenção contra vazamento de dados inter-tenant).
* **Critério de Aceite:**
  * Um usuário com perfil `docente` recebe `403 Forbidden` ao tentar acessar dados da gestão ou de saúde mental de outro perfil se aplicável.
  * Tentativas de acessar dados de outras escolas são bloqueadas e registradas em logs de segurança.

---

### 🏫 Fase 4: Painel da Gestão Escolar (Aprovações locais)

#### [ ] Task 4.1: Endpoint para Listagem de Solicitações Pendentes (/api/gestao/pendentes)
* **Descrição:** Criar endpoint exclusivo para o perfil `gestao` para obter a lista de profissionais daquela escola que realizaram cadastro e aguardam aprovação.
* **Requisitos Técnicos:**
  * Rota `GET /api/gestao/pendentes` protegida por autenticação e restrita a perfis de gestão.
  * Filtrar usuários locais onde `validado == False`.
  * Retornar dados cadastrais necessários para auditoria visual do gestor (Nome, E-mail, Telefone, Perfil, Matrícula, Cargo, CRP/CRESS se aplicável, Timestamp do Cadastro).
* **Critério de Aceite:**
  * O gestor visualiza apenas os usuários pendentes cadastrados para a sua escola.
  * Docentes ou outros perfis não conseguem acessar este endpoint.

#### [ ] Task 4.2: Endpoint de Aprovação/Rejeição de Cadastros
* **Descrição:** Implementar rotas para aprovar ou rejeitar uma solicitação de cadastro pendente.
* **Requisitos Técnicos:**
  * Rota `POST /api/gestao/usuarios/<id>/aprovar` -> Altera o status do usuário local para `validado = True`.
  * Rota `POST /api/gestao/usuarios/<id>/rejeitar` -> Exclui ou inativa o registro do usuário local e remove seu mapeamento de e-mail no Banco Master para liberar o e-mail para novas tentativas caso tenha sido um erro.
  * Ambas as rotas devem ser transacionais e registrar logs de quem executou a ação de aprovação/rejeição (auditoria).
* **Critério de Aceite:**
  * Após aprovação, o usuário consegue realizar login imediatamente.
  * Após rejeição, o usuário é removido e seu e-mail torna-se disponível para novo cadastro no futuro.

---

### 🚀 Fase 5: Provisionamento e Testes Automatizados

#### [ ] Task 5.1: Script CLI de Provisionamento de Nova Escola (Tenant Setup)
* **Descrição:** Criar um comando CLI integrado ao Flask para automatizar o provisionamento de novos bancos de dados de escolas e cadastro de seus respectivos gestores.
* **Requisitos Técnicos:**
  * Criar um comando do Flask CLI (ex: `flask tenant-provision`) que execute:
    1. Cadastro da nova escola no Banco Master (gera UUID ou ID sequencial).
    2. Criação física do banco de dados (no SQLite local cria um arquivo `.db` separado; no PostgreSQL executa a criação de uma nova base de dados ou schema isolado dependendo da estratégia de infra).
    3. Execução das migrações do Alembic correspondentes às tabelas locais (usuarios, turmas, alunos, diários) no novo banco provisionado.
    4. Criação da conta inicial do `Gestor Escolar` padrão para essa escola, definindo-o diretamente como `validado = True`.
* **Critério de Aceite:**
  * O script executa de ponta a ponta sem falhas manuais.
  * A nova escola é registrada no Master e seu banco de dados local é inicializado perfeitamente com todas as tabelas requeridas.

#### [ ] Task 5.2: Cobertura de Testes Unitários e de Integração Multi-Tenant
* **Descrição:** Garantir a cobertura e confiabilidade de todo o fluxo de dados multi-tenant através de testes automatizados com pytest.
* **Requisitos Técnicos:**
  * Desenvolver testes em um novo arquivo (ex: `test_multitenant_flow.py`).
  * Simular o Banco Master utilizando SQLite em memória e criar pelo menos 2 bancos locais de escolas simulados.
  * Testar os seguintes cenários:
    1. Cadastro de docente na Escola A (deve registrar no Master e gravar apenas na Escola A).
    2. Cadastro de profissional na Escola B (deve registrar no Master e gravar apenas na Escola B).
    3. Login do docente da Escola A (deve autenticar com sucesso).
    4. Tentativa de login do docente da Escola A usando banco ou contexto da Escola B (deve falhar).
    5. Tentativa de login de usuário pendente (deve retornar rejeição controlada).
    6. Gestor da Escola A aprovando docente local (deve alterar status para validado).
    7. Gestor da Escola A tentando aprovar docente da Escola B (deve falhar por falta de autorização de tenant).
  * Manter cobertura de testes do backend acima de 80%.
* **Critério de Aceite:**
  * Suite de testes passa integralmente (`pytest`).
  * Relatório de cobertura comprova cobertura adequada do novo código.

---

## 🔒 Requisitos de Segurança e LGPD

1. **Proteção contra Vazamento de Conexão:** O backend deve garantir isolamento absoluto nas sessões de banco de dados por requisição. Conexões dinâmicas nunca devem persistir entre requisições de usuários diferentes na mesma thread do servidor.
2. **Minimização de Dados de Login:** Em caso de credenciais inválidas, use mensagens padronizadas que não confirmem se o e-mail existe na base de dados global antes de validar a senha.
3. **Logs de LGPD/Consentimento:** É mandatório salvar na tabela local `usuarios` as colunas `aceite_termos_timestamp` (datetime), `aceite_termos_versao` (string) e `aceite_compromisso_sigilo` (boolean). Estes dados devem ser imutáveis após o cadastro inicial.
4. **Armazenamento de Senha:** Nunca altere o algoritmo padrão de hash. Mantenha o uso do `PBKDF2 com SHA256` provido pelo `werkzeug.security`.

---

## 🏁 Critérios de Pronto (Definition of Done - DoD) para cada Task

Para cada task ser considerada concluída, ela deve passar pelos seguintes portões de qualidade:
* [ ] O código-fonte está implementado de acordo com a especificação técnica descrita.
* [ ] Testes unitários foram criados/atualizados e estão passando sem falhas.
* [ ] A cobertura de código do novo módulo é de no mínimo 80%.
* [ ] O código segue as convenções e estilo definidos em `conductor/code_styleguides/python.md`.
* [ ] Revisão de segurança básica efetuada (sem segredos expostos, proteção contra SQLi/XSS e isolamento de tenant verificado).
* [ ] Alteração integrada com sucesso no ambiente Docker local de desenvolvimento.
