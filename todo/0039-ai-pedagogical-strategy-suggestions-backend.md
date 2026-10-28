# AI Pedagogical Strategy Suggestions Backend

*Phase: Increments #3 to N (other). Story-map cards: "As a Pedagogical Coordinator, I want to receive pedagogical strategy suggestions based on the AI's predictive data" (value 100, 8 points).*

*This specification defines the backend of class-level strategy suggestions: moving the "Biblioteca de Apoio" guides to the backend as the grounding corpus, the weekly generation job, the suggestion contract, and coordinator feedback. Its frontend counterpart is [todo/0040-ai-pedagogical-strategy-suggestions-frontend.md](0040-ai-pedagogical-strategy-suggestions-frontend.md), which can be built against the contract below before this ships. It ships after [todo/0037-ai-risk-pattern-detection-backend.md](0037-ai-risk-pattern-detection-backend.md), whose model adapter, `ia_configuracao`, and `ia_execucoes` it extends, and it reads the class aggregates of [todo/0023-emotional-climate-dashboards-backend.md](0023-emotional-climate-dashboards-backend.md) and the risk levels of [todo/0021-risk-classification-alerts-backend.md](0021-risk-classification-alerts-backend.md).*

## Problem
The coordinator can now see that a class is going through a bad stretch: the climate dashboard shows anxiety records climbing in the 1º Ano A, and the AI insights point at several of its students. What the coordinator cannot get is the next step for the class as a whole. The practical guides in the "Biblioteca de Apoio" are written for one adult facing one student in crisis, and turning "anxiety rose three weeks in a row, mostly on Mondays" into something a teacher can do with thirty adolescents on Monday morning is work the coordinator has to do alone, every week, for every class.

## Business Vision and Purposes
Schools adopt a monitoring tool when it helps them act, not only see. Weekly, class-level suggestions, each tied to the signal that motivated it and to a guide the school already trusts, give the coordinator a starting point for the pedagogical meeting with teachers. Coordinator feedback tells the school and the product which suggestions are worth producing.

## Solution
When the school opts in, a job runs every Monday before classes. For each class with enough recent activity, it sends the model the class's anonymous aggregates of the last 8 weeks (records per type and severity, risk distribution, and the number of confirmed AI patterns) together with the library guides that match the class's signals, and asks for at most 3 strategies for the whole class, each citing at least one guide. The coordinator sees the suggestions per class, with their justification and the cited guides, and marks each one useful or not useful. Suggestions never name, count, or target individual students, and the backend rejects any that cites a guide it was not given.

The library guides move from the dashboard's script to a backend data file, served to every profile through an API, so the same reviewed text grounds the model and the library screen.

## User Stories
1. As a Coordenador Pedagógico, I want weekly strategy suggestions for each class showing signs of emotional strain, so that I can bring a concrete plan to the teachers' meeting.
2. As a Coordenador Pedagógico, I want each suggestion to state which class data motivated it and which guide it comes from, so that I can judge it and read the source.
3. As a Coordenador Pedagógico, I want to mark a suggestion as useful or not useful, with an optional comment, so that the school learns which suggestions help.
4. As any professional, I want the "Biblioteca de Apoio" to keep showing the same guides after they move to the server, so that nothing changes for me.

## Implementation Decisions

### The guides become a backend data file
The `guiasBiblioteca` array in `frontend/public/dashboard.html` moves to `backend/src/library/guias.json`, loaded by `GuideLibrary` in `src/library/guides.py` when `create_app` builds it and served by `GET /api/biblioteca/guias` from a blueprint in `src/routes/biblioteca.py`. A versioned file in the repository, not a table, because the guides are curated platform-wide by the A.M.P.A.R.A. team, have no editing screen, and should change through a reviewed pull request; a per-tenant table would let the corpus diverge between schools for no reason, and a Master table would need an editor nobody has asked for.

Two fields are added. `sinais` lists the observation `tipo` values of `0015` the guide addresses, and `uso_em_sugestoes` says whether the guide may ground a class-level suggestion. The existing guides map as `guia-01` → `["ansiedade", "agitacao"]`, `guia-02` → `["tristeza", "apatia"]`, and `guia-03` → `[]` with `uso_em_sugestoes: false`. The self-harm guide is excluded on purpose: a class-wide strategy grounded on it would announce a self-harm concern to a whole class, which suicide-prevention guidance warns can spread the behavior it means to prevent, and self-harm is handled case by case through the referral queue.

