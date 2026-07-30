# Implementation Plan: Registro Rápido de Observações

## Phase 1: Refatoração do Modal e Limites [checkpoint: pending]
- [ ] Task: Alterar a estrutura HTML do modal de registro (`student-modal` em `templates/dashboard.html`) para incluir os campos Aluno (estático/dinâmico) e Tipo de Comportamento (Dropdown obrigatório).
- [ ] Task: Remover o atributo `required` da descrição e adicionar `maxlength="500"`.
- [ ] Task: Implementar o contador de caracteres na interface para atualizar dinamicamente a contagem do texto digitado no textarea.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Refatoração do Modal e Limites'

## Phase 2: Validações, Timestamp e Toast [checkpoint: pending]
- [ ] Task: Ajustar a lógica JS de validação e submissão do formulário para verificar a obrigatoriedade do Tipo de Comportamento e permitir descrição em branco.
- [ ] Task: Garantir a captura automática do timestamp e injeção formatada do registro na timeline.
- [ ] Task: Disparar notificação Toast de sucesso clara após salvar e validar o fechamento do modal.
- [ ] Task: Realizar testes de acessibilidade e design de formulário responsivo no mobile.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Validações, Timestamp e Toast'
