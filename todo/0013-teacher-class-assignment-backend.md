# Teacher-Class Assignment and Data Scope Backend

*Phase: MVP #1 (backbone). Story-map cards: "As a Teacher, I want to quickly record a behavioral observation about a student" (value 500, 3 points); "As a user, I want my data and the students' data to be handled according to the LGPD to guarantee full privacy" (value 800, 3 points).*

*This specification defines the backend of the link between teachers and their classes and the single policy that decides which students each user may see. Its frontend counterpart is [todo/0014-teacher-class-assignment-frontend.md](0014-teacher-class-assignment-frontend.md). It extends the roster of [todo/0004-student-class-management-backend.md](0004-student-class-management-backend.md) and relies on the guard of [todo/0011-access-management-backend.md](0011-access-management-backend.md).*

## Problem
[0004](0004-student-class-management-backend.md) says teachers read students "within their authorized classes", but nothing records which classes a teacher is authorized for. Every teacher would therefore see every student of the school, including the observations and referrals that later specs attach to them. The dashboard prototype guessed a teacher's class from a hardcoded list of e-mails, and `0009` had to fall back to showing all classes, calling it the one place where the frontend knowingly shows more than the product intends.

Each data spec also writes its own access rule in prose ("a teacher cannot see other teachers' referrals", "the psychologist sees only assigned cases"), so the rules drift and a new endpoint has nothing to reuse.

## Business Vision and Purposes
A math teacher of the 1º Ano A has no reason to read the emotional history of a 3º Ano student they never taught. Data minimization is a principle of the LGPD and the condition under which schools will accept the platform at all. Linking teachers to their classes lets the product show each professional exactly the students they work with, and putting that rule in one policy makes it auditable and testable once.

## Solution
The coordinator assigns one or more teachers to each class, and a teacher can teach several classes. A teacher's class list, student search, and every student record they open are limited to their classes. A psychologist or social worker sees the students whose referrals were assigned to them. The coordinator sees the whole school. When a teacher is removed from a class, the class and its students disappear from their panel on the next request, while the observations they already wrote stay in the students' records.

## User Stories
1. As a Coordenador Pedagógico, I want to assign teachers to each class, so that each teacher works with their own students.
2. As a Coordenador Pedagógico, I want to see which teachers are assigned to each class, so that I can spot classes with nobody following them.
3. As a Docente, I want to see only my classes and their students, so that my panel matches my timetable.
4. As a Docente who stopped teaching a class, I want it to leave my panel, so that I no longer hold access to those students.
5. As an Equipe Multidisciplinar professional, I want to see only the students referred to me, so that I am not exposed to records outside my cases.

## Implementation Decisions

### Assignment table
The tenant database gains:

```
docente_turma:
  usuario_id  INTEGER    not null, references usuarios(id)
  turma_id    INTEGER    not null, references turma(id) on delete cascade
  created_at  TIMESTAMP  not null
  primary key (usuario_id, turma_id)
```

Only users with `perfil = "docente"` may be assigned; the assignment does not care about `status`, because the guard of `0011` already keeps suspended users out, and keeping the rows means a reactivated teacher gets their classes back.

### Scope policy
`src/auth/scope.py` defines `ScopePolicy`, constructed with the tenant session, with one public method:

```python
def estudantes_visiveis(self, usuario) -> StudentScope:
    """Return the set of students the user may read."""
```

`StudentScope` is either `ALL` (for `gestor_escolar`) or a SQL subquery of `estudante.id` values: students of the classes in `docente_turma` for a `docente`; students with at least one `encaminhamentos` row whose `designado_id` is the user, in any status, for `equipe_multidisciplinar`. Returning a subquery rather than a Python list keeps a school of 2,000 students one query instead of 2,000 ids in an `IN` clause. Every route that returns or writes student data filters through it: `GET /api/estudantes`, the student history of [0015](0015-behavioral-observations-backend.md), observation creation, referral creation, and every later spec. A student outside the scope answers 404 with `{"sucesso": false, "mensagem": "Estudante não encontrado."}`, never 403, so a teacher cannot probe which ids exist.

