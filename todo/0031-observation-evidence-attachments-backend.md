# Observation Evidence Attachments Backend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a user, I want to attach evidence (photos or documents) to records to complement the observation" (value 300, 2 points).*

*This specification defines the backend of evidence attachments on behavioral observations: upload, image sanitization, authorized download, removal, and erasure. Its frontend counterpart is [todo/0032-observation-evidence-attachments-frontend.md](0032-observation-evidence-attachments-frontend.md), which can be built against this contract before it ships. It depends on the observations and history of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md), the scope policy of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md), the anonymization of [todo/0017-lgpd-privacy-compliance-backend.md](0017-lgpd-privacy-compliance-backend.md), and the `AuditLogger` of [todo/0027-access-audit-log-backend.md](0027-access-audit-log-backend.md). It stores files through the `FileStorageAdapter` of [todo/0029-training-materials-backend.md](0029-training-materials-backend.md); whichever of the two specs ships first introduces that adapter as `0029` specifies it.*

## Problem
Some observations are better shown than described: a drawing a student left on a desk, a note passed in class, a page of a notebook with worrying sentences, a medical certificate the family handed in. Today a teacher can only paraphrase them in 500 characters, and the original ends up in a drawer, a phone gallery, or a messaging group, outside any access control. A phone photo also carries more than the picture: its metadata usually holds the GPS coordinates of where it was taken, the date and time, and the device, which for a photo taken at a student's home visit locates the family.

## Business Vision and Purposes
Evidence attached to the record it supports makes the record more useful to the psychologist and more trustworthy as documentation, and it takes the originals out of personal phones and chat groups, where the school cannot control who sees them. That benefit holds only if the files are handled at least as strictly as the text: served only to people who can see the student, never through a link that can be forwarded, stripped of hidden location data, and erased with everything else when the student's data is anonymized.

## Solution
The author of an observation can attach up to three files to it, JPG or PNG images or PDF documents of up to 10 MB each, within 24 hours of recording it. Images are re-encoded on arrival, which removes their location and camera metadata and reduces them to a size that loads on a phone. Everyone who can read the student's history sees the attachments listed under the observation and can open them; every opening is recorded in the audit log, and no attachment has a public or shareable address. The coordinator can remove an attachment that should not be there, such as a photo of the wrong student, with a recorded reason; the record keeps a placeholder saying an attachment was removed. Anonymizing a student deletes their attachments, files and rows.

## User Stories
1. As a Docente, I want to attach a photo or a PDF to an observation I just recorded, so that the psychologist sees the original as well as my summary.
2. As a Docente, I want photos I attach to lose their location data automatically, so that I never expose where a student lives by accident.
3. As any professional allowed to see a student, I want to open the attachments of their observations inside the platform, so that I read the full record.
4. As a Coordenador Pedagógico, I want to remove an attachment that should not be in the record, with a reason, so that a privacy mistake is corrected and the correction is documented.
5. As a family requesting erasure, I want attachments deleted with the rest of the student's data, so that no file about my child remains.

## Implementation Decisions

### Tenant table
```
anexos_observacao:
  id               INTEGER      primary key
  observacao_id    INTEGER      not null, references observacoes(id)
  estudante_id     INTEGER      not null, references estudante(id)   -- copied from the observation
  autor_id         INTEGER      not null, references usuarios(id)
  arquivo_chave    VARCHAR(200) null       -- storage key; null once removed
  nome_original    VARCHAR(200) null       -- sanitized display name; null once removed
  content_type     VARCHAR(30)  not null   -- "image/jpeg" | "image/png" | "application/pdf", as detected
  tamanho_bytes    INTEGER      not null   -- size of the stored file
  sha256           CHAR(64)     not null   -- digest of the stored file
  created_at       TIMESTAMP    not null
  removido_em      TIMESTAMP    null
  removido_por_id  INTEGER      null, references usuarios(id)
  motivo_remocao   TEXT         null       -- at most 300 characters
  index (observacao_id)
  index (estudante_id)
```

`estudante_id` duplicates what the observation already says, so that scope checks, audit entries, and the anonymization sweep reach an attachment without a join. `sha256` is computed on the stored bytes and returned with the metadata, so a copy downloaded for a referral or a child-protection report can be shown to be the file the platform holds.

