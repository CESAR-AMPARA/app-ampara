# Behavioral Observations and Unified Student History Frontend

*Phase: MVP #1 (backbone). Story-map cards: "As a Teacher, I want to quickly record a behavioral observation about a student" (value 500, 3 points); "As a user, I want to see a student's unified history of observations with period filters to understand their evolution before intervening" (value 800, 3 points); "As a Teacher, I want to refer a student to the coordination with one click from a recorded observation" (value 500, 3 points).*

*This specification defines the screens that record observations and occurrences and show the unified student history. Its backend counterpart is [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), which pins every route and payload used here. It builds on the roster wiring of [todo/0009-unified-dashboard-hardening-frontend.md](0009-unified-dashboard-hardening-frontend.md) and the scoped teacher panel of [todo/0014-teacher-class-assignment-frontend.md](0014-teacher-class-assignment-frontend.md).*

## Problem
Every recording screen in the dashboard is a prototype that forgets. "Salvar Registro" in `#student-modal` pushes into the in-page `mockStudents` arrays and confirms with a blocking `alert()`; the emotion chips toggle a flag on the same arrays; "Registrar Ocorrência" pushes into `localOccurrences` and rewrites the student's log as a high-severity entry. Nothing survives a reload, nothing reaches another user, and the "Linha do Tempo Comportamental" in "Busca & Registros" and the "Histórico de Registros" in the student modal show hardcoded entries.

The microphone button next to the description is worse than unfinished: the "Simulador de Microfone" types canned text into the description while showing "Gravando áudio... fale agora". On a real deployment a teacher would save words they never said into a student's mental-health record.

The referral button that [0009](0009-unified-dashboard-hardening-frontend.md) adds to the student modal asks the teacher to retype the reason, although the observation they just recorded already says it.

## Business Vision and Purposes
Teachers record only if it is faster than not recording: a tap for a quick signal, a short form for anything more, from a phone between classes. Coordinators and psychologists act only on a history they trust, so the history must show exactly what was recorded, by whom, and when, in one place. This spec turns the prototype into that workflow without changing the layout people already reviewed.

## Solution
A teacher opens a student from their class, taps an emotion chip to record a quick signal, or fills type, severity, and an optional description and saves. The modal's history below the form refreshes with the new entry. Each observation in the history has "Encaminhar" for teachers, which opens the referral form pre-filled with that observation. The coordinator records occurrences about a student or a class and sees them in "Ocorrências da Coordenação". In "Busca & Registros", opening a student shows the unified history (observations, occurrences, referrals) with the existing period filter now applied by the backend. The microphone button is removed.

## User Stories
1. As a Docente, I want to tap an emotion chip and see it confirmed, so that I record a signal in two seconds.
2. As a Docente, I want the observation form to save to the server and show the entry in the student's history, so that I know it was recorded.
3. As a Docente, I want to refer a student from one of my observations, so that I do not retype what I already wrote.
4. As a Coordenador Pedagógico, I want to record an occurrence about a student or a class and see the school's occurrences, so that interventions are documented.
5. As any professional, I want the student history filtered by period, with each kind of record clearly marked, so that I read the student's evolution at a glance.
6. As a Docente, I want nothing in the form to write text I did not type, so that the record is mine.

## Implementation Decisions

### Recording an observation
`#form-behavior-log` sends `POST /api/observacoes` through `window.apiRequest` with `estudante_id`, `tipo`, `gravidade`, and `descricao`. The severity radios change their values from `low`/`medium`/`high` to `Baixa`/`Média`/`Alta`, matching the backend vocabulary; labels stay "Baixo", "Médio", "Alto". The submit button is disabled with the label "Salvando..." while the request runs. On 201 the form resets, the toast shows the backend `mensagem`, and the modal's history reloads. On 400 the backend `mensagem` appears under the form in a `role="alert"` element and the form keeps its values. The blocking `alert()` calls in this flow are replaced by these.

The emotion chips on each student card send `POST /api/observacoes` with `registro_rapido: true` and the chip's emotion as `tipo`. Because records are append-only (see `0015`), a chip no longer toggles off. A chip shows as active when its emotion is in the student's `emocoes_recentes`, which `GET /api/estudantes` returns per student (see `0015`), so the class view needs no request beyond the student list. Tapping an active chip records again and confirms with "Novo registro de {emoção} salvo para {primeiro nome}."; the chip's `aria-pressed` reflects "has a recent record", and its `aria-label` reads "Registrar {emoção} para {nome}". After a tap succeeds, the chip turns active locally without reloading the list.

