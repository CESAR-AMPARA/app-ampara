# Observation Evidence Attachments Frontend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a user, I want to attach evidence (photos or documents) to records to complement the observation" (value 300, 2 points).*

*This specification defines the attachment controls of the observation form, the attachment list and viewer in the student history, and the coordinator's removal dialog. Its backend counterpart is [todo/0031-observation-evidence-attachments-backend.md](0031-observation-evidence-attachments-backend.md), which pins every route, limit, payload, and message used here; this spec can be built against that contract before it ships. It extends the observation form and history renderer of [todo/0016-behavioral-observations-frontend.md](0016-behavioral-observations-frontend.md) and uses the `apiDownload` and `saveBlob` helpers specified in [todo/0026-monthly-climate-report-export-frontend.md](0026-monthly-climate-report-export-frontend.md), introducing them if this spec ships first.*

## Problem
The observation form in the student modal takes only text. A teacher who has a drawing, a note, or a document that shows what they saw can only describe it in 500 characters, and the photo they took stays in their phone gallery, where it is neither part of the record nor under the school's control. The history has nowhere to show such a file, and nothing tells a teacher that a photo of a student's face does not belong in the record.

## Business Vision and Purposes
Attaching evidence has to fit the same ten-second habit as recording: pick the photo while filling the form, save once. Reading it has to be as private as the record itself, opened on demand inside the platform, never through a link that can travel. The screen also has to teach the rule the technology cannot enforce: photograph the material, not the student.

## Solution
The observation form gains an optional "Anexar evidências" field accepting up to three JPG, PNG, or PDF files of up to 10 MB each, with a short warning about photographing students and a note that photo location data is removed. Saving records the observation and then uploads the files one by one, reporting any file that failed and how to retry. In the history, each observation lists its attachments; images open in a viewer inside the page and PDFs download, both only when the user asks. The author can add files to their own observation for 24 hours. The coordinator can remove an attachment with a reason, after which the history shows that it was removed.

## User Stories
1. As a Docente, I want to attach photos or a PDF while recording an observation, so that saving once records everything.
2. As a Docente, I want to be warned not to photograph students and told that location data is removed, so that I attach evidence without exposing anyone.
3. As a Docente, I want to know which file failed to upload and retry it later, so that a bad connection does not lose my evidence.
4. As any professional allowed to see a student, I want to open an attachment only when I choose, so that I am not shown images I did not ask for.
5. As a Coordenador Pedagógico, I want to remove an attachment with a reason, so that a privacy mistake is corrected on the record.

## Implementation Decisions

### Attachment field in the observation form
`#form-behavior-log` of `0016` gains, under the description, a field labelled "Anexar evidências (opcional)": an `<input type="file" multiple>` with `accept="image/jpeg,image/png,application/pdf"` and no `capture` attribute, so a phone offers both the camera and the gallery. Below the label, the hint "Até 3 arquivos JPG, PNG ou PDF, com até 10 MB cada. A localização e outros dados ocultos das fotos são removidos automaticamente." and, in the warning style, "Não fotografe o rosto ou o corpo de estudantes. Fotografe o material: desenho, bilhete, página de caderno." The field is hidden when the form is used for a quick record, which accepts no attachment.

Chosen files appear as a list of "{nome} · {tamanho}" items, each with a "Remover {nome}" button, before anything is sent. The browser checks what it can: more than 3 files, a type outside the three, and a size over 10 MB are refused at selection with the same messages the backend uses ("Este registro já possui o máximo de 3 anexos.", "Envie imagens JPG ou PNG, ou documentos PDF.", "O arquivo deve ter no máximo 10 MB."), shown in a `role="alert"` element under the field. The backend still checks the bytes; the browser check only spares a teacher a long upload that would be refused.

### Saving with attachments
Submitting sends `POST /api/observacoes` exactly as `0016` does. On 201, and only then, each chosen file is uploaded in turn to `POST /api/observacoes/{id}/anexos` as a `FormData` with the field `arquivo`, through `window.apiRequest` without a `Content-Type` header. Sequential uploads keep at most one large request per teacher on a server that runs 2 sync workers, and make each failure attributable to one file. The submit button reads "Enviando anexos ({i} de {n})..." during the uploads.

When every upload succeeds, the toast reads "{mensagem do registro} {n} anexo(s) enviado(s)." When some fail, the observation stays recorded and the form closes as usual, and the toast reads "Observação registrada, mas {k} de {n} anexos não foram enviados. Você pode tentar novamente pelo histórico nas próximas 24 horas.", while the history, reloaded as `0016` specifies, lists each failed file name with the backend `mensagem` in a `role="alert"` region above the items until the modal closes. Rolling back the observation when an upload fails was not an option, since observations cannot be deleted, and it would also be wrong: the text the teacher wrote is the primary record.