The HTML inside `passoAPasso` (`<strong>` around the first clause) becomes structure, `{"destaque": "...", "texto": "..."}`, so neither the frontend nor the model ever receives markup from the API.

### Grounding without vector retrieval
The corpus has 2 eligible guides today, about 700 tokens each, so retrieval is a filter, not a search: a guide is sent when one of its `sinais` is among the 2 observation types with the most records in the class over the last 4 weeks. Embeddings and a vector store for a corpus that fits in one prompt would add a dependency and a failure mode for no recall gain; I would revisit at around 30 guides, when sending every matching guide stops fitting a 10,000-token input. When no eligible guide matches, the class gets no suggestion that week rather than an ungrounded one.

The consequence is that suggestions will be repetitive until the corpus grows, since every anxious class draws on the same guide. That limits the feature's value and is an open question for the product owner, not something the model should paper over by inventing practices: the prompt forbids practices absent from the guides, and the validator rejects a suggestion without a valid guide.

I considered a deterministic mapping from signal to a canned class strategy per guide, without a model. It was rejected because the canned text would be the guide itself, which the coordinator already reads in the library; what the model adds is turning a one-to-one crisis guide into a class-level plan tied to when and how the class's records moved.

### What the model sees
`ClassStrategyInput` in `src/insights/strategy_input.py` builds the input from two sources: `ClimateAggregator.class_trend(turma_id, de, ate, "semana")` of `0023`, which already returns weekly counts by type and severity and the risk distribution at the end of each week, and `ia_insights` of `0037`. The class is not named; only its shift and size are sent. Every value that `0023`'s suppression hides (cells backed by 1 or 2 students, and the complementary cells it hides so totals cannot reveal them) is written `oculto`, and cells backed by no student are written `0`. No student identifier, no free text, and no observation-level data is included, so the input is aggregate and anonymous by construction.

```
Turma do turno da manhã, 31 estudantes
Registros por semana (S-7 é a mais antiga, S0 é a atual):
ansiedade: S-7 oculto | S-6 0 | S-5 3 | S-4 4 | S-3 4 | S-2 6 | S-1 7 | S0 9
apatia:    S-7 0 | S-6 0 | S-5 0 | S-4 oculto | S-3 3 | S-2 3 | S-1 4 | S0 3
Dias da semana com mais registros nas últimas 4 semanas: segunda, terça
Gravidade na semana atual: Baixa 7 | Média oculto | Alta oculto
Estudantes por nível de risco ao fim da semana atual: leve 24 | moderado oculto | crítico oculto
Padrões confirmados pela equipe nos últimos 60 dias: convergencia_de_relatos 3
Guias disponíveis:
[guia-01] Abordagem Inicial em Crises de Ansiedade Aguda
...
```

The weekday line is computed here from `observacoes` with `suppress_group` of `src/climate/suppression.py`, because `0023` aggregates by week only; it names at most the 2 weekdays with the most records and is omitted when no weekday covers 3 students or more.

Confirmed patterns come only from `0037` insights with `status = "confirmado"` and are counted in distinct students per category, through the same `suppress_group`; when `padroes_ativo` is off, the line is omitted. This is the "predictive data" of the card: human-confirmed AI findings, aggregated, never unconfirmed ones.

A class is analyzed when at least 3 distinct students have observations in the last 4 weeks; below that, every cell would be suppressed and there is nothing to say. At about 30 classes per school and about 2,700 input tokens per class (prompt, tool, aggregates, and up to 2 guides, estimated, not measured), a weekly run costs about 81,000 input tokens per school.

### Model-facing text
The constants join those of `0037` in `src/insights/prompts.py`: `PROMPT_SISTEMA_ESTRATEGIAS`, `FERRAMENTA_REGISTRAR_SUGESTOES`, and `VERSAO_PROMPT_ESTRATEGIAS = "estrategias-v1"`. The call goes through the `StructuredModel` protocol and `LlmGatewayAdapter` of `0037`, unchanged.

`PROMPT_SISTEMA_ESTRATEGIAS`:

```
Você apoia a coordenação pedagógica de uma escola brasileira. Você recebe dados agregados e anônimos de uma turma de adolescentes nas últimas 8 semanas: quantos registros de comportamento de cada tipo e gravidade os professores fizeram, quantos estudantes estão em cada nível de risco e quantos padrões de risco a equipe confirmou. Valores ocultos para proteger grupos pequenos de estudantes aparecem como "oculto". Você também recebe guias práticos da Biblioteca de Apoio da escola, cada um com um código entre colchetes.

Sua tarefa é sugerir estratégias pedagógicas para a turma como um todo, que os professores possam aplicar em sala nas próximas duas semanas.

Regras:
- Baseie cada sugestão em pelo menos um dos guias fornecidos e cite seu código. Não proponha práticas que não estejam nos guias; adapte-as para a turma inteira.
- Na justificativa, diga qual dado da turma motivou a sugestão.
- Fale da turma, nunca de estudantes individuais. Não tente identificar quem são e não faça diagnósticos.
- Não proponha medidas disciplinares, contato com famílias nem encaminhamentos: essas decisões são da coordenação e da equipe multidisciplinar.
- Escreva em português, de forma prática e respeitosa.
- Registre no máximo 3 sugestões. Se os dados não indicarem necessidade, chame a ferramenta com a lista vazia.
```

`FERRAMENTA_REGISTRAR_SUGESTOES`, the only tool, with the call forced:

```json
{
  "name": "registrar_sugestoes",
  "description": "Registra as estratégias pedagógicas sugeridas para a turma. Chame uma única vez, com a lista vazia se não houver sugestão.",
  "parameters": {
    "type": "object",
    "properties": {
      "sugestoes": {
        "type": "array",
        "maxItems": 3,
        "items": {
          "type": "object",
          "properties": {
            "titulo": { "type": "string", "description": "A estratégia em uma frase curta, com até 100 caracteres." },
            "estrategia": { "type": "string", "description": "O que os professores podem fazer em sala, em passos concretos, com até 800 caracteres." },
            "justificativa": { "type": "string", "description": "Qual dado da turma motivou a sugestão, com até 300 caracteres." },
            "guias": { "type": "array", "items": { "type": "string" }, "description": "Códigos dos guias em que a sugestão se baseia, como guia-01. Mínimo de 1." }
          },
          "required": ["titulo", "estrategia", "justificativa", "guias"]
        }
      }
    },
    "required": ["sugestoes"]
  }
}
```

### Output validation
`StrategyValidator` in `src/insights/strategy_validator.py` drops a suggestion, counting it in `ia_execucoes.saidas_rejeitadas`, when it cites no guide or a guide that was not in its input, exceeds a length limit, contains a term of `TERMOS_DIAGNOSTICOS_PROIBIDOS` from `0037`, or contains any name from the tenant roster. The last check is defense in depth: the input carries no names, so a name in the output means something leaked and the suggestion must not be stored.

### Weekly job
`StrategySuggestionJob` in `src/insights/strategy_job.py` runs from a second command, `flask insights strategies`, scheduled by a host cron entry on Mondays at 03:00 (America/Sao_Paulo), after the nightly pattern run of `0037` so it sees the latest confirmations. It uses the same `ia_execucoes` lock with `tipo = "sugestoes"`, the same gates (`ia_disponivel` in the Master database and a configured gateway), and the same retry and timeout rules. Weekly, not nightly and not on request: the aggregates of `0023` move by week, the suggestions are for a two-week horizon, and a coordinator reading a different plan every morning would trust none of them. A class's new suggestions mark its previous ones `"substituida"`.

### Tenant tables
`ia_configuracao` gains `sugestoes_ativo BOOLEAN not null default false`, and `ia_execucoes.tipo` gains the value `"sugestoes"`. Three tables are added:

```
ia_sugestoes:
  id             INTEGER      primary key
  turma_id       INTEGER      not null, references turma(id)
  execucao_id    INTEGER      not null, references ia_execucoes(id)
  semana_de      DATE         not null   -- Monday of the generation week
  titulo         VARCHAR(100) not null
  estrategia     TEXT         not null   -- at most 800 characters
  justificativa  TEXT         not null   -- at most 300 characters
  status         VARCHAR(12)  not null default 'ativa'   -- "ativa" | "substituida"
  versao_prompt  VARCHAR(20)  not null
  gerado_em      TIMESTAMP    not null

ia_sugestao_guias:
  sugestao_id  INTEGER     not null, references ia_sugestoes(id)
  guia_id      VARCHAR(20) not null   -- id in guias.json
  primary key (sugestao_id, guia_id)

ia_sugestao_feedback:
  sugestao_id  INTEGER    not null, references ia_sugestoes(id)
  usuario_id   INTEGER    not null, references usuarios(id)
  util         BOOLEAN    not null
  comentario   TEXT       null       -- at most 300 characters
  created_at   TIMESTAMP  not null
  updated_at   TIMESTAMP  not null
  primary key (sugestao_id, usuario_id)
```

