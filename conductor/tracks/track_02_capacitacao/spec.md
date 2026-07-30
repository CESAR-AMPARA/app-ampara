# Specification: Compartilhamento de Materiais (User Story 2)

## 1. Overview
A coordenação pedagógica desempenha um papel essencial na capacitação contínua do corpo docente sobre acolhimento psicológico. Para isso, os coordenadores precisam de uma forma fácil e centralizada de compartilhar materiais formativos (como documentos PDF ou vídeos explicativos do YouTube/Vimeo) e acompanhar quais professores já leram/acessaram os recursos.

## 2. Functional Requirements
- **Interface do Coordenador (Upload & Compartilhamento):**
  - Adicionar um formulário de upload de arquivos (PDF) e inserção de links de vídeo (YouTube/Vimeo) na aba do Gestor Escolar.
  - Adicionar controles de seleção para definir quais turmas ou professores específicos devem receber o material (lista com checkboxes multi-seleção).
- **Métricas de Leitura (Coordinator Panel):**
  - Exibir para o coordenador uma lista dos materiais que ele compartilhou.
  - Para cada material, exibir uma métrica clara de leitura em tempo real no formato: `"Lido por X de Y professores"` (ex: "Lido por 3 de 4 professores").
- **Visualização do Professor (Receipt & Confirmation):**
  - No painel do professor (`Panel Docente`), exibir uma nova seção ou aba "Materiais Recebidos" ou "Capacitação".
  - O professor pode visualizar o PDF recebido (ou um mock representativo) ou assistir ao vídeo (incorporado via iframe ou link).
  - Incluir um botão proeminente de confirmação de leitura: `"Marcar como Lido"`. Quando clicado, atualiza o status de leitura para aquele professor no banco de dados / memória do cliente, atualizando a métrica no painel do Coordenador.

## 3. Non-Functional Requirements
- **Responsividade:** Interface otimizada tanto para desktops (Coordenadores) quanto para celulares (Professores acessando em sala de aula).
- **Acessibilidade:** Leitores de tela devem ler corretamente o status dos materiais e os botões de confirmação.

## 4. Acceptance Criteria
- [ ] Formulário de compartilhamento com upload de PDF e links de YouTube/Vimeo funcional no painel do Gestor.
- [ ] Seletor multi-seleção de turmas ou professores disponível antes de compartilhar.
- [ ] Métrica "Lido por X de Y professores" exibida para o Coordenador em cada material compartilhado.
- [ ] Painel do Professor exibe os materiais compartilhados com opção de visualizá-los.
- [ ] Botão de confirmação de leitura "Marcar como Lido" atualiza as estatísticas instantaneamente.
