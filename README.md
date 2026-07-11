# A.M.P.A.R.A. — Apoio, Monitoramento Psicológico e Acolhimento Responsável ao Aluno

O **A.M.P.A.R.A.** é uma plataforma web projetada para apoiar, monitorar e garantir o acolhimento psicossocial de estudantes do Ensino Médio. A aplicação conecta docentes, equipes multidisciplinares (psicólogos, assistentes sociais e orientadores) e a gestão escolar em torno do bem-estar dos alunos, operando sob conformidade estrita com a LGPD (Lei Geral de Proteção de Dados) para o tratamento de dados sensíveis de saúde e comportamento escolar.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Python 3.11, Flask (com Flask-SQLAlchemy para persistência de dados).
- **Frontend:** HTML5 semântico, CSS3 moderno (design responsivo, acessível e com suporte a alto contraste/escala de fontes) e JavaScript Vanilla (sem dependências externas).
- **Servidor de Produção:** Gunicorn (WSGI HTTP Server).
- **Containerização:** Docker e Docker Compose.
- **CI/CD:** GitHub Actions (workflows para compilação automática de imagens e deploy contínuo para instâncias AWS EC2 via SSH).

---

## 📂 Estrutura de Diretórios

A estrutura de diretórios do projeto está organizada da seguinte forma:

```text
app-ampara/
├── app.py                     # Inicialização do Flask, definição de rotas e APIs
├── config.py                  # Configurações do Flask e do SQLAlchemy (Secret Key, DB, etc.)
├── models.py                  # Modelagem do banco de dados (ORM SQLAlchemy)
├── usuario.sql                # Script de definição de tabelas em SQL nativo
├── requirements.txt           # Dependências do ecossistema Python
├── Dockerfile                 # Dockerfile de produção baseado em Python (Gunicorn na porta 80)
├── docker-compose.yml         # Orquestração do container de produção
├── .github/
│   └── workflows/
│       ├── docker-image.yml   # CI - Validação de compilação da imagem Docker
│       └── deploy.yml         # CD - Deploy contínuo na AWS EC2 via SSH
├── templates/                 # Páginas HTML integradas ao Flask (com rotas reais)
│   ├── index.html             # Tela inicial (Lading Page)
│   ├── login.html             # Tela de autenticação institucional
│   ├── cadastro.html          # Onboarding em etapas (Wizard de cadastro)
│   └── dashboard.html         # Painel administrativo de aprovação de usuários (Novo)
├── static/                    # Ativos estáticos para o Flask
│   ├── styles.css             # Folha de estilos globais
│   └── main.js                # Lógica de comportamento e integração com a API
└── public/                    # Cópia estática alternativa para visualizações estáticas locais
    ├── index.html
    ├── login.html
    ├── cadastro.html
    ├── dashboard.html
    ├── css/
    └── js/
```

---

## 🔄 Integrações e Ajustes de Comunicação Realizados

Para assegurar que o backend e o frontend se comuniquem perfeitamente, realizamos os seguintes ajustes estruturais e correções:

1. **Correção Crítica no Startup (`app.py`):**
   - Corrigido um erro de inicialização do Flask onde a função de view para a rota `/login` estava duplicada com o nome de `cadastro`, gerando um conflito de endpoint. Agora, cada rota possui sua respectiva função (`login` e `cadastro`).
   - Corrigido o import de `Config`, que agora é carregado de forma correta a partir do arquivo centralizado de configurações `config.py` (`from config import Config`).

2. **Criação do Arquivo de Configuração (`config.py`):**
   - Criada a classe `Config` com tratamento dinâmico para variáveis de ambiente como `SECRET_KEY` e `DATABASE_URL`, garantindo portabilidade entre desenvolvimento e produção.

