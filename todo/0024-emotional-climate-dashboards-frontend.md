# Emotional Climate Dashboards Frontend

*Phase: Increment #2 (walking skeleton). Story-map cards: "As a Pedagogical Coordinator, I want to see a panel with the emotional situation of every class in the school" (value 800, 8 points); "As a Teacher, I want to see behavior trend charts for my class over the semester" (value 500, 3 points).*

*This specification defines the coordinator's school climate panel, the class trend charts, and the chart module both use. Its backend counterpart is [todo/0023-emotional-climate-dashboards-backend.md](0023-emotional-climate-dashboards-backend.md), which pins both routes, their payloads, and the suppression rule; this spec can be built against that contract before it ships. It reuses `riskBadge` and `renderRiskFilter` from [todo/0022-risk-classification-alerts-frontend.md](0022-risk-classification-alerts-frontend.md) and lands after it.*

## Problem
The dashboard has no view above the single student. The prototype suggested one with hardcoded class cards ("2 alertas emocionais ativos", "Comportamento estável"); [0014](0014-teacher-class-assignment-frontend.md) and [0022](0022-risk-classification-alerts-frontend.md) replaced that line with real risk counts, but a count of today's risk levels says nothing about direction. The coordinator cannot compare classes side by side, and a teacher cannot see whether their class is calmer now than in August. There is no chart anywhere in the product, and no agreed way to draw one.

## Business Vision and Purposes
The coordinator plans class-level actions and reports to the principal; teachers adjust how they run a class. Both decisions rest on direction over time and on comparison between classes, which only a chart makes readable at a glance. The charts must work for everyone who uses the platform, including teachers who use the high-contrast mode or a screen reader, and must never show a figure the backend hid to protect a student.

## Solution
The coordination panel gains a "Clima Emocional" tab. At the top, four figures for the whole school: students, students at critical risk, students at moderate risk, and observations in the last 14 days against the 14 before. Below, one row per class, neediest first: a bar showing the class's split across risk levels, the observation count and its direction ("em alta", "estável", "em queda"), and the most recorded types. A risk filter narrows the list, and the active filter is stated on screen. Each row opens the class trend. Teachers find the same trend inside each of their classes, under "Tendência da turma". The trend has two charts, observations per week by severity and students at moderate or critical risk at the end of each week, a period selector, a week or month toggle, and a button that shows the same numbers as a table. Hidden figures are drawn as hatched areas labelled "oculto" and explained in one sentence.

## User Stories
1. As a Coordenador Pedagógico, I want school totals and every class on one screen, neediest first, so that I decide where to act this week.
2. As a Coordenador Pedagógico, I want to filter the classes by risk level and see the filter stated, so that a projected screen is not misread.
3. As a Docente, I want a weekly chart of my class over the semester, so that I see whether the climate is improving.
4. As a Coordenador Pedagógico, I want to open any class's trend from the panel, so that I prepare a conversation with its teachers.
5. As a screen reader or high-contrast user, I want every chart summarized in text and available as a table, so that I get the same information.
6. As any user, I want hidden figures marked and explained, so that I do not read a gap as zero.

## Implementation Decisions

### Charts are hand-written SVG, not a charting library
I chose to draw the charts as inline SVG from a small module of our own, `frontend/public/js/charts.js`, mirrored to `frontend/src/static/charts.js`, rather than adopt a library. The deciding constraint is testing and accessibility, not bundle size. The frontend suite runs in jsdom, which has no canvas implementation, so a canvas-based library cannot be asserted on at all: the tests would check that a `<canvas>` exists and nothing about what it shows. SVG elements are ordinary DOM, so a test can count bars, read their heights, and check that a suppressed bucket is hatched. SVG is also styled by CSS, so the existing high-contrast mode of `main.js` (the `high-contrast` class on `body`) and the large-font mode recolour and rescale the charts through the same CSS variables as the rest of the page, while a canvas chart would need its colours re-read from CSS and the chart redrawn on every toggle.

The alternatives, with approximate sizes from their published minified builds, were:

