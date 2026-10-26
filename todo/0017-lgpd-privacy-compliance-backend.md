# LGPD Privacy Compliance Backend

*Phase: MVP #1 (backbone). Story-map card: "As a user, I want my data and the students' data to be handled according to the LGPD to guarantee full privacy" (value 800, 3 points).*

*This specification defines the backend of terms versioning, the privacy notice data, and the student data-subject rights (access and erasure). Its frontend counterpart is [todo/0018-lgpd-privacy-compliance-frontend.md](0018-lgpd-privacy-compliance-frontend.md). It depends on [todo/0002-multi-tenant-auth-registration-backend.md](0002-multi-tenant-auth-registration-backend.md), [todo/0011-access-management-backend.md](0011-access-management-backend.md), and the tables of [todo/0015-behavioral-observations-backend.md](0015-behavioral-observations-backend.md) and [todo/0006-referral-queue-management-backend.md](0006-referral-queue-management-backend.md).*

## Problem
App A.M.P.A.R.A. processes sensitive personal data (health and behavior, art. 11 of the General Data Protection Law, LGPD) about adolescents (art. 14), and the only LGPD mechanism the specs define is two checkboxes at registration. The acceptance is stored as a boolean, so when the terms change nobody can tell who accepted which text, and nobody is asked again. There is no privacy notice anywhere in the product that says who the controller is, what the data is used for, or whom to contact. When a family asks the school what the platform holds about their child, or asks for it to be erased after the student leaves, the coordinator has no way to answer: the data sits across observations, occurrences, and referrals, and the only "delete" is a database console.

## Business Vision and Purposes
Schools adopt the platform only if they can show their data protection officer (the encarregado) and the families that the LGPD's rights are honoured in practice: transparency about what is processed, a record of each professional's acceptance, and a working path for a data subject's access and erasure requests (art. 18). This spec makes those three things product features rather than promises on the login page.

## Solution
Each professional's acceptance records which version of the terms they accepted and when. When the terms change, the next login asks them to accept the new version before any student data loads. Every school has a privacy notice reachable before registration, naming the school as controller and its encarregado as the contact. The Gestor Escolar can export everything the platform holds about one student as a file, to answer an access request, and can irreversibly anonymize a student, to answer an erasure request or when the student leaves the school. Anonymization removes identity and free text and keeps only the structured counts that school-level statistics need.

## User Stories
1. As a professional, I want to be asked to accept updated terms, so that I know when the rules for handling student data changed.
2. As a Gestor Escolar, I want proof of which terms version each professional accepted and when, so that I can show it to the encarregado or an auditor.
3. As a family member or professional, I want to read who is responsible for the data and how to contact them before anyone registers, so that the processing is transparent.
4. As a Gestor Escolar answering an access request, I want to export everything stored about a student, so that I hand the family a complete copy.
5. As a Gestor Escolar answering an erasure request or a transfer, I want to anonymize a student irreversibly, so that their identity and narratives leave the platform.
6. As the platform, I want application logs to carry no student data, so that a log leak is not a data leak.

## Implementation Decisions

### Terms versioning
`src/lgpd/terms.py` holds `TERMOS_VERSAO_ATUAL`, a date string such as `"2026-11-01"`, bumped in the same commit that changes the terms text in [0018](0018-lgpd-privacy-compliance-frontend.md). The tenant `usuarios` table gains `termos_versao VARCHAR(10) not null` and `termos_aceitos_em TIMESTAMP not null`; `POST /api/cadastro` of `0002` stores the current version and the time alongside `aceite_lgpd` and `aceite_sigilo`, and accepts a `termos_versao` field that must equal the current version, else 400 `{"sucesso": false, "mensagem": "Os termos foram atualizados. Recarregue a página e leia a nova versão."}`.

The successful login response of `0002` gains `"termos_pendentes": true | false`. While it is true, the guard of `0011` answers every guarded route except `POST /api/termos/aceite` with 403:

```json
{"sucesso": false, "status": "termos_pendentes", "mensagem": "Aceite a nova versão dos termos para continuar."}
```

`POST /api/termos/aceite` — every profile:

```json
{"versao": "2026-11-01", "aceite_lgpd": true, "aceite_sigilo": true}
```