### Removing the simulated microphone
`#btn-voice-input`, `#voice-status`, and the `voiceInterval` simulation are deleted. Real dictation through the browser's Web Speech API was the alternative; in Chrome it streams the audio to Google's servers, which would send what a teacher says about a student's mental health to a third party without a processing agreement. Teachers can still use their phone keyboard's own dictation, a choice they make on their device. The character counter stays.

### Student history component
One renderer, `renderStudentHistory(container, payload)`, draws the history in both the student modal ("Histórico de Registros") and the search tab ("Linha do Tempo Comportamental"), replacing `renderizarLinhaDoTempo` and `renderizarLinhaDeTempoFiltrada`. Each item is a list entry with a badge for its kind ("Observação", "Ocorrência da Coordenação", "Encaminhamento"), the date as `dd/mm/aaaa hh:mm`, the author's name, and the kind's fields. Observation severity keeps the current colour coding, always paired with the text label so colour is never the only signal. A quick record reads "Registro rápido: {emoção}". A referral shows its status, and for coordinators and psychologists its reason.

The period filter `#filter-timeline-days` keeps its options. Choosing one computes `de` and `ate` in the browser's local date and re-requests the history; "Período Personalizado" requests once both dates are filled. The container is `aria-live="polite"` and announces "{n} registros no período." after each load. The empty state reads "Nenhum registro neste período."; a failure reads "Não foi possível carregar o histórico. Tente novamente." with a retry button. "Carregar mais" appears when `total` exceeds the items shown.

### Referral from an observation
For a `docente`, each observation item in the modal's history has a "Encaminhar" button. It opens the referral form `0009` added to the student modal, with the textarea pre-filled with the observation's description (editable), and sends `observacao_id` with the payload. The generic "Encaminhar para Equipe Multidisciplinar" button of `0009` stays for referrals not tied to an observation. A 409 from the backend shows its `mensagem` as a toast and closes the form. A referral item in the history replaces the "Encaminhar" button on its source observation with "Encaminhado", so the teacher sees it went through.

### Coordination occurrences
`#occurrence-modal` sends `POST /api/gestao/ocorrencias`; its student and class selects already read from the roster APIs after `0009`. "Ocorrências da Coordenação" lists `GET /api/gestao/ocorrencias` with a period filter reusing the same options as the timeline, and "Carregar mais" for pagination. `localOccurrences`, the code that copies an occurrence into the student's log, and the hardcoded entries are deleted.

### What is deleted
`mockStudents` and its seeded `logs`, `activeEmotions` toggling, `localOccurrences`, the voice simulation, and the two hardcoded Lucas entries in the search timeline. Every change is mirrored in `frontend/src/templates/dashboard.html`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
All tests drive the real `dashboard.html` through `frontend/test/dashboard_harness.js` with `fetch` doubled per route.

- `frontend/test/test_observation_form.js`: payload and severity values; disabled button during the request; reset, toast, and history reload on 201; inline `role="alert"` message on 400; no `alert()` call.
- `frontend/test/test_emotion_chips.js`: a tap sends a quick record; active state and `aria-pressed` from `emocoes_recentes`; a second tap records again.
- `frontend/test/test_student_history.js`: the three kinds render with their badges and fields; the period options compute `de`/`ate`; the custom range waits for both dates; empty, error, and "Carregar mais" states; the `aria-live` announcement; a `docente` payload without `motivo` renders without it.
- `frontend/test/test_referral_from_observation.js`: "Encaminhar" pre-fills the reason and sends `observacao_id`; 409 handling; "Encaminhado" replaces the button.
- `frontend/test/test_coordination_occurrences.js`: student and class targets, listing, period filter, pagination.
- `frontend/test/test_referral_submission.js` (from `0009`): extended for the optional `observacao_id`.
- An assertion in `test_observation_form.js` that `#btn-voice-input` no longer exists.

## Out of Scope
- Backend routes and the append-only rule, specified in [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md).
- Severity review badges, specified in [todo/0020-observation-severity-review-frontend.md](0020-observation-severity-review-frontend.md).
- Risk indicators on cards and alerts, specified in [todo/0022-risk-classification-alerts-frontend.md](0022-risk-classification-alerts-frontend.md).
- Offline recording when the phone has no connection.
