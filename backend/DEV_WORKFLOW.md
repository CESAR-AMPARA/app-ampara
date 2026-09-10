
## ARCHITECTURE_CONSTRAINTS
- **Infrastructure Adapters**: Encapsulate service-specific logic (SDK calls, request/response shaping) in dedicated adapter modules, never inline in domain services.
- **Dependency Injection**: Classes must receive all external dependencies (clients, providers) via `__init__` dependency injection. Nothing is resolved at import time — the application's composition root is the single place that wires real dependencies together, and its factory functions accept injected overrides so every test runs without network or cloud provider.

## TECH_STACK
- **Runtime**: Python 3.14, pinned in the container image; check the pinned version's rationale before assuming a newer one is safe to move to.
- **Core Dependencies**: declared in `requirements.txt`. Keep the set to one package per external system actually integrated — adding a dependency for a new integration is expected; adding one that duplicates what's already there isn't.
- **Code Quality**: `pylint` (Strict 10/10 score, configured in `.pylintrc`)
- **Testing**: `unittest`, `PyHamcrest` matchers, `coverage`
- **Dev-only Dependencies**: declared in `requirements-dev.txt`

## LANGUAGE
- **English for everything a developer reads**: module and symbol names, docstrings, comments, commit messages, test names, and the prose in `adr/` and `todo/`. A reader who greps an identifier in an ADR must find the same word in the source. No exceptions — a docstring is documentation, never a way to talk to the model.
- **Portuguese for everything that leaves the codebase**: text read by a person (user-facing error messages, UI copy, anything rendered to a user) and text read by the model (the system prompt, and the name, description, and parameter descriptions of every tool exposed to it, plus whatever a tool returns). The model is instructed in Portuguese and must not switch languages to decide which tool to call.
- **AI model-facing text is declared, never incidental**: every such string is a named constant, passed explicitly at the point the model actually reads it — a tool's name and description, a parameter's description, the system prompt itself. Nothing reaches the model by being inferred from a function name or docstring, which is what keeps the two rules above from colliding. Constants live together with the prompt they are read alongside, so the whole Portuguese surface is reviewable in one place and the adapter that calls the gateway holds no wording.

## DOCUMENTATION
- **A docstring is a contract, not an essay**: the first line says what the callable does, then `Args:`, `Returns:`, and `Yields:`/`Raises:` where they apply. Nothing else. Every function carries one, private ones and protocol methods included, because the contract is what both a caller and a maintainer read. Prose explaining *why* the code is the way it is does not belong here: it sits too far from the line it justifies — a reader working through a function body never scrolls back up for it — and it is not where someone hunting for a decision looks either.
- **A "why" has three possible homes, and the kind of "why" picks the home**:
  - A **decision with a rejected alternative** — the kind someone will re-propose next quarter — goes in `adr/`. The code carries at most a one-line pointer to it, never a copy, because two copies are two places for the rule to be wrong.
  - A **surprising fact about an SDK, an API, or a browser** goes in a comment on the exact line it explains. It is not a decision, so no ADR would hold it, and the code reads as correct without it — which is exactly why the next person deletes the workaround. 
  - A **local invariant** ("this assignment must precede that call", "this comparison is safe because the input format is fixed") goes in a comment on the exact line, because whoever is about to break it is reading the body, not the ADR index.
- **Never restate an ADR in a docstring**: `adr/0001` already establishes that nothing resolves at import time. An adapter whose docstring repeats it has created a second place for that rule to go stale.

## DEVELOPMENT_WORKFLOW

### TDD Lifecycle
1. **Red Phase**: Write/update failing tests in `test/`.
2. **Green Phase**: Implement minimal production code in `src/` to pass tests.
3. **Refactor Phase**: Clean duplication, improve naming/readability. Verify tests remain green.

## QUALITY_GATES
- **Test Mapping**: 1:1 correspondence required. Every production module inside `src/` (excluding `__init__.py`) MUST have a corresponding test module in `test/`, with the path flattened into the filename (e.g., `src/foo/bar.py` maps to `test/test_foo_bar.py`). CLI root scripts are excluded — `main.py` holds no logic and has no test module.
- **Code Coverage**: Must maintain **>90%** coverage for all files inside `src/` (enforced by `fail_under` in `.coveragerc`).
- **Pylint Score**: Must maintain perfect **10/10** score on all files in `src/`. Pylint warnings must **never** be suppressed with `# pylint: disable` comments without explicit user approval — always fix the root cause instead (e.g. refactor method signatures, extract helpers, reduce complexity). Where a suppression is approved, it goes on the exact block it excuses, with a comment saying why. `.pylintrc` should disable no messages globally; project-wide config there is reserved for adjusting numeric thresholds the architecture genuinely needs, each with its reasoning next to it.
- **Secret Security**: Zero hardcoded secrets/tokens allowed, and no sensitive credential is ever carried by an environment variable — not even in local development. Read `adr/` for how this project resolves credentials before adding a new one.
- **Manual Verification**: Describe and propose step-by-step verification instructions to the user at the end of execution.

## TEST_CONVENTIONS
- Tests import shared doubles with a **relative** import (e.g. `from .fakes import SomeFakeProvider`). An absolute `from test.fakes import ...` makes pylint resolve `test` as CPython's own stdlib `test` package and report `wrong-import-order`.
- Async generators are exercised with `unittest.IsolatedAsyncioTestCase` plus the `collect()` helper in `test/fakes.py`.
- Static-file behaviour uses the committed fixture under `test/fixtures/static/`, not a temporary directory — it keeps the tests deterministic and avoids `consider-using-with`.

### Running Tests
To run the full suite of unit tests:
```bash
coverage run -m unittest discover -s test -t .
```
`-t .` is required: without it the top-level directory is `test/`, the package-relative imports fail to resolve, and the suite errors out.

### Coverage Report
To verify that code coverage exceeds the **90%** threshold:
```bash
coverage report -m
```

### Linting
To check that the code scores a perfect **10/10** with Pylint:
```bash
pylint src/ test/ main.py
```
