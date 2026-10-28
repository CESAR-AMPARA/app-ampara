# AI Pedagogical Strategy Suggestions Frontend

*Phase: Increments #3 to N (other). Story-map cards: "As a Pedagogical Coordinator, I want to receive pedagogical strategy suggestions based on the AI's predictive data" (value 100, 8 points).*

*This specification defines the frontend of class-level strategy suggestions and moves the "Biblioteca de Apoio" screen onto the guides API. Its backend counterpart is [todo/0039-ai-pedagogical-strategy-suggestions-backend.md](0039-ai-pedagogical-strategy-suggestions-backend.md), which pins every route, payload, and message consumed here; this side can be built and tested against that contract before the backend ships. It ships after [todo/0038-ai-risk-pattern-detection-frontend.md](0038-ai-risk-pattern-detection-frontend.md), because it adds a view, a settings switch, and an evaluation section to the "Apoio por IA" tab that spec creates.*

## Problem
A coordinator who sees a class going through a difficult stretch has no help deciding what the teachers should do with the class. The guides in the "Biblioteca de Apoio" describe how one adult approaches one student, and their text is hardcoded in the dashboard's script, so the backend cannot use the same reviewed content to ground any suggestion.

## Business Vision and Purposes
Putting weekly, class-level suggestions next to the AI patterns, each linked to the guide it comes from, gives the coordinator a ready starting point for the teachers' meeting while keeping the source one click away. Feedback on each suggestion tells the school whether the feature earns its place. Serving the library from the backend makes one reviewed corpus the source for both the screen people read and the suggestions the model writes.

## Solution
The "Biblioteca de Apoio" loads its guides from the API and looks and behaves as it does today, including search and favorites. The "Apoio por IA" tab gains a "Sugestões Pedagógicas" view listing this week's suggestions per class, each with what to do, why, and the guides it is based on, which open in the library. The coordinator marks each suggestion useful or not useful and can add a short comment. The settings view gains a separate switch for suggestions, and the evaluation view a section with their feedback.

## User Stories
1. As a Coordenador Pedagógico, I want to see this week's strategy suggestions grouped by class, so that I can prepare the meeting with each class's teachers.
2. As a Coordenador Pedagógico, I want to open the guide a suggestion is based on, so that I can check the source before passing it on.
3. As a Coordenador Pedagógico, I want to mark a suggestion useful or not useful in one click, so that giving feedback costs nothing.
4. As any professional, I want the support library to work exactly as before, so that the move to the server is invisible to me.
5. As a Coordenador Pedagógico, I want to turn suggestions on and off independently of pattern detection, so that the school can adopt one without the other.

## Implementation Decisions

### Library on the guides API
The `guiasBiblioteca` array is deleted from `dashboard.html`. `renderizarBiblioteca` loads `GET /api/biblioteca/guias` once per page load, the first time the library tab opens, and keeps the result in memory for searches and favorites. Field names follow the contract (`palavras_chave`, `como_reconhecer`, `passo_a_passo`, `o_que_nao_fazer`), and each step renders its `destaque` in a `<strong>` and its `texto` after it, both through `textContent`. The card template stops interpolating guide text into `innerHTML`, since the text now comes from the network.

- Loading: `"Carregando guias..."`.
- Error: `"Não foi possível carregar a Biblioteca de Apoio. Tente novamente."` with a `"Tentar novamente"` button.
- The existing empty state, `"Nenhum guia encontrado para a sua busca ou filtros."`, is unchanged.

Favorites stay in `localStorage` under `favoritosBiblioteca`: they are a per-viewer convenience, the guide ids do not change, and losing them in a private window costs nothing. Each card gets `id="guia-card-<id>"`, and a new `abrirGuia(id)` switches to the library tab, clears the search and the favorites filter, opens that guide's `<details>`, scrolls it into view, and moves focus to its heading. The suggestions view uses it, and it is the only new entry point into the library.

### Suggestions view
The tablist of `gestor-tab-ia` gains `"Sugestões Pedagógicas"` between `"Padrões Identificados"` and `"Avaliação"`. It loads `GET /api/gestao/ia/sugestoes`, with a class filter (`"Todas as turmas"` plus the classes of `GET /api/turmas`) that adds `turma_id`.

A non-dismissible notice sits above the list, part of the markup like the one in `0038`: `"Sugestões geradas por inteligência artificial a partir de dados agregados da turma, sem identificar estudantes, e baseadas nos guias da Biblioteca de Apoio. São pontos de partida para o planejamento com os professores: não são prescrições e não substituem a avaliação da coordenação e da equipe multidisciplinar."` Under it, `"Semana de 26/10/2026 · 28 turmas analisadas"`.

