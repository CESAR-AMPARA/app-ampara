# Specification: Biblioteca de Guias Práticos (User Story 1)

## 1. Overview
Os profissionais da escola (Professores, Coordenadores e Equipes Multidisciplinares) precisam acessar guias de apoio rápidos e empáticos para saber como acolher e abordar estudantes que estão passando por crises emocionais de forma imediata e humanizada.

## 2. Functional Requirements
- **Aba Biblioteca:** Adicionar uma nova seção no painel (`/dashboard`), chamada **"Biblioteca"**, acessível de maneira responsiva (web-first e focado em dispositivos móveis).
- **Conteúdo Renderizado Nativamente:** O conteúdo dos guias deve ser renderizado como markup HTML limpo, legível, com tipografia adequada, sem exigir downloads de arquivos PDF externos para visualização do conteúdo principal.
- **Barra de Pesquisa:** Um campo de busca que filtra os guias em tempo real com base em palavras-chave (título do guia, descrição ou tags).
- **Botão "Salvar nos favoritos":** Cada guia de apoio deve possuir um botão interativo para "Adicionar aos favoritos" (com feedback visual de estado, como uma estrela ou coração preenchido). A lista de guias deve permitir filtrar apenas os salvos nos favoritos.

## 3. Non-Functional Requirements
- **Acessibilidade:** Suporte total a navegação por teclado nas abas e botões de favorito, contraste adequado e tags semânticas de leitura (WCAG).
- **Consistência Visual:** Utilizar as mesmas cores da paleta de design do A.M.P.A.R.A. (tons de verde sálvia, areia, azul marinho e bordas arredondadas).

## 4. Acceptance Criteria
- [ ] Criar a aba "Biblioteca" no dashboard, integrando-a com a navegação existente.
- [ ] Disponibilizar barra de pesquisa por palavras-chave em tempo real.
- [ ] Renderizar guias práticos completos na tela do celular, sem necessidade de download ou abertura de abas externas.
- [ ] Incluir um botão "Salvar nos favoritos" em cada guia que altere seu estado visual e permita filtrar guias favoritos.
- [ ] Garantir acessibilidade (WCAG) para navegação por teclado e contraste de cores.
