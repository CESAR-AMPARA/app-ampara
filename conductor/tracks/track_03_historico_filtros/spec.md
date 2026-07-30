# Specification: Histórico e Filtros de Observações (User Story 3)

## 1. Overview
Para que os profissionais consigam analisar a evolução comportamental de um aluno ao longo do tempo e planejar intervenções adequadas, é crítico dispor de um prontuário que seja claro, ordenado cronologicamente e que permita filtrar registros antigos ou recentes, além de identificar qual profissional (por exemplo, qual professor) registrou aquela observação.

## 2. Functional Requirements
- **Visualização Cronológica Clara:** Garantir que todos os registros inseridos na Linha do Tempo Comportamental do Estudante (tanto na tela de busca da Coordenação quanto no histórico visualizado no modal de registro do professor) sejam exibidos em formato de timeline cronológica bem definida.
- **Filtro por Período de Data:**
  - Adicionar um seletor de período acima da linha do tempo.
  - Opções pré-definidas: Últimos 7 dias, Últimos 30 dias, Últimos 90 dias, e Período Personalizado (com inputs de data "De" e "Até").
  - Ao selecionar uma opção, filtrar e re-renderizar a timeline do estudante instantaneamente para exibir apenas as ocorrências contidas na faixa de datas escolhida.
- **Identificação do Profissional Registrador:**
  - Exibir em cada card da timeline o nome do profissional responsável pela observação (por exemplo, `"Registrado por Prof. Ana Souza"` ou `"Registrado por Coordenadora Carla Lima"`).
  - Caso o registro não possua autor explicitamente definido, exibir uma indicação padrão legível (ex: `"Equipe A.M.P.A.R.A."`).

## 3. Non-Functional Requirements
- **Responsividade:** O seletor de datas e filtros deve se adaptar de forma fluida a telas de smartphones, evitando quebras de layout.
- **Tratamento de Dados:** As datas devem ser processadas com robustez no client-side para evitar falhas de fuso horário ou formatação regional brasileira.

## 4. Acceptance Criteria
- [ ] Registros da linha do tempo dispostos em ordem cronológica (padrão decrescente por data).
- [ ] Presença de seletor de filtros com opções para os últimos 7, 30, 90 dias ou intervalo de datas customizado.
- [ ] Ação de filtrar datas funciona e oculta/exibe os registros corretamente de forma assíncrona/reativa na tela.
- [ ] Cada registro da timeline exibe claramente o nome do profissional autor da observação.
