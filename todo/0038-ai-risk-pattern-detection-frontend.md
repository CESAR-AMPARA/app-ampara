# AI Risk Pattern Detection Frontend

*Phase: Increments #3 to N (other). Story-map cards: "As a user, I want the AI to identify behavior patterns that may indicate a non-obvious future risk" (value 300, 8 points); "As a user, I want to validate the AI insights to help train the model with real school data" (value 100, 3 points).*

*This specification defines the frontend of AI pattern detection: the insights list with its evidence, the validation dialog, the evaluation table, and the school's settings. Its backend counterpart is [todo/0037-ai-risk-pattern-detection-backend.md](0037-ai-risk-pattern-detection-backend.md), which pins every route, payload, and message consumed here; this side can be built and tested against that contract before the backend ships. It reads the student history of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md) to show evidence, drawn with the renderer of [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md), and ships after that one.*

## Problem
Once the backend starts producing AI suggestions about students, the coordination and the multidisciplinary team need a place to read them, check them against the records, and say whether they were right. Without a screen that puts the evidence next to the claim and makes validation a two-click action, suggestions either get ignored or, worse, get believed without being checked.

## Business Vision and Purposes
The value of the feature is a human looking at a student the school would otherwise have missed, and the evidence that the AI earns its place. The screen must make the human check easier than skipping it, make it impossible to mistake a suggestion for a diagnosis, and let the coordinator decide, with numbers and with the DPO's approval in hand, whether the school keeps the feature on.