Each class is a section headed `"1º Ano A · Manhã"`. Each suggestion is a card with:

- the `titulo` as heading;
- `"O que fazer"` followed by `estrategia`;
- `"Por que esta sugestão"` followed by `justificativa`;
- `"Baseada em:"` and one button per cited guide with its title, calling `abrirGuia(id)`;
- the footer `"Gerada por IA em 26/10/2026 · versão estrategias-v1"`;
- the feedback controls below.

Model text is inserted with `textContent`, never `innerHTML`.

States:
- Loading: `"Carregando sugestões..."`.
- `ativo: false`: `"As sugestões pedagógicas por IA estão desativadas nesta escola."` with `"Ir para Configuração"`.
- Empty with `turmas_analisadas` above zero: `"Nenhuma turma precisou de sugestões nesta semana."`
- Empty with `turmas_analisadas` zero: `"Ainda não há sugestões. Elas são geradas toda segunda-feira, de madrugada."`
- Error: `"Não foi possível carregar as sugestões. Tente novamente."` with `"Tentar novamente"`.

### Feedback
Two toggle buttons, `"👍 Útil"` and `"👎 Não útil"`, with `aria-pressed` reflecting `feedback.meu.util`. A click sends `PUT /api/gestao/ia/sugestoes/<id>/feedback` with `{"util": <bool>}` (keeping any existing comment), updates the counts line, `"Avaliações da coordenação: {util} útil · {nao_util} não útil"`, and reveals a `"Comentário (opcional)"` textarea of 300 characters with the hint `"Não cite estudantes."` and a `"Enviar comentário"` button, which sends the same route with the comment. The backend `mensagem` shows in the toast. On failure, the buttons return to their previous state and the toast shows the backend `mensagem`, or `"Não foi possível registrar sua avaliação. Tente novamente."` when there is none. One click and no dialog, because feedback that costs a dialog does not get given.

### Settings and evaluation
The `"Configuração"` view of `0038` gains a third `role="switch"`, `"Sugerir estratégias pedagógicas para as turmas"`, independent of the pattern-detection switch, with the description `"Toda segunda-feira, dados agregados de cada turma, sem nomes e sem relatos, são enviados a um modelo de IA externo junto com os guias da Biblioteca de Apoio, para sugerir estratégias para a turma inteira."` It uses the same RIPD checkbox and `PUT /api/gestao/ia/configuracao` with `sugestoes_ativo`.

The `"Avaliação"` view gains a `"Sugestões pedagógicas"` section from `GET /api/gestao/ia/sugestoes/avaliacao`: `"{sugestoes_geradas} sugestões geradas · {com_retorno} avaliadas · {uteis} úteis · {nao_uteis} não úteis"`, and a table with `"Guia"` (the title from the guides already loaded), `"Úteis"`, and `"Não úteis"`.

### Accessibility
The class filter is a labelled `<select>`. Class sections use `<h3>` headings inside the view's `<h2>`, so a screen reader can jump between classes. Feedback buttons are real `<button>` elements with `aria-pressed`; one `aria-live="polite"` region announces list reloads (`"{n} sugestões em {m} turmas."`) and feedback results. After `abrirGuia`, focus lands on the guide's heading, and the library's existing tab semantics apply.

Copies under `frontend/src/` stay identical to `frontend/public/`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Exercised against the real `dashboard.html` through `frontend/test/dashboard_harness.js`, with `fetch` doubled per route.

- `frontend/test/test_biblioteca_api.js`: the library requests `GET /api/biblioteca/guias` once and renders the three guides from a contract fixture; `guiasBiblioteca` no longer exists in the page; `destaque` renders bold and a `<script>` in any field stays inert; search by keyword and favorites still work; loading and error states; `abrirGuia` switches tab, opens the right guide, and focuses its heading. Each profile can open the library.
- `frontend/test/test_ai_strategy_suggestions.js`: the view renders classes and suggestions from the contract fixture; the notice is present; the class filter adds `turma_id`; every state above; the feedback payloads, `aria-pressed`, the counts update, the comment flow, and the rollback on failure; guide buttons call `abrirGuia`.
- `frontend/test/test_ai_settings_and_evaluation.js` (extended from `0038`): the suggestions switch sends `sugestoes_ativo` and works with pattern detection off; the suggestions evaluation section renders totals and the per-guide table.

## Out of Scope
- The weekly job, the guides data file, and every route, specified in [todo/0039-ai-pedagogical-strategy-suggestions-backend.md](0039-ai-pedagogical-strategy-suggestions-backend.md).
- Showing suggestions to teachers.
- Editing or adding guides from the dashboard.
- Moving library favorites to the server.
