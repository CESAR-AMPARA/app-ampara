# Training Materials Frontend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a Pedagogical Coordinator, I want to share training materials with teachers through the platform" (value 300, 2 points).*

*This specification wires the coordinator's "Capacitação Docente" tab and the teacher's "Minha Formação & Capacitação" section to the server. Its backend counterpart is [todo/0029-training-materials-backend.md](0029-training-materials-backend.md), which pins every route, payload, and message used here; this spec can be built against that contract before it ships. It uses the coordinator's class listing of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md) and the `apiDownload` helper specified in [todo/0026-monthly-climate-report-export-frontend.md](0026-monthly-climate-report-export-frontend.md), introducing that helper if this spec ships first.*

## Problem
Both training screens are a `localStorage` prototype. The coordinator's "Compartilhar Material Formativo" form checks that a PDF was chosen but never uploads it, saves the material into the coordinator's own browser under `materiaisCapacitacao`, and lists four hardcoded classes with invented teacher names as recipients. The teacher's "Minha Formação & Capacitação" reads the same key from the teacher's browser, so it shows the seeded `materiaisIniciais` instead of anything the coordinator sent, finds the teacher's class through a hardcoded e-mail list, and offers a PDF card whose click shows a toast and a fake "Tamanho: 1.2 MB". The "Lido por 3 de 4" metric counts e-mails written into one browser. Any video URL is put straight into an iframe.

## Business Vision and Purposes
Coordinators should be able to send a guide to the teachers of the classes that need it and see the next day who has read it, without leaving the platform. Teachers should find every material sent to their classes in one place, open it on a phone between lessons, and confirm with one tap.

## Solution
The coordinator's tab keeps its two-column layout. On the left, the form uploads a real PDF of up to 20 MB or accepts a YouTube or Vimeo link, and lists the school's real classes with their assigned teachers as recipients, with "Selecionar todas". On the right, each shared material shows its classes and "Leitura confirmada por {n} de {total}", with "Ver leituras" listing who confirmed and who has not, and "Remover". The teacher's section lists the materials sent to their classes, unread first, embeds videos through the privacy-enhanced player, opens PDFs in a new tab, and has "Confirmar leitura" on each. The sidebar entry shows how many materials are unread.

## User Stories
1. As a Coordenador Pedagógico, I want to upload a PDF or paste a video link and tick the classes that receive it, so that sharing takes one form.
2. As a Coordenador Pedagógico, I want to see each class with its teachers when choosing recipients, so that I know who will get the material.
3. As a Coordenador Pedagógico, I want to see who confirmed reading and who has not, so that I follow up with the right people.
4. As a Docente, I want an unread count next to "Formação & Capacitação", so that I notice new material.
5. As a Docente, I want to open a PDF or watch a video inside the platform and confirm with one tap, so that training fits between lessons.

## Implementation Decisions

### Coordinator: sharing form
`#form-share-material` keeps its fields and their copy. Recipients come from `GET /api/turmas`, whose coordinator response carries `docentes` per class (see `0013`): each checkbox reads "{turma.nome} ({nomes dos docentes})", or "{turma.nome} (sem professor vinculado)" in muted text when the list is empty. Such a class stays selectable, since teachers assigned later will receive the material, but the label tells the coordinator nobody gets it today. Above the list, a "Selecionar todas" checkbox toggles every class and reflects a partial selection with `indeterminate`. The four hardcoded checkboxes and their invented names are deleted.

The PDF input keeps `accept="application/pdf"` and gains the hint "PDF de até 20 MB". Before sending, the form checks in the browser what can be checked cheaply: a title, a file or a URL by type, at least one class, and a file size of at most 20 MB, with the messages the backend uses for the same cases, so the coordinator does not wait for a 20 MB upload to be told the file is too large. The submit builds a `FormData` with `titulo`, `tipo`, `arquivo` or `video_url`, and one `turma_ids` entry per class, and sends it through `window.apiRequest` with method `POST` and no `Content-Type` header, so the browser sets the multipart boundary.

While the request runs, the button reads "Enviando material..." and is disabled; a 20 MB file over a 10 Mbit/s school connection takes about 16 s, and `fetch` reports no upload progress, so a changing label is the honest feedback. On 201 the toast shows the backend `mensagem`, the form resets to PDF with no class ticked, and the list on the right reloads. On 400, 404, or 413 the backend `mensagem` appears under the form in a `role="alert"` element and the fields keep their values.

### Coordinator: shared materials and readings
The right column loads `GET /api/gestao/materiais`. Each material is an `<article>` with the type badge ("PDF" or "Vídeo"), the date as `dd/mm/aaaa`, the title, "Turmas: {nomes}", "Leitura confirmada por {confirmadas} de {destinatarios}", and two buttons:

