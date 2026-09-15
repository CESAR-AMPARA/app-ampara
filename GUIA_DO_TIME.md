# Fluxo de Desenvolvimento Guiado por IA: Guia do Time

Fala, meus (des)amparados! 

Proponho aqui um novo fluxo de desenvolvimento do nosso app, o A.M.P.A.R.A. 

Este documento serve como guia prático e conceitual para alinhar todo o time sobre a nossa abordagem de desenvolvimento auxiliado por Inteligência Artificial e as nossas rigorosas diretrizes de engenharia. Esta metodologia garante a máxima testabilidade do sistema, a segurança e soberania dos dados de saúde mental dos estudantes e a conformidade estrita com a LGPD.

---

## 1. O Papel da IA no Nosso Fluxo

A Inteligência Artificial atua como um copiloto sênior de engenharia na nossa base de código, já que nossa equipe visa seguir as novas tendências no âmbito de desenvolvimento de software. Para garantir que as interações com a IA sejam eficientes, seguras e livres de alucinações, estruturamos o repositório para que todas as regras de negócio, limites arquiteturais e decisões técnicas estejam perfeitamente documentados em locais previsíveis. A IA lerá este guia, as nossas ADRs e as especificações de tarefas para gerar código cirúrgico, limpo e testado, sem desviar das convenções acordadas.

---

## 2. Pilar 1: Architecture Decision Records (ADRs) no Diretório `adr/`

Nossas decisões de arquitetura e design não ficam implícitas no código nem se perdem em canais de comunicação. Elas são registradas de forma permanente no diretório `adr/` seguindo o padrão de Architecture Decision Records (ADRs).

* **Alto Critério de Relevância:** Escreva ou consulte uma ADR se a decisão for difícil de reverter, surpreendente para quem lê o código sem contexto, ou se for o resultado de uma escolha real entre caminhos técnicos viáveis (trade-off). Escolhas óbvias ou triviais não precisam de uma ADR.
* **Presente do Indicativo e Idioma:** Todas as ADRs são redigidas em inglês para alinhar-se perfeitamente com os nomes de símbolos, módulos e termos técnicos na nossa base de código. A primeira frase deve declarar a regra ativa hoje no presente do indicativo (exemplo: *"Domain services don't depend directly on third-party SDKs"*).
* **Custos e Consequências Explicicitados:** Toda ADR deve nomear o custo da decisão tomada na mesma medida em que exalta seus benefícios. Se uma decisão não possui pontos negativos descritos, ela é apenas publicidade e não análise de engenharia.
* **Documento Único e Atualizado:** Ao contrário de repositórios tradicionais que mantêm correntes de substituição históricas (ex: "ADR-0004 substitui ADR-0002"), nossa política dita que as decisões obsoletas devem ser editadas diretamente no arquivo original. O arquivo no disco reflete a arquitetura real do sistema hoje, enquanto o histórico de alterações fica sob responsabilidade do Git. Os números de ADRs excluídas ou obsoletas nunca são reciclados.

Consulte o arquivo `adr/README.md` para entender o template oficial e a lista das nossas decisões de infraestrutura e segredos em vigor.

---

## 3. Pilar 2: Especificações de Tarefas no Diretório `todo/`

O diretório `todo/` gerencia e documenta as funcionalidades e correções que ainda não foram implementadas no sistema. Ele atua como o nosso backlog técnico estruturado de alta precisão.