## Solution
The coordination panel gains a "Apoio por IA" tab with three views: "Padrões Identificados" (the insights to review), "Avaliação" (confirmation rates per pattern type), and "Configuração" (the school's opt-in). The multidisciplinary panel gains a "Padrões Identificados pela IA" section with the insights about the students referred to the professional. Every insight shows its explanation and the observations behind it; a click opens those observations highlighted in the student's timeline. "Confirmar" and "Descartar" record the validation, a discard asking for the reason. Teachers see nothing of this.

## User Stories
1. As a Coordenador Pedagógico, I want a list of pending AI suggestions with the student, the pattern, and the supporting observations, so that I can review them in one sitting.
2. As a Coordenador Pedagógico or Equipe Multidisciplinar professional, I want to open the cited observations in the student's timeline, so that I check the claim against what teachers wrote.
3. As a reviewer, I want to confirm a suggestion, or discard it choosing a reason, so that the school's evaluation reflects my judgement.
4. As a Coordenador Pedagógico, I want to see how often each type of pattern was confirmed, so that I can decide whether the feature helps.
5. As a Coordenador Pedagógico, I want to turn the analysis on only after confirming the DPO approved it, and to understand what is sent before I do, so that the decision is informed.

## Implementation Decisions

### Placement and visibility
A tab button `btn-gestor-tab-ia` labelled `"🧠 Apoio por IA"` and its panel `gestor-tab-ia` are added after "Fila de Encaminhamentos" and join the `gestorTabs` and `gestorPanels` arrays. Inside it, a `role="tablist"` switches between `"Padrões Identificados"`, `"Avaliação"`, and `"Configuração"`. `#panel-saude` gains a `"Padrões Identificados pela IA"` card under "Meus Casos Designados", with the same list and validation but no evaluation or settings; the backend already restricts it to the professional's students. The teacher panel gets nothing, and the dashboard makes no `/api/ia/` request for a `docente`.

### The disclaimer
A non-dismissible notice sits above every insights list: `"Sugestões geradas por inteligência artificial a partir de registros sem nomes. Não são diagnósticos e não determinam nenhuma ação: confira as evidências e decida com a equipe."` It is part of the list's markup, not a toast or a modal to click away, because the risk it addresses is a reader who forgets, on the twentieth card, that a machine wrote it.

### Insights list
`GET /api/ia/insights` with a `status` select: `"Pendentes"` (default), `"Confirmados"`, `"Descartados"`, `"Expirados"`. Each insight is a card with:

- the student's name and class;
- a category badge: `escalada_gradual` → `"Escalada gradual"`, `mudanca_de_padrao` → `"Mudança de padrão"`, `convergencia_de_relatos` → `"Relatos convergentes"`, `recorrencia_temporal` → `"Recorrência no tempo"`, `reacao_a_evento` → `"Reação a um evento"`, `interrupcao_de_registros` → `"Interrupção de registros"`;
- the `titulo` as the card heading and the `explicacao` below it; when the backend's retention rule has erased them (both `null`), the heading is the category label and the body reads `"Texto removido pela política de retenção de dados."`;
- `"Período analisado: 28/07/2026 a 25/10/2026"`;
- `"Evidências"`: one line per observation, `"03/08/2026 · Euforia · Gravidade Baixa"`, and a `"Ver na linha do tempo"` button;
- the footer `"Gerado por IA em 26/10/2026 · versão padroes-v1"`, plus `"inclui relatos escritos"` when `origem.texto_livre` is true;
- for pending insights, `"Confirmar"` and `"Descartar"`; for validated ones, `"Confirmado por {nome} em {data}"` or `"Descartado por {nome} em {data}: {motivo}"`.

Text from the API is inserted with `textContent`, never `innerHTML`: it is model output.

States:
- Loading: `"Carregando padrões identificados..."`.
- `ativo: false`, coordinator: `"A detecção de padrões por IA está desativada nesta escola."` with a `"Ir para Configuração"` button; multidisciplinary professional: `"A coordenação da escola não ativou a detecção de padrões por IA."`
- Empty, pending: `"Nenhum padrão novo para revisar. A análise acontece todas as madrugadas."`
- Empty, other statuses: `"Nenhum insight nesta situação."`
- Error: `"Não foi possível carregar os padrões identificados. Tente novamente."` with `"Tentar novamente"`.

### Evidence in the timeline
`"Ver na linha do tempo"` opens `#insight-timeline-modal`, a read-only `role="dialog"` that loads `GET /api/estudantes/<id>/historico?de=&ate=` with the insight's `periodo` and draws it with `renderStudentHistory(container, payload)` of `0016`. `renderStudentHistory` gains `data-tipo-registro` and `data-id` attributes on each item, its only change here, and the items of kind `observacao` whose id is in `evidencias` get a highlighted border and the label `"Citada pela IA"`, and focus moves to the first of them. A dialog instead of jumping to the "Busca & Registros" tab keeps the reviewer on the card they are validating and works the same in the multidisciplinary panel, which has no search tab.

### Validation dialog
`"Confirmar"` opens `#insight-validation-modal` titled `"Confirmar padrão"`, with an optional `"Observação"` textarea (500 characters) and the button `"Confirmar padrão"`. `"Descartar"` opens it titled `"Descartar padrão"`, with a required `<fieldset>` `"Motivo do descarte"` of radio buttons:

- `ja_conhecido`: `"A equipe já conhecia ou já acompanha esta situação"`
- `evidencia_insuficiente`: `"As evidências não sustentam o padrão"`
- `interpretacao_incorreta`: `"A interpretação dos registros está errada"`
- `contexto_externo`: `"Há uma explicação no contexto da escola (provas, eventos, a turma inteira)"`
- `outro`: `"Outro motivo"`

followed by the optional `"Detalhe"` textarea (500 characters) and the button `"Descartar padrão"`. Both textareas carry the hint `"Não inclua nomes nem informações clínicas."` Submitting sends `POST /api/ia/insights/<id>/validacao`, shows the backend `mensagem` in the toast, removes the card from the pending list, and moves focus to the next card's heading, or to the list heading when none is left. A 409 shows its message and reloads the list.

The confirmed message suggests a referral; the dialog does not pre-fill one with the AI's text. A referral's `motivo` is read by the psychologist as a professional's account, and it must be written by one.

### Evaluation view
`GET /api/gestao/ia/avaliacao` renders a table with `"Tipo de padrão"`, `"Gerados"`, `"Confirmados"`, `"Descartados"`, `"Expirados"`, `"Taxa de confirmação"` (`"44%"`, or `"—"` when `null`), and `"Situação"` (`"Ativa"` or `"Suspensa"`). Below it: `"A taxa considera apenas insights validados. Um tipo de padrão com menos de 20% de confirmação após 20 validações deixa de ser gerado nesta escola."` and `"Tempo mediano até a validação: {n} horas."` Discard reasons per category open in a `<details>` row.

### Settings view
`GET /api/gestao/ia/configuracao`. When `disponivel` is false, the view reads `"A detecção de padrões por IA ainda não está disponível para esta escola. Fale com a equipe A.M.P.A.R.A."` and the controls are disabled. Otherwise:

- A `role="switch"` `"Detectar padrões com IA"` with the description `"Toda madrugada, a linha do tempo dos estudantes com registros recentes é enviada, sem nomes, sem datas exatas e sem textos escritos, a um modelo de IA externo, que aponta padrões para a equipe revisar."`
- A second switch, `"Incluir os relatos escritos das observações"`, disabled while the first is off, with the warning `"Os relatos passam por remoção automática de nomes, mas podem conter detalhes que identifiquem o estudante. Ative somente com aprovação expressa do encarregado de dados."`
- A required checkbox when turning anything on: `"Confirmo que o Relatório de Impacto à Proteção de Dados (RIPD) desta funcionalidade foi aprovado pelo encarregado de dados da escola."`, pre-checked and showing `"Confirmado por {nome} em {data}"` once `ciente_ripd` exists.
- `"Salvar Configuração"`. Turning the analysis off first asks, in a `role="alertdialog"`: `"Desativar a detecção de padrões? Os insights pendentes serão encerrados."` with `"Sim, desativar"` and `"Voltar"`.
- The last run: `"Última análise: 26/10/2026 às 02:40 · 37 estudantes analisados · 4 padrões identificados"`, or `"Nenhuma análise realizada ainda."`

### Accessibility
Dialogs use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`, close on Escape and backdrop click, and return focus to the opener; the timeline dialog returns focus to the evidence button. List reloads and validations announce through one `aria-live="polite"` region (`"{n} padrões pendentes."`, then the backend `mensagem`). Category badges are text, not color alone. The switches respond to Space and expose `aria-checked`.

No prototype code is deleted: the dashboard has no AI mock. Copies under `frontend/src/` stay identical to `frontend/public/`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Exercised against the real `dashboard.html` through `frontend/test/dashboard_harness.js`, with `fetch` doubled per route, using `GESTOR`, `PSICOLOGA`, and a teacher user.

- `frontend/test/test_ai_insights_list.js`: the tab and the psychologist card render insights from the contract fixture; the disclaimer is present above every list; category labels; the status filter's requests; the `ativo: false`, empty, and error states per profile; API text inserted as text (a `<script>` in `titulo` stays inert); no `/api/ia/` request and no tab for a teacher.
- `frontend/test/test_ai_insight_validation.js`: confirm with and without a note; a discard blocked without a reason; the payload for each reason; the card removed and focus moved; the 409 reload; the timeline dialog requesting the insight's period and highlighting exactly the cited observations.
- `frontend/test/test_ai_settings_and_evaluation.js`: the unavailable state; the RIPD checkbox required to turn on; the free-text switch disabled while detection is off; the turn-off confirmation; the 400 and 409 messages shown; the evaluation table with `null` rates as `"—"` and suspended categories.

## Out of Scope
- The analysis job, pseudonymization, model adapter, and every route, specified in [todo/0037-ai-risk-pattern-detection-backend.md](0037-ai-risk-pattern-detection-backend.md).
- The Admin AMPARA screen to set a school's `ia_disponivel`; the route exists, the screen does not.
- Notifications or badges announcing new insights; the list is opened by choice.
- Any AI content in the teacher panel.
- Class-level pedagogical suggestions, specified in [todo/0040-ai-pedagogical-strategy-suggestions-frontend.md](0040-ai-pedagogical-strategy-suggestions-frontend.md).