It returns 400 with the message above when `versao` is not current, 400 `{"sucesso": false, "mensagem": "Você deve aceitar os termos da LGPD e o compromisso de sigilo para continuar."}` when either flag is false, and 200 `{"sucesso": true, "mensagem": "Termos aceitos."}` otherwise. Each acceptance also appends a row to a new tenant table `aceites_termos(usuario_id, versao, aceito_em, ip)`, so the history survives later acceptances. The team listing of `0011` gains `termos_versao` per user.

Blocking at the guard rather than only in the frontend modal was the deliberate choice: a professional who never accepted the new confidentiality terms must not read student data through any client. The cost is one comparison per request against a value the guard already loaded.

### Privacy notice data
The Master `schools` table gains `encarregado_nome VARCHAR(150) null`, `encarregado_email VARCHAR(150) null`, and `cnpj VARCHAR(18) null`, set by the Admin AMPARA provisioning of `0002` (whose request body gains the three optional fields). `GET /api/privacidade?escola_id=<id>` is public, added to the public list of `0011`:

```json
{
  "termos_versao": "2026-11-01",
  "controlador": {"nome": "Escola Estadual João de Barro", "cnpj": "00.000.000/0001-00"},
  "encarregado": {"nome": "Ana Ribeiro", "email": "dpo@escola.gov.br"},
  "operador": {"nome": "Equipe A.M.P.A.R.A.", "email": "privacidade@ampara.app.br"}
}
```

Without `escola_id`, `controlador` and `encarregado` are `null` and the page shows the generic notice. So that a logged-in page can ask for its own school, the `usuario` object of the login response of `0002` gains `"escola_id": "tenant_escola_joao_de_barro"`. The pages blueprint of [0010](0010-backend-foundation-and-delivery-hardening-backend.md) gains the route `/privacidade`, rendering `privacidade.html`. The school is the controller and the platform the processor (operador) because the school decides why student data is processed; the notice text itself is static frontend copy, versioned with `TERMOS_VERSAO_ATUAL`.

### Student export (right of access)
`GET /api/gestao/estudantes/<int:id>/exportar` — `gestor_escolar` only. It answers `200` with `Content-Type: application/json`, `Content-Disposition: attachment; filename="estudante-<id>-dados.json"`, and `Cache-Control: no-store`:

```json
{
  "gerado_em": "2026-10-26T14:00:00Z",
  "escola": "Escola Estadual João de Barro",
  "estudante": {"id": 25, "nome": "Lucas Mendes de Oliveira", "matricula": "2026.01.0001", "turma": "1º Ano A", "created_at": "2026-02-03T12:00:00Z"},
  "observacoes": [{"id": 311, "data": "2026-10-18T09:15:00Z", "autor": "Maria Silva", "tipo": "tristeza", "gravidade": "Alta", "descricao": "..."}],
  "ocorrencias": [{"id": 57, "data": "2026-10-20T13:05:00Z", "autor": "Coord. Helena Prado", "tipo": "Apoio Familiar", "acao": "...", "descricao": "..."}],
  "encaminhamentos": [{"id": 142, "data": "2026-10-21T10:15:00Z", "solicitante": "Maria Silva", "designado": "Psicóloga Amanda Costa", "motivo": "...", "status": "Concluído", "resumo_encerramento": "..."}]
}
```

Class-level occurrences are left out, since they describe the class rather than the student. `observacoes_coordenacao` of `0006` is included under each referral, because it is data about the student and the LGPD grants access to it; the coordinator reviews the file before handing it over, which the frontend makes explicit. Every later spec that stores data about a student adds its table to this export, and its own spec says so.

### Student anonymization (right of erasure)
`POST /api/gestao/estudantes/<int:id>/anonimizar` — `gestor_escolar` only:

```json
{"confirmacao_matricula": "2026.01.0001"}
```

- 400 `{"sucesso": false, "mensagem": "A matrícula digitada não confere."}` when the confirmation differs, so the action cannot be fired by a stray click or a replayed request for another student.
- 409 `{"sucesso": false, "mensagem": "Conclua ou arquive os encaminhamentos em aberto antes de anonimizar o estudante."}` while a referral is `"Aguardando Triagem"` or `"Em Atendimento"`.
- 200 `{"sucesso": true, "mensagem": "Dados do estudante anonimizados."}`.