### LGPD
Suggestions are built from suppressed aggregates and hold no student data, so they are not in the anonymization sweep or the student export of [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md), and reading them does not call `AuditLogger`. The feedback `comentario` is free text written by the coordinator about a suggestion; the frontend asks for no names, and it is not swept either. The risk is a coordinator naming a student in a comment; the impact is one name in a field nobody else reads, and the mitigation is the hint plus the 300-character limit. Turning suggestions on requires the same `ciente_ripd` acknowledgment as `0037`, because the processing is part of the same impact report even if its input is anonymous.

### `GET /api/biblioteca/guias`
Accessible to `gestor_escolar`, `docente`, and `equipe_multidisciplinar`. The guides are not personal data; the response carries `Cache-Control: private, max-age=3600`.

```json
{
  "guias": [
    {
      "id": "guia-01",
      "titulo": "Abordagem Inicial em Crises de Ansiedade Aguda",
      "categoria": "Ansiedade & Pânico",
      "palavras_chave": ["ansiedade", "pânico", "crise", "choro", "hiperventilação", "respirar", "respiração"],
      "sinais": ["ansiedade", "agitacao"],
      "uso_em_sugestoes": true,
      "descricao": "Como oferecer os primeiros socorros psicológicos a um aluno apresentando crise de pânico ou hiperventilação na escola.",
      "como_reconhecer": ["Hiperventilação (respiração rápida e curta)."],
      "passo_a_passo": [
        { "destaque": "Mantenha a calma física e vocal:", "texto": "A sua serenidade é a principal âncora de segurança do estudante." }
      ],
      "o_que_nao_fazer": ["Nunca diga frases minimizadoras como 'calma, não é nada', 'isso é bobagem' ou 'você quer aparecer'."]
    }
  ]
}
```

The lists are shortened here; the file carries the full current text of the three guides.

### `GET /api/gestao/ia/sugestoes?turma_id=3`
Accessible only to `gestor_escolar`. Returns the `"ativa"` suggestions, grouped by class; `turma_id` is optional and answers 404 with `"Turma não encontrada."` when unknown. Classes without suggestions are absent, and `turmas_analisadas` lets the client tell "no class needed one" from "nothing ran".

```json
{
  "ativo": true,
  "semana_de": "2026-10-26",
  "turmas_analisadas": 28,
  "turmas": [
    {
      "turma": { "id": 3, "nome": "1º Ano A", "turno": "Manhã" },
      "sugestoes": [
        {
          "id": 88,
          "titulo": "Pausa de respiração guiada no início das aulas de segunda e terça",
          "estrategia": "Nos primeiros cinco minutos das aulas de segunda e terça, conduza com a turma o exercício de respiração em 4 tempos do guia...",
          "justificativa": "Os registros de ansiedade cresceram por cinco semanas seguidas e se concentram nas segundas e terças.",
          "guias": [{ "id": "guia-01", "titulo": "Abordagem Inicial em Crises de Ansiedade Aguda" }],
          "gerado_em": "2026-10-26T06:20:00Z",
          "origem": { "versao_prompt": "estrategias-v1", "modelo": "modelo-configurado-no-gateway" },
          "feedback": { "meu": null, "util": 1, "nao_util": 0 }
        }
      ]
    }
  ]
}
```

`ativo` is `false`, with `turmas` empty, while `sugestoes_ativo` is off. `feedback.meu` is the caller's own `{"util": true, "comentario": null}`, or `null`.

### `PUT /api/gestao/ia/sugestoes/<int:id>/feedback`
Accessible only to `gestor_escolar`; creates or replaces the caller's feedback.