### Who can attach, and until when
Only the observation's author may attach, only while the student is still in their scope, only within 24 hours of the observation's `created_at`, and never to a quick record (`registro_rapido`). Observations are append-only in [0015](0015-behavioral-observations-backend.md) because a record that changes after a referral undermines it; an attachment changes what the record shows, so it is bound to the moment of recording. Twenty-four hours covers the real flow, a photo taken in class and uploaded from home that evening, while closing the door on evidence added weeks later. Uploading the files inside `POST /api/observacoes` itself was the alternative; I rejected it because it would turn a JSON route into a multipart one for every observation, including one-tap chips, and a failed 10 MB upload would lose the observation with it. The cost is a second request per file, which the frontend makes right after the observation is created.

At most 3 attachments per observation, counting only those not removed. Three covers a front and back of a page and one document; more than that is a case file, which belongs in the referral process of [0006](0006-referral-queue-management-backend.md), not in one observation.

### Accepted files and image sanitization
The type is detected from the first bytes, never from the extension or the client's `Content-Type`: `FF D8 FF` for JPEG, the 8-byte PNG signature, `%PDF-` for PDF. Anything else, including HEIC photos from iPhones, is refused with a message naming the accepted types. iOS usually converts HEIC to JPEG when the page's file input accepts only JPEG and PNG, which the frontend does; that conversion is unverified across iOS versions, so the message also tells the user what to send.

Every image is decoded and re-encoded by `PillowImageSanitizer.sanitize(data, content_type) -> bytes` in `src/adapters/image_sanitizer_pillow.py`, the only module that imports Pillow, behind the `ImageSanitizer` protocol defined next to the service in `src/attachments/service.py`, per [ADR-0002](../adr/0002-infrastructure-adapters-encapsulation.md). It applies the orientation recorded in the Exchangeable Image File Format (EXIF) metadata first, so a portrait photo does not end up sideways; scales the image down to at most 2,048 px on its longest side; and writes a new JPEG at quality 85, or a new PNG, with no EXIF, XMP, IPTC, or ICC data. Re-encoding was chosen over deleting EXIF tags in place because it also drops XMP and maker notes that tag-stripping misses, and any bytes appended after the image data, which is how a file can be an image and something else at once. The downscale turns a typical 3 to 5 MB phone photo into roughly 300 to 600 kB (estimate), which matters on the school's mobile connections. Images above 50 megapixels are refused before decoding, as a guard against decompression bombs; Pillow's own limit is raised to an error rather than a warning.

PDFs are stored as received. Their metadata may carry an author or software name, but rewriting PDFs safely needs another library and changes the document a professional may need to present as received; stripping it is noted in _Further Notes_.

Pillow is the same library fpdf2 brings in for [0025](0025-monthly-climate-report-export-backend.md); whichever spec ships first adds it to `requirements.txt`.

### Upload an attachment
`POST /api/observacoes/<int:id>/anexos` — `docente` and `gestor_escolar`, `multipart/form-data` with one file in the field `arquivo`. One file per request keeps each upload independently retryable.

Errors, all with `"sucesso": false`:

- 404 `"Registro não encontrado."` for an unknown observation or one whose student is outside the caller's scope.
- 403 `"Somente o autor do registro pode anexar evidências."`
- 400 `"Registros rápidos não aceitam anexos."`
- 409 `"O prazo de 24 horas para anexar evidências a este registro terminou."`
- 409 `"Este registro já possui o máximo de 3 anexos."`
- 400 `"Selecione um arquivo."`
- 400 `"Envie imagens JPG ou PNG, ou documentos PDF."`
- 413 `"O arquivo deve ter no máximo 10 MB."`
- 400 `"Não foi possível processar a imagem. Envie outro arquivo."` for an image Pillow cannot decode or one over the pixel limit.

The 10 MB limit applies to the upload, before sanitization; Flask's app-wide `MAX_CONTENT_LENGTH` is the largest per-route limit plus 1 MB for form overhead, 21 MB once `0029` has shipped and 11 MB before. The file is written to storage under `{tenant_id}/anexos/{uuid4}` before the row is committed, and deleted if the commit fails. 201:

```json
{
  "sucesso": true,
  "mensagem": "Anexo enviado com sucesso.",
  "anexo": {
    "id": 52,
    "nome": "desenho-caderno.jpg",
    "content_type": "image/jpeg",
    "tamanho_bytes": 418332,
    "sha256": "9f2c1e5b7a0d4c3e8b6a1f0e2d4c6b8a9e7f5d3c1b0a2e4f6d8c0b1a3e5f7d9c",
    "created_at": "2026-10-26T15:10:00Z"
  }
}
```

`nome` is the original file name reduced to letters, digits, spaces, dots, hyphens, and underscores and cut to 200 characters, with the extension corrected to the detected type. It is display text only, never part of a path.

### Attachments in the student history
Observation items of `GET /api/estudantes/<id>/historico` gain `anexos` and `pode_anexar`, for every profile that already receives the item:

```json
{
  "tipo_registro": "observacao",
  "id": 311,
  "anexos": [
    {"id": 52, "nome": "desenho-caderno.jpg", "content_type": "image/jpeg", "tamanho_bytes": 418332, "sha256": "9f2c1e5b...", "created_at": "2026-10-26T15:10:00Z", "removido": false},
    {"id": 49, "removido": true, "removido_em": "2026-10-26T16:00:00Z", "removido_por": {"id": 3, "nome": "Coord. Helena Prado"}}
  ],
  "pode_anexar": true
}
```

The other fields of the item are those of `0015` and [0019](0019-observation-severity-review-backend.md), unchanged. A removed attachment stays in the list as a placeholder without its name, so the record shows that something was removed and by whom; `motivo_remocao` appears on the placeholder only for `gestor_escolar`, since the reason may describe the mistake ("foto de outro estudante"). `pode_anexar` is true when the caller is the author, the observation is not a quick record, it is less than 24 hours old, and it has fewer than 3 attachments, so the frontend does not re-implement the rule.

### Download an attachment
`GET /api/anexos/<int:id>` — every profile whose `ScopePolicy` includes the attachment's student. It answers the stored bytes with the stored `Content-Type`, `Content-Disposition: attachment; filename="<nome>"`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, and `Cache-Control: no-store`.

- 404 `{"sucesso": false, "mensagem": "Anexo não encontrado."}` for an unknown id, a removed attachment, a student outside the caller's scope, or a file missing from storage.

There is no other way to reach a file: no static path, no public bucket URL, and no signed URL. A signed URL was the alternative, and it would make images load with a plain `<img src>`; I rejected it because such a URL works for anyone who has it until it expires, ends up in browser history and in forwarded messages, and bypasses both the scope check and the audit log at the moment of access. The frontend fetches the bytes with the bearer token and displays them through an object URL instead.

Every successful download calls `AuditLogger.registrar` with `acao` `"baixar_anexo"`, `recurso` `"anexo:<id>"`, and the `estudante_id`; an out-of-scope request on an existing attachment writes `"acesso_negado"` as `0027` specifies. Uploading writes `"anexar_evidencia"` and removal `"remover_anexo"`, with the same `recurso`. The three actions join the registry of `0027` with the descriptions "Baixou um anexo de observação", "Anexou evidência a uma observação", and "Removeu um anexo de observação".

### Remove an attachment
`POST /api/gestao/anexos/<int:id>/remover` — `gestor_escolar` only.

```json
{"motivo": "Foto mostra o rosto de outro estudante."}
```

- 400 `{"sucesso": false, "mensagem": "Informe o motivo da remoção."}` for a missing or blank reason; 400 `{"sucesso": false, "mensagem": "O motivo deve ter no máximo 300 caracteres."}`.
- 404 `{"sucesso": false, "mensagem": "Anexo não encontrado."}`.
- 409 `{"sucesso": false, "mensagem": "Este anexo já foi removido."}`.
- 200 `{"sucesso": true, "mensagem": "Anexo removido."}`.

Removal deletes the file from storage first, then sets `arquivo_chave` and `nome_original` to `null` and records `removido_em`, `removido_por_id`, and `motivo_remocao`. It is the one exception to the append-only rule on observations, and a deliberate one: a photo of the wrong student, or one showing a student's face or body, is a privacy incident that the record must not keep, while the placeholder and the audit entry keep the correction itself on record. Only the coordinator removes, because letting authors delete their own evidence would reopen the edit window that `0015` closed. A removal that fails after the file was deleted leaves a row pointing at a missing file, which downloads as 404 and can be removed again; erring toward erasure is the safer failure.