In one transaction, `src/lgpd/anonymizer.py` sets `estudante.nome` to `"Estudante anonimizado"`, `estudante.matricula` to `"anon-<id>"`, and a new column `estudante.anonimizado_em`; sets to `null` every free-text field about the student (`observacoes.descricao`, `ocorrencias_coordenacao.acao` and `descricao` of student-targeted occurrences, `encaminhamentos.motivo`, `observacoes_coordenacao`, `resumo_encerramento`); and keeps `tipo`, `gravidade`, `status`, `prioridade`, dates, and class. The anonymized student disappears from rosters and searches; their structured rows still count in school aggregates. `motivo` and `acao` become nullable for this reason, a contract change to `0006` and `0015`.

Deleting every row was the alternative. I chose anonymization because the school's aggregate climate figures, which [0023](0023-emotional-climate-dashboards-backend.md) builds on, would otherwise shift retroactively whenever a student left, and art. 16 of the LGPD allows keeping anonymized data. The risk is re-identification from what remains (a single student in a small class with dated observations); the mitigation is that aggregates suppress groups smaller than 3, as `0023` specifies, and anonymized rows are never shown individually.

`AnonymizerService` exposes `registrar_tabela(tabela, colunas_texto, coluna_estudante)` so that later specs add their tables to the sweep in their own composition-root wiring, and `registrar_passo(callback)` for a sweep that needs a join the column registry cannot express (the meetings of [0035](0035-multidisciplinary-meeting-scheduling-backend.md) are the first case); a test fails when a tenant table with an `estudante_id` column and a `TEXT` column is not registered.

### No student data in logs
Request logging records method, path template, status, duration, user id, and tenant id, never bodies or query strings. A logging filter in `src/lgpd/log_filter.py` drops any record whose message contains a field name from a deny list (`nome`, `descricao`, `motivo`, `matricula`), as a safety net against a stray `print` or exception message.

## Testing Decisions
- `backend/test/test_lgpd_terms.py`: registration stores the version; a stale `termos_versao` is refused; login reports `termos_pendentes`; the guard's 403 on every route except acceptance; acceptance history rows.
- `backend/test/test_api_privacidade.py`: with and without `escola_id`; public access.
- `backend/test/test_api_estudante_exportar.py`: contents across the three kinds, class occurrences excluded, attachment headers, coordinator-only access, out-of-tenant id 404.
- `backend/test/test_lgpd_anonymizer.py`: confirmation mismatch, open-referral 409, every registered free-text column nulled, structured columns kept, the student absent from `GET /api/estudantes` afterwards, and the registry test that catches an unregistered table.
- `backend/test/test_lgpd_log_filter.py`: records carrying denied fields are dropped.

## Out of Scope
- Privacy page, terms modal, export and anonymization screens, specified in [todo/0018-lgpd-privacy-compliance-frontend.md](0018-lgpd-privacy-compliance-frontend.md).
- The access audit trail, specified in [todo/0027-access-audit-log-backend.md](0027-access-audit-log-backend.md).
- Data-subject rights of professionals over their own accounts beyond what `0011` already allows.
- Automatic retention jobs; see _Further Notes_.
- Encryption at rest inside the application. The production database volume must be encrypted at the infrastructure level (encrypted EBS or managed database encryption), which is a deployment checklist item, not code.

## Further Notes
The legal basis for processing student data has to be confirmed by each school's encarregado before go-live. The likely basis is the execution of public policies by a public school (art. 11, II, b) together with the best interest of the adolescent (art. 14), but private schools would need another basis, possibly consent from parents. The platform does not collect parental consent today; if a school requires it, that is a new spec.

The `operador` contact in the example is a placeholder: the team has no privacy mailbox yet and must create one before go-live, since the notice cannot point families at an address nobody reads.

The retention period for observations is undefined. A reasonable default is anonymizing students one year after they leave the roster, but the roster has no "left the school" state yet, and the period should come from the schools' document retention policy rather than from engineering.