- "Ver leituras" is a disclosure (`aria-expanded`, `aria-controls`) that loads `GET /api/gestao/materiais/{id}/leituras` on first open and lists each recipient as "{nome} · {turmas}" with "Confirmou em {dd/mm/aaaa}" or "Ainda não confirmou". With no recipients it reads "Nenhum professor vinculado às turmas deste material."
- "Remover" opens a confirmation dialog (`role="dialog"`, `aria-modal`, `aria-labelledby`, Escape and backdrop close, focus returned to the button, as `#referral-triage-modal` does) reading "Remover o material “{título}”? Os professores deixarão de vê-lo e as confirmações de leitura serão apagadas." with "Remover material" and "Cancelar". Confirming sends `DELETE /api/gestao/materiais/{id}`, shows the backend `mensagem`, and reloads the list.

States: "Carregando materiais..."; the existing empty copy "Nenhum material de capacitação compartilhado até o momento."; "Não foi possível carregar os materiais. Tente novamente." with "Tentar novamente".

### Teacher: training section
`#panel-professor-capacitacao` loads `GET /api/materiais` when opened, and the sidebar button `#btn-sidebar-capacitacao` shows `nao_lidos` as a badge, with the accessible name "Formação & Capacitação, {n} não lidos". The count is loaded with the teacher panel, so it is visible before the section is opened. Materials are listed unread first, then newest first.

A video card embeds `video_embed_url` in an `<iframe>` with `title="Vídeo: {título}"`, `loading="lazy"`, `allow="fullscreen"`, `referrerpolicy="strict-origin-when-cross-origin"`, and `sandbox="allow-scripts allow-same-origin allow-presentation"`. Only the backend's normalized URL is ever used as `src`; the prototype's iframe of a raw `mat.link` is deleted. A PDF card shows the file name and size from `arquivo` ("guia-cnv.pdf · 1,2 MB") and an "Abrir PDF" button. The click opens an empty tab synchronously, then fetches `GET /api/materiais/{id}/arquivo` through `apiDownload` and points the tab at an object URL of the blob; opening the tab only after the fetch resolves would be blocked as a pop-up by most browsers, since it no longer runs inside the user's click. If the fetch fails, the empty tab is closed and the toast shows the backend `mensagem`. The object URL is revoked after 60 s, long enough for the browser's viewer to load it.

"Confirmar leitura" sends `POST /api/materiais/{id}/leitura`; on 200 the button is replaced by "Você confirmou a leitura em {dd/mm/aaaa}", the sidebar badge decrements, and focus moves to that text. Already-confirmed materials show the same text from `lido_em`.

States: "Carregando materiais..."; the existing empty copy "Nenhum material de capacitação compartilhado com sua turma ainda."; "Não foi possível carregar os materiais. Tente novamente." with "Tentar novamente".

### What is deleted
Every read and write of `localStorage` key `materiaisCapacitacao` (through `lerMateriais()` and the read-confirmation handler) and the fake PDF card and its toast. `0009` already removed `materiaisIniciais`, `obterClasseDoProfessorLogado`, and the hardcoded recipient checkboxes, which now come from `GET /api/turmas`. A one-time cleanup removes the `materiaisCapacitacao` key from `localStorage` on dashboard load, so the old prototype data does not linger in browsers that ran it. Every change is mirrored under `frontend/src/templates/dashboard.html`, as `frontend/test/test_flask_copies.js` enforces.

## Testing Decisions
Both modules drive the real `dashboard.html` through `frontend/test/dashboard_harness.js` with `fetch` doubled per route; the harness's `fetch` double records `FormData` bodies and supports `blob()`, and `window.open` and `URL.createObjectURL` are stubbed.

- `frontend/test/test_training_materials_coordinator.js`: recipients from `GET /api/turmas` with teacher names and the "sem professor vinculado" label; "Selecionar todas" and its indeterminate state; client-side checks with the backend's messages, including the 20 MB limit; the `FormData` fields and repeated `turma_ids`; the sending label; backend errors inline; list rendering with the reading figure; "Ver leituras" loads once and renders both states; the removal dialog's semantics, cancel, and confirm; no `localStorage` access for `materiaisCapacitacao` remains, and the key is removed on load.
- `frontend/test/test_training_materials_teacher.js`: as `docente`, the sidebar badge and its accessible name; ordering; the video iframe uses only `video_embed_url` with its `title` and `sandbox`; "Abrir PDF" opens the tab before fetching, sets it to the object URL, and closes it on failure; confirming replaces the button, decrements the badge, and moves focus; empty and error states.

## Out of Scope
- Storage, validation, recipients, and metrics, specified in [todo/0029-training-materials-backend.md](0029-training-materials-backend.md).
- The "Biblioteca de Apoio Psicossocial" guides and their `favoritosBiblioteca` favourites, which stay static.
- Upload progress bars; `fetch` does not expose upload progress, and a hand-written `XMLHttpRequest` path for one form is not worth its tests.