A psychologist keeps access to a student after the referral is `"Concluído"` or `"Arquivado"`, because a student often returns, and the professional needs the history of the earlier case. The cost is that access accumulates over the years; the mitigation is the audit log of [0027](0027-access-audit-log-backend.md) and the anonymization of [0017](0017-lgpd-privacy-compliance-backend.md) when a student leaves the school.

### Contract changes to the roster routes of `0004`
`GET /api/turmas` is scoped: a `docente` receives only assigned classes, an `equipe_multidisciplinar` receives the classes of their visible students, and a `gestor_escolar` receives all classes with the assigned teachers:

```json
{
  "turmas": [
    {
      "id": 1,
      "nome": "1º Ano A",
      "turno": "matutino",
      "total_estudantes": 34,
      "docentes": [
        {"id": 12, "nome": "Maria Silva"}
      ]
    }
  ]
}
```

`docentes` is present only in the coordinator's response; teachers do not need to know who else teaches the class. `GET /api/estudantes` filters through `ScopePolicy`, and a `turma_id` outside the teacher's classes returns an empty list.

### Assignment routes
Both routes are `gestor_escolar` only.

`PUT /api/gestao/turmas/<int:turma_id>/docentes` replaces the set of teachers of one class, which matches the screen where the coordinator ticks names on a class:

```json
{"docente_ids": [12, 15]}
```

- 404 `{"sucesso": false, "mensagem": "Turma informada não encontrada."}` for an unknown class.
- 400 `{"sucesso": false, "mensagem": "Somente usuários com perfil docente podem ser vinculados a turmas."}` when any id is not a `docente` of this tenant; nothing is written.
- 200 `{"sucesso": true, "mensagem": "Professores da turma atualizados."}`.

`GET /api/gestao/docentes` lists the school's teachers for the picker, with their current classes:

```json
{
  "docentes": [
    {
      "id": 12,
      "nome": "Maria Silva",
      "status": "Ativo",
      "turmas": [{"id": 1, "nome": "1º Ano A"}]
    }
  ]
}
```

A per-teacher route (`PUT /api/gestao/docentes/<id>/turmas`) was the alternative. I chose the per-class replacement because the coordinator organizes the school by class at the start of the term, and replacing a whole set makes the call idempotent: retrying after a timeout cannot add a teacher twice or leave half a change.

### Spreadsheet import
The class import of `0004` accepts an optional `docentes_emails` column with e-mails separated by `;`. Each e-mail that matches an active `docente` of the tenant is assigned; one that does not is reported in `erros` as `{"linha": 3, "motivo": "Professor joao@escola.gov.br não encontrado ou não aprovado."}`, and the class itself is still created.

## Testing Decisions
Exercised through the Flask test client with in-memory tenant databases and tokens for each profile.

- `backend/test/test_auth_scope.py`: `ScopePolicy` for each profile, including teachers with no class, teachers with several classes, a psychologist whose referral was concluded, and a suspended-then-reactivated teacher.
- `backend/test/test_api_gestao_docentes.py`: listing teachers with their classes; replacing a class's teachers, including an empty list; non-`docente` ids rejected atomically; non-coordinators get 403.
- `backend/test/test_api_turma.py` (from `0004`, extended): scoped listing per profile; `docentes` present only for the coordinator; the `docentes_emails` import column.
- `backend/test/test_api_estudante.py` (from `0004`, extended): a teacher searching by name never receives a student outside their classes; an out-of-scope `turma_id` yields an empty list.

## Out of Scope
- The assignment screen and the scoped teacher panel, specified in [todo/0014-teacher-class-assignment-frontend.md](0014-teacher-class-assignment-frontend.md).
- Subject-level assignment (which discipline the teacher gives in the class); the scope is the class.
- Timetables and term dates; an assignment lasts until the coordinator removes it.
- Access for teachers to students outside their classes during school events or substitutions; the coordinator assigns the substitute to the class.
