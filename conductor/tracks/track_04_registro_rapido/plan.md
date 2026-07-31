# Implementation Plan: Registro Rápido de Observações

## Phase 1: Refatoração do Modal e Limites [checkpoint: 6db7f80]
- [x] Task: Alterar a estrutura HTML do modal de registro (`student-modal` em `templates/dashboard.html`) para incluir os campos Aluno (estático/dinâmico) e Tipo de Comportamento (Dropdown obrigatório). 6db7f80
- [x] Task: Remover o atributo `required` da descrição e adicionar `maxlength="500"`. 6db7f80
- [x] Task: Implementar o contador de caracteres na interface para atualizar dinamicamente a contagem do texto digitado no textarea. 6db7f80
- [x] Task: Conductor - User Manual Verification 'Phase 1: Refatoração do Modal e Limites' 6db7f80

## Phase 2: Validações, Timestamp e Toast [checkpoint: 6db7f80]
- [x] Task: Ajustar a lógica JS de validação e submissão do formulário para verificar a obrigatoriedade do Tipo de Comportamento e permitir descrição em branco. 6db7f80
- [x] Task: Garantir a captura automática do timestamp e injeção formatada do registro na timeline. 6db7f80
- [x] Task: Disparar notificação Toast de sucesso clara após salvar e validar o fechamento do modal. 6db7f80
- [x] Task: Realizar testes de acessibilidade e design de formulário responsivo no mobile. 6db7f80
- [x] Task: Conductor - User Manual Verification 'Phase 2: Validações, Timestamp e Toast' 6db7f80