* **Ciclo de Vida de uma Spec:** Cada funcionalidade nasce como um arquivo de especificação `.md` no diretório `todo/`. Uma vez que o código correspondente é totalmente implementado, validado e os testes automatizados são escritos e aprovados, o arquivo de especificação no diretório `todo/` é **excluído**. Nossos testes automatizados são o registro definitivo do comportamento atual do sistema.
* **Regra de Ouro: Uma Spec Nunca é Fullstack:** Um arquivo de especificação cobre apenas a implementação do backend ou a implementação do frontend, nunca ambos. Como o desenvolvimento das duas frentes pode ser feito por pessoas ou em momentos diferentes, dividir as especificações evita que detalhes irrelevantes poluam a leitura do desenvolvedor. Se uma funcionalidade exige mudanças em ambas as pontas (como o fluxo multi-tenant de onboarding), ela será dividida em duas specs consecutivas (ex: `0002-...-backend.md` e `0003-...-frontend.md`). O contrato compartilhado de dados (como as rotas e payloads JSON) é especificado integralmente na spec de backend, e a spec de frontend apenas referencia e consome essa definição.
* **Numeração e o Arquivo `NEXT_SPEC`:** As especificações seguem uma numeração sequencial preenchida com zeros à esquerda (ex: `0002-nome-da-feature.md`). O próximo número disponível é controlado estritamente no arquivo `todo/NEXT_SPEC`. Toda vez que você criar uma especificação, atualize o valor deste arquivo no mesmo commit para evitar conflitos de numeração de ramificação (branch).
* **Estrutura Padrão:** As especificações devem seguir rigidamente as seções do template: `## Problem`, `## Business Vision and Purposes`, `## Solution`, `## User Stories`, `## Implementation Decisions`, `## Testing Decisions`, `## Out of Scope` e `## Further Notes`. Seções sem conteúdo devem ser removidas para evitar ruídos de leitura.

Para mais detalhes de como estruturar, nomear e versionar suas especificações de tarefas, leia `todo/README.md`.

---

## 4. Pilar 3: Desenvolvimento e Qualidade de Código (`backend/DEV_WORKFLOW.md`)

A nossa base de código do backend segue regras restritas de qualidade e governança para manter a integridade operacional e de dados. Qualquer alteração ou nova funcionalidade inserida deve cumprir os portões de qualidade (Quality Gates) listados em `backend/DEV_WORKFLOW.md`.

### A. Fluxo TDD (Test-Driven Development)
Desenvolvemos ativamente utilizando o ciclo clássico do TDD para garantir cobertura, design desacoplado e confiança de refatoração:
1. **Fase Vermelha (Red):** Escreva ou altere os testes correspondentes em `test/` para validar a nova funcionalidade. Os testes devem falhar.
2. **Fase Verde (Green):** Implemente a menor quantidade possível de código de produção dentro de `src/` apenas para fazer os testes passarem.
3. **Fase de Refatoração (Refactor):** Limpe duplicidades, refine nomes de variáveis e melhore a legibilidade. Certifique-se de que os testes continuam passando.

### B. Portões de Qualidade (Quality Gates) Estritos
Nenhum código é integrado à nossa branch principal se violar qualquer um dos seguintes critérios:
* **Mapeamento de Testes 1:1:** Cada módulo de produção em `src/` (excluindo os arquivos de inicialização `__init__.py`) DEVE ter um arquivo correspondente de testes em `test/`. O caminho das pastas deve ser "achatado" no nome do arquivo (exemplo: o arquivo `src/usuarios/auth.py` deve ter seus testes contidos estritamente em `test/test_usuarios_auth.py`).
* **Cobertura de Código >90%:** Mantemos nossa cobertura de testes de backend acima do patamar de 90%, monitorada e aplicada por meio das configurações de `fail_under` no arquivo `.coveragerc`.
* **Nota Máxima no Pylint (10/10):** Todos os códigos de produção e testes de backend devem obter score máximo de 10/10 na análise estática do Pylint. Comentários para suprimir avisos (`# pylint: disable`) são proibidos, exceto em cenários extremamente excepcionais com aprovação explícita e documentação detalhada da causa raiz.
* **Injeção de Dependências Dinâmica:** Alinhado com a `adr/0001`, nenhuma conexão com banco de dados ou chamadas externas de rede e SDKs são resolvidas em tempo de importação de módulos. Todas as dependências externas são injetadas dinamicamente via construtor (`__init__`) nos componentes. Isso garante isolamento perfeito e nos permite rodar toda a suíte de testes de forma determinística, veloz e offline no ambiente de desenvolvimento local.
* **Segurança de Credenciais:** Nunca utilize segredos, tokens ou senhas fixados no código (hardcoded) ou lidos diretamente de variáveis de ambiente genéricas. Toda resolução de credenciais segue a nossa política de segurança e arquivos de configuração restritos locais (como `credentials.json`), descrita na `adr/0003`.