| Option | Rendering | Size (minified) | Testable in jsdom | Follows CSS themes |
| --- | --- | --- | --- | --- |
| Chart.js 4 | canvas | about 200 kB | no | no, needs redraw |
| uPlot | canvas | about 50 kB | no | no, needs redraw |
| Apache ECharts 5 | canvas or SVG | about 1 MB | only in SVG mode | partially |
| Own SVG module | SVG | about 6 kB, estimated | yes | yes |

ECharts in SVG mode would pass the testing and theming tests, but at roughly 1 MB it would be the largest file the platform ships, for two chart shapes. The cost of the own module is code to maintain: about 200 lines for a stacked bar chart and a line chart with axes, gridlines, and labels, with no tooltips, zoom, or animation. Those are features this screen does not need, since the data table carries every exact value. If later increments need many more chart types, the decision should be revisited, and the module's two functions are the seam to replace.

Whatever is chosen is served from our own origin, never from a content delivery network (CDN): a third-party CDN would receive the IP address and the page URL of every professional who opens a mental-health dashboard, which no processing agreement covers. `dashboard.html` loads `/js/charts.js` before its inline script; `frontend/test/test_flask_copies.js` gains the `charts.js` pair, and `frontend/test/dashboard_harness.js` inlines it the way it inlines `main.js`.

### The chart module
`charts.js` exposes two functions on `window.AmparaCharts`:

- `stackedBars(container, {categorias, series, total, rotulo})` draws one vertical bar per bucket with one segment per series. When a bucket's `total` is known but some of its segments are `null`, the unknown remainder is drawn as one hatched segment labelled "oculto"; when the whole bucket is suppressed, a full-height hatched placeholder bar of neutral colour carries the text "oculto".
- `lineChart(container, {categorias, valores, rotulo})` draws one line with a marker per point, broken where a value is `null`, with a hatched marker on the axis at that point.

Both render a `<figure>` with a `<figcaption>` holding the title, an `<svg role="img" aria-labelledby>` pointing at a generated summary sentence, a legend in HTML, and a `<table>` with the same data, hidden by default behind a button "Mostrar dados em tabela" / "Ocultar tabela" with `aria-expanded` and `aria-controls`. The table has a `<caption>`, `scope` on headers, and writes a suppressed value as "< 3" followed by visually hidden text "(menos de 3 estudantes, valor ocultado)". Each bar and point also carries an SVG `<title>` with its exact value, so a mouse user gets a native tooltip.

The summary sentence is generated from the data, for example "Registros por semana de 01/07/2026 a 26/10/2026: maior valor 22 na semana de 19/10/2026; 3 semanas ocultadas por terem menos de 3 estudantes." Series colours come from the severity and risk colours already in `styles.css`, the hatching is an SVG `<pattern>` that keeps meaning without colour, and every series is also named in the legend, so no information depends on colour alone. The SVG scales with its `viewBox` to the container width, which at 375 px leaves about 11 px per bar for a 27-week semester, readable for bars, with axis labels thinned to every fourth week.

### The school climate tab
The coordinator's `tabs-nav` gains `#btn-gestor-tab-clima`, "Clima Emocional", controlling `#gestor-tab-clima`, which loads `GET /api/gestao/clima` when first opened and on every filter change.

The summary row has four figures, each a label and a number: "Estudantes", "Em risco crítico", "Em risco moderado", "Registros (14 dias)", the last with "antes: {n}" and the trend word. Under it, `renderRiskFilter` from `0022` and, whenever a filter is active, a line "Mostrando apenas turmas com estudantes em risco {nível}." in an `aria-live="polite"` region. This line is the mitigation `0023` relies on for the presence the filter discloses: a projected screen always says what it was filtered by.

Each class is an `<article>` with its name and shift, a horizontal 100% bar split by risk level (the three segments, or a hatched "oculto" segment covering what the backend hid), the counts in text ("29 leve · moderado e crítico ocultados"), "Registros: 22 (antes: 12), em alta", "Mais registrados: ansiedade (9), tristeza (6)", and a disclosure button "Ver tendência da turma" with `aria-expanded` that renders the class trend below the row. One class trend is open at a time.

