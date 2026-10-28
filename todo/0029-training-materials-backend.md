# Training Materials Backend

*Phase: Increment #2 (walking skeleton). Story-map card: "As a Pedagogical Coordinator, I want to share training materials with teachers through the platform" (value 300, 2 points).*

*This specification defines the backend of training materials: PDF upload or video link, recipients by class, read confirmations, and the file storage adapter. Its frontend counterpart is [todo/0030-training-materials-frontend.md](0030-training-materials-frontend.md), which can be built against this contract before it ships. It depends on the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md) and the teacher-class assignment of [todo/0013-teacher-class-assignment-backend.md](0013-teacher-class-assignment-backend.md). The `FileStorageAdapter` defined here is shared with [todo/0031-observation-evidence-attachments-backend.md](0031-observation-evidence-attachments-backend.md); whichever of the two ships first introduces it as specified here.*

## Problem
Coordinators train teachers on how to receive a student in crisis, how to talk without promising absolute secrecy, how to record what they see. Today they do it by e-mail attachments and messaging groups, and never know who read what. The dashboard's "Capacitação Docente" tab looks like the answer but stores everything in the browser's `localStorage`: the PDF is never uploaded (only its file name is checked), a material shared by the coordinator exists only on the coordinator's computer, the teacher's "Minha Formação & Capacitação" section shows a seeded list instead, and the "Lido por 3 de 4" metric counts e-mails typed into the same browser.

## Business Vision and Purposes
A teacher who knows how to react to a student's disclosure is the platform's first line of care, and the coordinator is accountable for that preparation. Sharing materials through the platform puts them next to the work they support, reaches every teacher of a class including the ones who join mid-term, and gives the coordinator a reading figure to act on: a reminder in the staff meeting, a second session for those who missed it.

## Solution
The coordinator shares a material with a title and either a PDF file of up to 20 MB or a YouTube or Vimeo link, addressed to one or more classes. Every teacher currently assigned to those classes sees it in their training section, opens the PDF or watches the video inside the platform, and confirms they read it. The coordinator sees, per material, how many recipients confirmed and who has not yet, and can remove a material. Files are stored by the platform and served only to signed-in recipients and coordinators, never through a public link.

## User Stories
1. As a Coordenador Pedagógico, I want to upload a PDF or paste a video link and choose the classes that receive it, so that the right teachers get it in one step.
2. As a Coordenador Pedagógico, I want to see how many recipients confirmed reading and who has not, so that I follow up.
3. As a Coordenador Pedagógico, I want to remove a material that is outdated, so that teachers stop seeing it.
4. As a Docente, I want to see the materials sent to my classes, open them in the platform, and confirm I read them, so that I prepare without hunting through e-mails.
5. As a Docente who joins a class mid-term, I want to receive the materials already shared with it, so that I am not left out of the training.

## Implementation Decisions

### Tenant tables
```
materiais_capacitacao:
  id               INTEGER      primary key
  titulo           VARCHAR(150) not null
  tipo             VARCHAR(10)  not null   -- "pdf" | "video"
  arquivo_chave    VARCHAR(200) null       -- storage key, pdf only
  arquivo_nome     VARCHAR(200) null       -- sanitized original name, pdf only
  arquivo_tamanho  INTEGER      null       -- bytes, pdf only
  video_url        VARCHAR(500) null       -- as pasted, video only
  video_embed_url  VARCHAR(500) null       -- normalized embed URL, video only
  autor_id         INTEGER      not null, references usuarios(id)
  created_at       TIMESTAMP    not null

materiais_destinatarios:
  material_id  INTEGER  not null, references materiais_capacitacao(id) on delete cascade
  turma_id     INTEGER  not null, references turma(id) on delete cascade
  primary key (material_id, turma_id)

materiais_leituras:
  material_id  INTEGER    not null, references materiais_capacitacao(id) on delete cascade
  usuario_id   INTEGER    not null, references usuarios(id)
  lido_em      TIMESTAMP  not null
  primary key (material_id, usuario_id)
```

A check constraint requires the three `arquivo_*` columns when `tipo` is `"pdf"` and the two `video_*` columns when it is `"video"`, and the others `null`.

### Recipients are classes, resolved when read
A material is addressed to classes, and its recipients are the users with `perfil = "docente"` and `status = "Ativo"` assigned to any of those classes in `docente_turma` of `0013` at the moment of the request. A teacher assigned to a class next month sees what was shared with it before; a teacher removed from the class stops seeing it. Snapshotting the recipient list at send time was the alternative, and I rejected it because it would leave out exactly the substitute teachers and mid-term hires who most need the training. The cost is that the reading metric moves when assignments change; a read confirmed by a teacher who later left the class stays in `materiais_leituras` but no longer counts toward that material's figure, since they are no longer a recipient.

### File storage adapter
Files go through a storage port, per [ADR-0002](../adr/0002-infrastructure-adapters-encapsulation.md), defined in `src/storage/adapter.py`:

```python
@runtime_checkable
class FileStorageAdapter(Protocol):
    def put(self, key: str, data: bytes) -> None:
        """Store data under key, replacing nothing: an existing key raises FileExistsError."""
    def get(self, key: str) -> bytes:
        """Return the bytes stored under key; raise StoredFileNotFound when absent."""
    def delete(self, key: str) -> None:
        """Remove the file under key; a missing key is not an error."""
```

`src/adapters/file_storage_local.py` implements it as `LocalFileStorageAdapter(root)`, writing under a root directory outside the static folders, so no file is ever reachable by URL. Keys are generated, never derived from user input: `{tenant_id}/materiais/{uuid4}.pdf`. The tenant prefix keeps each school's files apart on disk, mirroring the database-per-tenant isolation of [0002](0002-multi-tenant-auth-registration-backend.md), and the adapter refuses any key containing `..` or starting with `/`. The root is a configuration value, `file_storage_root`, default `/var/lib/ampara/arquivos`; it is a path, not a secret, so it travels through the `config_overrides` of `create_app` from [0010](0010-backend-foundation-and-delivery-hardening-backend.md) rather than the credentials file.

An object store (S3) adapter was the alternative and is where this goes when the platform runs on more than one host; I chose local disk for the walking skeleton because production is one EC2 host today and the port makes the swap a new adapter, not a refactor. Two deployment requirements come with it and block shipping: the root must be a Docker volume, or every deploy erases the files, and the volume must be included in backups and encrypted at rest, as [0017](0017-lgpd-privacy-compliance-backend.md) already requires of the database volume.

Files are read whole into memory. With a 20 MB ceiling and Gunicorn's 2 workers, the worst case is about 40 MB of buffers, which the host absorbs; streaming would matter only with larger files.

### Accepted content
- PDF: at most 20 MB, and the bytes must start with `%PDF-`; the browser's `Content-Type` and the file extension are ignored, since both are whatever the client says. Twenty megabytes covers an illustrated booklet, while typical guides are 1 to 5 MB (estimate); at a school connection of 10 Mbit/s it uploads in about 16 s. Flask's `MAX_CONTENT_LENGTH` is set to 21 MB for the whole app, leaving room for the form fields, and a JSON handler replaces Flask's HTML 413 page.
- Video: a YouTube or Vimeo URL, normalized to a privacy-enhanced embed URL. `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`, and `youtube.com/embed/ID`, with an 11-character id of `[A-Za-z0-9_-]`, become `https://www.youtube-nocookie.com/embed/ID`; `vimeo.com/NUM`, `vimeo.com/NUM/HASH`, and `player.vimeo.com/video/NUM` become `https://player.vimeo.com/video/NUM?dnt=1`, with `&h=HASH` for unlisted videos. Anything else is refused. The frontend embeds `video_embed_url` in an iframe, so an open URL field would let a compromised coordinator account frame any website inside a page teachers trust; the two hosts match what the prototype already promises ("YouTube/Vimeo"), and the `nocookie` and `dnt` variants keep the platforms from profiling teachers through the embed.

`arquivo_nome` keeps the original file name for display, reduced to letters, digits, spaces, dots, hyphens, and underscores and cut to 200 characters; it is never part of a path.

### Share a material
`POST /api/gestao/materiais` — `gestor_escolar` only, `multipart/form-data` with fields `titulo`, `tipo`, `arquivo` (when `pdf`), `video_url` (when `video`), and `turma_ids` repeated once per class.

Errors, 400 unless noted, all with `"sucesso": false`:

- `"Informe o título do material."` for a missing or blank title.
- `"O título deve ter no máximo 150 caracteres."`
- `"Selecione o tipo de recurso."` for a missing or unknown `tipo`.
- `"Selecione um arquivo PDF."` for `pdf` without a file.
- `"O arquivo deve ser um PDF válido."` when the bytes do not start with `%PDF-`.
- 413 `"O arquivo deve ter no máximo 20 MB."`
- `"Informe o link do vídeo."` for `video` without a URL.
- `"Use um link do YouTube ou do Vimeo."` for a URL that does not normalize.
- `"Selecione pelo menos uma turma."`
- 404 `"Turma informada não encontrada."` for an unknown class id, with nothing stored.

The file is written to storage before the rows are committed; if the commit fails, the file is deleted, so storage never holds a file no row points to. 201:

```json
{"sucesso": true, "mensagem": "Material compartilhado com sucesso.", "id": 7}
```

### Coordinator listing and reading detail
`GET /api/gestao/materiais` — `gestor_escolar` only, newest first:

```json
{
  "materiais": [
    {
      "id": 7,
      "titulo": "Guia de Comunicação Não-Violenta em Crises",
      "tipo": "pdf",
      "created_at": "2026-10-20T12:00:00Z",
      "autor": {"id": 3, "nome": "Coord. Helena Prado"},
      "turmas": [{"id": 1, "nome": "1º Ano A"}, {"id": 2, "nome": "1º Ano B"}],
      "arquivo": {"nome": "guia-cnv.pdf", "tamanho_bytes": 1245184},
      "video_embed_url": null,
      "leitura": {"confirmadas": 9, "destinatarios": 14}
    }
  ]
}
```

