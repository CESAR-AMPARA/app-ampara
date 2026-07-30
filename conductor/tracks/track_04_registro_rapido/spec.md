# Specification: Registro Rápido de Observações (User Story 4)

## 1. Overview
O preenchimento de observações pelos professores em sala de aula precisa ser extremamente rápido e intuitivo para não atrapalhar a dinâmica letiva. Para isso, o formulário de registro (modal) deve ter regras de validação claras: focar no Aluno e no Tipo de Comportamento como as únicas informações obrigatórias, permitir que a descrição textual detalhada seja opcional, e limitar essa descrição a 500 caracteres para manter os relatos concisos e focados.

## 2. Functional Requirements
- **Campos Obrigatórios do Formulário:**
  - **Aluno:** Campo obrigatório. Deve exibir o nome do estudante alvo do registro (como um campo de texto de leitura, ou dropdown se aberto livremente).
  - **Tipo de Comportamento:** Campo de seleção obrigatório (dropdown ou seletor de botões de sentimento reestilizado), com opções como: *Ansiedade*, *Tristeza*, *Agitação*, *Apatia*, *Euforia*, *Outro*.
- **Descrição Opcional:**
  - O campo de texto para descrição detalhada (`behavior-description`) deve deixar de ser obrigatório (remover atributo `required` e o asterisco de campo obrigatório).
  - O usuário deve conseguir salvar o registro com sucesso mesmo se deixar a descrição em branco.
- **Limite de Caracteres da Descrição:**
  - Limitar o comprimento máximo do campo de descrição a **500 caracteres** (usando atributo `maxlength="500"` no textarea).
  - Adicionar um contador dinâmico de caracteres restantes visível na tela (ex: `"450 / 500 caracteres restantes"` ou `"50 caracteres restantes"`), que atualiza à medida que o usuário digita.
- **Data e Hora Automáticas:**
  - O sistema deve registrar de forma automática a data e hora exatas do envio do formulário, integrando esse carimbo de data/hora ao log inserido na timeline.
- **Mensagem de Sucesso (Toast):**
  - Ao salvar o registro, exibir uma notificação do tipo *Toast* amigável e legível com uma mensagem de sucesso clara (ex: `"Registro de comportamento salvo com sucesso!"`).

## 3. Non-Functional Requirements
- **Foco de Acessibilidade:** Tratamento adequado dos campos do formulário para leitores de tela (rótulos explícitos e aria-required). O modal deve prender o foco do teclado enquanto estiver aberto e retornar ao elemento de origem quando fechado.
- **Prevenção de Erros:** Exibir mensagens de validação visual caso o usuário tente submeter sem preencher o Tipo de Comportamento.

## 4. Acceptance Criteria
- [ ] O formulário contém os campos Aluno e Tipo de Comportamento marcados e validados como obrigatórios.
- [ ] A descrição detalhada é opcional e não impede o salvamento quando vazia.
- [ ] A descrição possui limite rígido de 500 caracteres e exibe um contador dinâmico de caracteres.
- [ ] O sistema registra automaticamente a data e hora do salvamento.
- [ ] É exibido um Toast com mensagem de sucesso ao salvar.