### Attachments in the history
`renderStudentHistory` of `0016` renders, under each observation with a non-empty `anexos`, a list headed "Anexos". Each item shows a type label ("Imagem" or "PDF"), the name, and the size in kB or MB, with:

- "Visualizar" for an image, which opens `#attachment-viewer`;
- "Baixar" for a PDF, which fetches `GET /api/anexos/{id}` through `apiDownload` and saves it through `saveBlob`.

Nothing is fetched until the user clicks. Loading thumbnails with the history was the alternative, and I rejected it twice over: every history view would download every image, megabytes on a phone connection, and would write a `"baixar_anexo"` entry to the audit log of [0027](0027-access-audit-log-backend.md) for files nobody chose to look at, which makes the log say something false. The API URL is never put in an `<img src>` or a link, since it would not carry the bearer token and must not become a shareable address.

A removed attachment reads "Anexo removido pela coordenação em {dd/mm/aaaa} por {nome}", and, for the coordinator only, "Motivo: {motivo_remocao}" below it.

When `pode_anexar` is true, the item shows "Adicionar anexo", which opens a single-file picker with the same `accept`, checks, and warning, uploads on selection, and re-renders the history on success; the backend `mensagem` is shown in the toast on failure. Because the flag comes from the backend, the button disappears on its own after 24 hours, after the third file, or for anyone who is not the author.

### Image viewer
`#attachment-viewer` is a dialog with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at a heading with the file name, closing on Escape, on a backdrop click, and on "Fechar", and returning focus to the "Visualizar" button, as `#referral-triage-modal` does. On open it shows "Carregando imagem...", fetches the bytes through `apiDownload`, and shows `<img alt="Anexo da observação: {nome}">` from an object URL, scaled to fit the viewport. The dialog also has "Baixar", which saves the same blob without a second request. On close, the object URL is revoked and the `<img>` removed, so the image does not stay in memory after the user is done. A failure shows the backend `mensagem`, or "Não foi possível abrir o anexo. Tente novamente.", inside the dialog.

### Removal by the coordinator
For `gestor_escolar`, each attachment that is not removed has "Remover anexo", which opens a dialog with the same semantics as the viewer. It reads "O arquivo será apagado definitivamente. O histórico mostrará que um anexo foi removido, por quem e quando." and has a required textarea "Motivo da remoção" with a counter "0 / 300 caracteres", and the buttons "Remover anexo" and "Cancelar". Confirming sends `POST /api/gestao/anexos/{id}/remover` with `{"motivo": "..."}`; on 200 the toast shows the backend `mensagem` and the history re-renders with the placeholder; on 400 the `mensagem` appears in the dialog in a `role="alert"` element; on 409 the toast shows the `mensagem` and the history re-renders.

### Copies
Every change is mirrored under `frontend/src/templates/dashboard.html` and `frontend/src/static/styles.css`, as `frontend/test/test_flask_copies.js` enforces. The camera behaviour of the file input on Android and iOS is checked by hand once, since jsdom has no camera and since the `Permissions-Policy: camera=()` header of [0010](0010-backend-foundation-and-delivery-hardening-backend.md) is expected to affect only in-page camera access, not the operating system's picker (unverified).

## Testing Decisions
All modules drive the real `dashboard.html` through `frontend/test/dashboard_harness.js` with `fetch` doubled per route, `FormData` bodies recorded, `blob()` supported, and `URL.createObjectURL` and `URL.revokeObjectURL` stubbed.

- `frontend/test/test_attachment_upload.js`: the field, hint, and warning render, and are hidden for quick records; selection checks for count, type, and size with the backend's messages; removing a chosen file; no upload is sent unless the observation returns 201; uploads are sequential with the progress label; full success and partial failure toasts; failed file names listed with their messages; "Adicionar anexo" appears only when `pode_anexar` is true and uploads one file.
- `frontend/test/test_attachment_viewer.js`: nothing is fetched when the history renders; "Visualizar" fetches with the bearer token and shows the image with its `alt`; "Baixar" in the viewer reuses the blob; PDFs download through `saveBlob`; the object URL is revoked on close; dialog semantics, Escape, backdrop, and focus return; error state; no element in the history has an `src` or `href` pointing at `/api/anexos/`.
- `frontend/test/test_attachment_removal.js`: the button exists only for `gestor_escolar`; the reason is required with the counter; confirm sends the payload and re-renders with the placeholder; the reason is shown on placeholders only to the coordinator; 400 and 409 handling.

## Out of Scope
- Validation, sanitization, storage, download authorization, and erasure, specified in [todo/0031-observation-evidence-attachments-backend.md](0031-observation-evidence-attachments-backend.md).
- Image editing, cropping, or blurring in the browser.
- Attachments on occurrences and referrals.
- Upload progress within a single file; `fetch` does not expose it.