`GET /api/gestao/materiais/<int:id>/leituras` — `gestor_escolar` only — lists each current recipient, unread first, then by name:

```json
{
  "material_id": 7,
  "destinatarios": [
    {"id": 15, "nome": "João Lima", "turmas": ["1º Ano B"], "lido_em": null},
    {"id": 12, "nome": "Maria Silva", "turmas": ["1º Ano A"], "lido_em": "2026-10-21T18:40:00Z"}
  ]
}
```

Showing the coordinator which teacher has not read a material is monitoring of employees, so it is limited to what the purpose needs: the confirmation and its date, never when or how often the file was opened. Unknown ids answer 404 `{"sucesso": false, "mensagem": "Material não encontrado."}`.

### Remove a material
`DELETE /api/gestao/materiais/<int:id>` — `gestor_escolar` only. Deletes the rows (cascading to recipients and reads) and then the file. 200 `{"sucesso": true, "mensagem": "Material removido."}`; 404 with the message above. Removal is final: training content has no retention obligation, and keeping a hidden copy would only be one more file to secure.

### Teacher routes
`GET /api/materiais` — `docente` only. Materials addressed to any class the caller is assigned to, newest first, with the caller's own confirmation:

```json
{
  "materiais": [
    {
      "id": 8,
      "titulo": "Acolhimento em crises de ansiedade",
      "tipo": "video",
      "created_at": "2026-10-22T09:00:00Z",
      "arquivo": null,
      "video_embed_url": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "lido_em": null
    }
  ],
  "nao_lidos": 1
}
```

`GET /api/materiais/<int:id>/arquivo` — `docente` recipients and `gestor_escolar`. Answers the PDF bytes with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<arquivo_nome>"`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, and `Cache-Control: no-store`. A material the caller does not receive, a video material, or an unknown id answers 404 with `"Material não encontrado."`, so a teacher cannot probe what other classes received.

`POST /api/materiais/<int:id>/leitura` — `docente` recipients only. Idempotent: the first confirmation's time is kept. 200 `{"sucesso": true, "mensagem": "Leitura confirmada.", "lido_em": "2026-10-22T19:03:00Z"}`; 404 as above. Confirmation is the teacher's own statement, not proof of reading; requiring the file to be downloaded first was considered and dropped, because a download proves nothing more and would not apply to videos.

`equipe_multidisciplinar` gets 403 on every route of this spec.

### Modules, audit, and data protection
The routes live in a blueprint in `src/routes/materiais.py`, delegating to `TrainingMaterialService(session, storage, clock)` in `src/training/service.py`, with URL normalization in `src/training/video_url.py`. None of this is student data, so the routes are listed as unaudited in the route registry of [0027](0027-access-audit-log-backend.md), with the reason "materiais de formação, sem dados de estudantes"; no table joins the anonymization sweep of `0017`. Suspending a teacher under `0011` deletes nothing here; their confirmations stay and count again if they are reactivated.

## Testing Decisions
Routes are exercised through the Flask test client with in-memory tenant databases and a `FakeFileStorage` double in `backend/test/fakes.py`; the local adapter is tested against a temporary directory created in `setUp` and removed through `addCleanup`, since it exists to write files.

- `backend/test/test_storage_adapter.py`: `LocalFileStorageAdapter` and `FakeFileStorage` both satisfy the `runtime_checkable` `FileStorageAdapter` protocol, so the double cannot drift from the port.
- `backend/test/test_adapters_file_storage_local.py`: put, get, delete; `FileExistsError` on overwrite; `StoredFileNotFound`; keys with `..` or a leading `/` refused; files land under the tenant prefix.
- `backend/test/test_training_video_url.py`: each accepted YouTube and Vimeo form normalizes to its embed URL, including unlisted Vimeo hashes; other hosts, malformed ids, and `javascript:` URLs are refused.
- `backend/test/test_training_service.py`: recipients resolved from current assignments, including a teacher added after sharing and one removed; suspended teachers excluded; the reading figure; file deleted when the commit fails; removal deletes rows then file.
- `backend/test/test_routes_materiais.py`: every validation message, including the JSON 413; magic-byte check with a renamed non-PDF; coordinator listing and reading detail; teacher listing and `nao_lidos`; file download headers and the 404 for a non-recipient; idempotent confirmation; `equipe_multidisciplinar` gets 403 everywhere.

## Out of Scope
- The coordinator's sharing tab and the teacher's training section, specified in [todo/0030-training-materials-frontend.md](0030-training-materials-frontend.md).
- Video upload and hosting; videos stay on YouTube or Vimeo.
- Materials for the multidisciplinary team, quizzes, certificates, and reminders by e-mail.
- An object-storage adapter; the port allows it when the platform outgrows one host.
- Malware scanning of uploaded PDFs; the uploader is the coordinator, and the file is served sandboxed.

## Further Notes
The Docker volume and its backup are deployment changes to the `Dockerfile` and the deploy workflow of `0010`, and someone has to own them before this ships; without them, materials disappear on the next deploy.