States: "Carregando o clima da escola..." while loading; "Nenhuma turma cadastrada." when the school has no class; "Nenhuma turma com estudantes neste nível de risco." when the filter empties the list; "Não foi possível carregar o clima da escola. Tente novamente." with "Tentar novamente" on failure. Whenever `celulas_suprimidas` is non-empty anywhere on screen, a note under the summary reads "Valores referentes a menos de 3 estudantes são ocultados para proteger a identidade dos estudantes."

### The class trend
`renderClassTrend(container, turmaId)` is one component used in the coordinator's class rows and in the teacher's class view. It requests `GET /api/turmas/{id}/tendencia` and renders:

- controls: a `<select>` "Período" with "Semestre atual" (no dates, the backend default), "Últimos 30 dias", and "Últimos 90 dias", computing `de` and `ate` in the browser's local date; and a radio group "Agrupar por" with "Semana" and "Mês";
- a `stackedBars` chart titled "Registros por gravidade", series "Baixa", "Média", "Alta" from `por_gravidade`, with `registros` as the total;
- a `lineChart` titled "Estudantes em risco moderado ou crítico", where each point is `turma.total_estudantes - risco_ao_fim.leve`, and `null` when `leve` is hidden. The backend's complementary suppression guarantees this difference is either hidden or backed by at least 3 students, so the subtraction never reveals what a cell hid.

Loading shows "Carregando tendência..."; a period with no records shows the charts with zero bars and the sentence "Nenhum registro neste período."; failure shows "Não foi possível carregar a tendência. Tente novamente." with a retry button. A 400 from the backend, for example a range too long for weekly grouping, shows its `mensagem` above the charts.

For a `docente`, the class view `#teacher-class-details` gains, below the student grid, a disclosure button "Tendência da turma" that renders the component on first open, so opening a class to record an observation does not cost a chart request.

### Copies
Every change is mirrored under `frontend/src/templates/dashboard.html`, `frontend/src/static/styles.css`, and `frontend/src/static/charts.js`, as `frontend/test/test_flask_copies.js` enforces once extended.

## Testing Decisions
`charts.js` is tested in isolation in jsdom; the screens drive the real `dashboard.html` through `frontend/test/dashboard_harness.js`, extended to inline `charts.js`, with `fetch` doubled per route.

- `frontend/test/test_charts.js`: bar count and relative heights; a partially hidden bucket gets a hatched remainder segment of the right height; a fully suppressed bucket gets a placeholder; the line breaks at `null`; `role="img"` with `aria-labelledby` and the generated summary; the table toggle's `aria-expanded`, the caption, and the "< 3" cells with their hidden text; the legend names every series.
- `frontend/test/test_climate_panel.js`: as `gestor_escolar`, the tab loads the overview; summary figures; class rows in backend order with bar segments, text counts, and trend words; the filter request, the stated-filter line, and the empty filtered state; the suppression note appears only when cells were hidden; loading and error states; one class trend open at a time; the tab is absent for `docente`.
- `frontend/test/test_class_trend.js`: as `docente` and as `gestor_escolar`, period and grouping controls send the right parameters; the risk line computed from `total_estudantes - leve` and broken when `leve` is hidden; a backend 400 `mensagem` shown; the teacher's disclosure requests nothing until opened.
- `frontend/test/test_flask_copies.js` (extended): `src/static/charts.js` mirrors `public/js/charts.js`.

## Out of Scope
- Aggregation, suppression, and the routes, specified in [todo/0023-emotional-climate-dashboards-backend.md](0023-emotional-climate-dashboards-backend.md).
- The risk counts on the teacher's class cards and the risk filter on rosters, specified in [todo/0022-risk-classification-alerts-frontend.md](0022-risk-classification-alerts-frontend.md).
- The monthly report download, specified in [todo/0026-monthly-climate-report-export-frontend.md](0026-monthly-climate-report-export-frontend.md).
- Interactive tooltips, zoom, and animation in the charts.
- Printing the panel; the monthly report is the printable artifact.