### C. Regras Rígidas de Idioma
Nosso projeto adota uma divisão muito clara de idiomas para manter a base limpa e amigável para modelos de linguagem e engenheiros de software:
* **Inglês para Leitura de Desenvolvedores:** Escreva em inglês todos os nomes de classes, variáveis, funções, docstrings, comentários de código, mensagens de commits, testes, especificações de tarefas (`todo/`) e registros de decisões arquiteturais (`adr/`).
* **Português para interfaces externas:** Todas as strings de mensagens amigáveis de erro para os usuários, textos e cópias de telas (UI), e declarações estáticas dos prompts do sistema da IA (incluindo descrições de ferramentas e parâmetros expostos ao modelo) devem ser redigidos estritamente em português brasileiro.

### D. Uso Correto de Comentários e Docstrings
A documentação no código deve ser extremamente focada para evitar obsolescência precoce:
* **Docstrings são Contratos:** Use docstrings apenas para formalizar a assinatura técnica da função (o que ela faz em uma linha, seus argumentos em `Args:`, retornos em `Returns:` e exceções em `Raises:`). Nunca explique "porquês", decisões ou contextos de design em docstrings.
* **Comentários de Linha para "Trabalhos Sujos" e Invariantes locais:** Utilize comentários de linha (`#`) diretamente no código apenas para explicar comportamentos surpreendentes de APIs de terceiros, restrições locais de ordenação de chamadas, ou invariantes lógicas.
* **O "Porquê" Arquitetural pertence à ADR:** Discussões de trade-offs arquiteturais pertencem exclusivamente ao repositório de ADRs. Insira no máximo um comentário de uma linha apontando para a ADR correspondente se o trecho exigir justificativa arquitetural.

---

## 5. Como Iniciar uma Nova Atividade (Workflow Prático)

Para criar uma funcionalidade ou corrigir um bug na plataforma seguindo essa nova abordagem, siga estes passos sequenciais:

1. **Definição e Numeração:** Consulte o arquivo `todo/NEXT_SPEC` para identificar o próximo número livre. Crie sua especificação técnica correspondente no diretório `todo/` (ou crie duas especificações complementares separadas para backend e frontend). Lembre-se de incrementar e salvar o número em `todo/NEXT_SPEC`.
2. **Desenvolvimento com IA:** Apresente a especificação da tarefa e a ADR de contexto à IA. Ela lerá os arquivos e iniciará o ciclo de desenvolvimento em conformidade estrita com o nosso workflow.
3. **Execução do Ciclo TDD:** Escreva os testes unitários correspondentes sob `test/test_...` de forma que o caminho do arquivo de produção seja achatado no nome. Certifique-se de que os testes falham primeiro antes de escrever a lógica de produção correspondente.
4. **Verificação de Portões de Qualidade:**
   * Execute sua suíte de testes locais utilizando o utilitário de cobertura de código do projeto.
   * Rode o relatório de cobertura para certificar-se de que está acima de 90% (`coverage report -m`).
   * Valide a análise estática executando o linter do projeto (`pylint src/ test/ main.py`) e garanta o score perfeito de 10/10.
5. **Finalização e Integração:** Ao concluir o desenvolvimento e validar todos os portões de qualidade de backend e frontend com sucesso, **remova o arquivo de especificação correspondente do diretório `todo/`**. Crie seu Pull Request contendo as modificações cirúrgicas de código de produção, seus novos testes de verificação e as atualizações de ADRs se houverem. Os testes automatizados passam a ser os guardiões e a documentação permanente do comportamento da funcionalidade criada!

Seguindo esse fluxo consistente, mantemos a codebase do app robusta, documentada e amigável para o desenvolvimento contínuo com IA de forma rápida e segura.