### Anonymization and export
The composition root registers the table with the sweep of `0017` in two ways: `registrar_tabela("anexos_observacao", ["nome_original", "motivo_remocao"], "estudante_id")`, which satisfies the registry test, and `registrar_passo(...)` with a step that deletes every file of the student from storage and then every `anexos_observacao` row of the student. Attachments are deleted rather than kept as structured rows because nothing about a file is useful to statistics, and an image cannot be anonymized by blanking a column. The step deletes files before rows, inside the anonymization transaction, so a rolled-back anonymization can leave rows without files but never files without rows; the coordinator retries, and the second run finds the rows and finishes.

The student export of `0017` adds, to each observation, the list of its attachments' metadata (`nome`, `content_type`, `tamanho_bytes`, `sha256`, `created_at`, and removal data). Files are not embedded in the JSON; when a family's access request includes the originals, the coordinator downloads them through the route above, and that download is audited.

### Modules
`src/attachments/service.py` defines `AttachmentService(session, storage, sanitizer, scope_policy, audit, clock)` holding the rules above; `src/attachments/file_types.py` detects types from bytes; the routes live in a blueprint in `src/routes/anexos.py`. Everything is wired in `create_app`, per [ADR-0001](../adr/0001-nothing-resolves-at-import-time.md).

Storage grows with use. At an estimated 5% of 20,000 yearly observations carrying two files of about 1 MB after sanitization, a school adds about 2 GB a year; this is a guess to size the volume, not a measurement, and disk usage of the storage volume should be monitored from the first month.

## Testing Decisions
Routes are exercised through the Flask test client with in-memory tenant databases, the `FakeFileStorage` double of `0029`, and a fixed clock; the Pillow adapter runs against small committed fixture images under `backend/test/fixtures/anexos/`, including a JPEG with GPS EXIF and a rotated orientation tag.

- `backend/test/test_attachments_file_types.py`: detection of each accepted type and refusal of HEIC, GIF, and a PDF renamed `.jpg` or the reverse.
- `backend/test/test_adapters_image_sanitizer_pillow.py`: the output has no EXIF, GPS, or XMP; orientation is applied; the long side is at most 2,048 px; PNG stays PNG; trailing appended bytes are gone; an image over 50 megapixels is refused.
- `backend/test/test_attachments_service.py`: author-only, 24-hour window, quick-record refusal, 3-file cap ignoring removed ones, storage cleanup on a failed commit, removal order, the anonymization step deleting files and rows.
- `backend/test/test_routes_anexos.py`: every message of the three routes, including the JSON 413; download headers; 404 for out-of-scope, removed, and missing files; audit entries for upload, download, denied access, and removal; `equipe_multidisciplinar` can download within its scope and cannot upload or remove.
- `backend/test/test_api_estudante_historico.py` (from `0015`, extended): `anexos` and `pode_anexar` per profile; the removal reason only for the coordinator.
- `backend/test/test_lgpd_anonymizer.py` (from `0017`, extended): a student's attachments, files and rows, are gone after anonymization, and other students' attachments are untouched.

## Out of Scope
- Upload controls, viewer, and removal dialog, specified in [todo/0032-observation-evidence-attachments-frontend.md](0032-observation-evidence-attachments-frontend.md).
- Attachments on coordination occurrences and referrals.
- Video and audio files.
- Malware scanning of PDFs; files are served as downloads with `nosniff` and a sandbox policy, and a scanner (ClamAV) can be added behind the service later.
- Face detection or blurring in photos.

## Further Notes
Photos of students are images of minors, which the Statute of Children and Adolescents (ECA, art. 17) and art. 14 of the General Data Protection Law (LGPD) protect beyond ordinary personal data. The product owner, with the schools' encarregados, should decide whether the platform forbids photos that show a student's face or body. This spec cannot enforce such a rule technically; the frontend states it next to the upload, and the coordinator's removal route is the remedy when it is broken.

Stripping PDF metadata needs a PDF library (pypdf) and a decision on whether a rewritten document is still acceptable as evidence. I left it out of this increment.