3. **Alinhamento de ID do Formulário de Login:**
   - No frontend original (`login.html`), o input de credenciais tinha o ID `ident`. No entanto, o JavaScript (`static/main.js`) buscava por `document.getElementById("email")` e o backend em Python esperava o campo JSON `email`.
   - Modificamos o campo no frontend para utilizar `id="email"` e `name="email"`, unificando a comunicação e eliminando os erros de JavaScript no envio do formulário.

4. **Correção das Rotas de Navegação:**
   - Substituímos todos os links de ancoragem estáticos (como `href="login.html"`, `href="cadastro.html"`) nos templates pelas rotas reais do Flask (`/login`, `/cadastro`, `/`). Isso garante o correto roteamento sem erros 404.

5. **Criação de Painel de Credenciamento Ativo (`dashboard.html`):**
   - Desenvolvemos a página administrativa `/dashboard` integrada com os endpoints reais do backend.
   - O painel exibe estatísticas em tempo real (Total de usuários, Pendentes de aprovação, Ativos) e consome os dados de `/api/usuarios`.
   - Inclui um botão interativo de **"Aprovar Cadastro"** que se comunica com o endpoint `/api/aprovar/<id>` do Flask, atualizando o status do profissional instantaneamente na tela sem a necessidade de recarregar a página e disparando feedbacks por meio de Toasts acessíveis.

6. **Evolução da Infraestrutura de Containers (Dockerfile):**
   - O `Dockerfile` original rodava um servidor Nginx básico servindo arquivos estáticos puramente mockados em `/public`.
   - Atualizamos o `Dockerfile` para utilizar uma imagem base de **Python 3.11-slim**, instalando todas as dependências do `requirements.txt` e configurando o **Gunicorn** como servidor WSGI de alta performance rodando na porta `80`.
   - Assim, a aplicação em produção roda de forma unificada e performática, permitindo que o Flask renderize as páginas dinamicamente e processe as APIs na mesma porta.

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- Python 3.11 ou superior instalado.

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/CESAR-AMPARA/app-ampara.git
   cd app-ampara
   ```

2. **Criar e Ativar o Ambiente Virtual (Virtualenv):**
   ```bash
   # Criar venv
   python3 -m venv venv

   # Ativar venv (Linux/macOS)
   source venv/bin/activate

   # Ativar venv (Windows)
   venv\Scripts\activate
   ```

3. **Instalar Dependências:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Executar a Aplicação:**
   ```bash
   python3 app.py
   ```
   Acesse a aplicação no navegador em [http://127.0.0.1:5000](http://127.0.0.1:5000).

*Nota: Ao rodar pela primeira vez, o Flask criará automaticamente um banco de dados SQLite local chamado `app.db` no diretório raiz do projeto e gerará as tabelas para que você possa testar cadastros, logins e a aprovação no dashboard imediatamente.*

---

## 🐳 Como Executar com Docker & Docker Compose

O projeto está totalmente containerizado e pronto para produção, amarrando o backend em Flask ao ambiente de produção.

### Rodando o Container:

1. Certifique-se de ter o Docker e o Docker Compose instalados em sua máquina.
2. Na raiz do projeto, execute o comando:
   ```bash
   docker compose up -d --build
   ```
3. O Docker criará a imagem baseada em Python, instalará as dependências e subirá o servidor Gunicorn mapeado na porta `80`.
4. Acesse a aplicação no seu navegador em [http://localhost](http://localhost).

## 🔄 Fluxo de CI/CD (GitHub Actions)

A esteira de integração e entrega contínua está configurada e dividida em dois fluxos principais:

1. **Docker Image CI (`docker-image.yml`):** Executado em cada push ou Pull Request para a branch `main`. Ele garante que as alterações de código não quebrem o empacotamento e compilação do container Docker.
2. **Deploy to EC2 via SSH (`deploy.yml`):** Executado automaticamente após pushes bem-sucedidos na branch `main`. O fluxo conecta-se à sua máquina virtual na AWS EC2 por meio de SSH, realiza o pull das atualizações mais recentes do repositório, reconstrói a imagem Docker e sobe o container atualizado de forma totalmente transparente e automatizada.