- Request Body: `{"util": false, "comentario": "A turma já faz esse exercício desde agosto."}`
- `util` missing or not a boolean: 400 with `"Informe se a sugestão foi útil."`
- `comentario` over 300 characters: 400 with `"O comentário deve ter até 300 caracteres."`
- unknown suggestion: 404 with `"Sugestão não encontrada."`
- Response Status: 200 OK with `{"sucesso": true, "mensagem": "Obrigado pelo retorno sobre a sugestão."}`

### `GET /api/gestao/ia/sugestoes/avaliacao?versao_prompt=estrategias-v1`
Accessible only to `gestor_escolar`; `versao_prompt` defaults to the current one.

```json
{
  "versao_prompt": "estrategias-v1",
  "sugestoes_geradas": 46,
  "com_retorno": 19,
  "uteis": 13,
  "nao_uteis": 6,
  "por_guia": [
    { "guia_id": "guia-01", "uteis": 9, "nao_uteis": 2 },
    { "guia_id": "guia-02", "uteis": 4, "nao_uteis": 4 }
  ]
}
```

### Settings
`GET /api/gestao/ia/configuracao` of `0037` gains `"sugestoes_ativo"`, and its `PUT` accepts it under the same rules: 409 with `"A detecção de padrões por IA não está disponível para esta escola."` when the school is not available, and 400 with the `ciente_ripd` message when turning it on without the acknowledgment. Unlike `incluir_texto_livre`, it does not require `padroes_ativo`. When a request changes only `sugestoes_ativo`, the message is `"Sugestões pedagógicas por IA ativadas. As primeiras chegam na próxima segunda-feira."` or `"Sugestões pedagógicas por IA desativadas."`; when it changes more than one switch, `"Configuração de IA atualizada."`.

## Testing Decisions
No test reaches a network: `MockStructuredModel` of `0037` scripts the answers, the clock is injected, and databases are in-memory SQLite.

- `backend/test/test_library_guides.py`: the data file loads and every guide has the required fields; `passo_a_passo` holds no markup; the three current guides are present with their `sinais` and `uso_em_sugestoes`; every `sinais` value is a `tipo` of `0015`.
- `backend/test/test_insights_strategy_input.py`: the input text for a fixture class, suppressed cells written `oculto` and empty ones `0`, the class name absent, guide selection by `sinais`, `guia-03` never sent, the confirmed-patterns line omitted when `padroes_ativo` is off, the 3-student floor.
- `backend/test/test_insights_strategy_validator.py`: every drop rule, including a guide outside the input.
- `backend/test/test_insights_strategy_job.py`: gates and lock, previous suggestions marked `"substituida"`, classes with no matching guide get none, counts in `ia_execucoes`.
- `backend/test/test_insights_service.py` (extended from `0037`): the suggestions list shape, feedback upsert and its validations, the evaluation figures, the settings rules and messages.
- `backend/test/test_routes_ia.py` (extended from `0037`): role access on the new routes.
- `backend/test/test_routes_biblioteca.py`: `GET /api/biblioteca/guias` for each profile, its cache header, and the 401 without a token.
- `backend/test/test_insights_prompts.py` (extended): the suggestion tool is valid JSON Schema and `VERSAO_PROMPT_ESTRATEGIAS` is set.

## Out of Scope
- The suggestions screen, feedback controls, the settings switch, and the library screen's move to the API, specified in [todo/0040-ai-pedagogical-strategy-suggestions-frontend.md](0040-ai-pedagogical-strategy-suggestions-frontend.md).
- Suggestions about individual students, and any clinical or disciplinary advice.
- Suggestions visible to teachers.
- An editor for the guides, and new guides; the corpus moves as it is.
- Vector search over the guides.

## Further Notes
For the product owner: the feature's usefulness is capped by the corpus, which today has 2 guides eligible for class-level suggestions. Who writes and reviews new class-level guides (for example, on class climate after a conflict, collective emotional-regulation routines, or exam-period stress), and should that work be scheduled before this spec? Should suggestions marked useful be shared with the class's teachers in a later increment?

For the school's data protection officer: the model input is aggregate, with no identifiers and with the small-cell suppression of `0023` applied. Does the DPO consider it anonymized data under LGPD art. 12, which would put it outside the international-transfer rules of art. 33 that `0037` raises, or should it follow the same vendor and region decision? Is the threshold of 3 enough for classes of about 30 students, or should it rise?
