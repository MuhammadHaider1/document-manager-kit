# DocuFlow

**Multi-tenant document management backend with built-in RAG** — upload a PDF,
DOCX or text file, ask questions in natural language, list the tenant's document
register and receive clearly labelled general knowledge when no passage matches.

![CI](https://github.com/MuhammadHaider1/document-manager-kit/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

Upload a document → a Celery worker extracts the text → chunks it → generates 384-dimensional
embeddings → stores them in **pgvector**. `POST /chat/` routes registry questions to
PostgreSQL and uses relevance-gated cosine search plus Gemini/OpenRouter for other questions.

> **Solo project** — architecture, backend, RBAC, the RAG pipeline, deployment and
> production debugging were all done by me.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [The RAG pipeline](#the-rag-pipeline)
- [Multi-tenancy & RBAC](#multi-tenancy--rbac)
- [Production debugging](#production-debugging)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Setup](#setup)
- [API surface](#api-surface)
- [Testing & CI](#testing--ci)
- [Security](#security)
- [Roadmap](#roadmap)

---

## What it does

| Capability | Detail |
|---|---|
| **Multi-tenant SaaS** | Organizations, memberships, and every resource scoped by `X-Organization-Id` |
| **RAG over your documents** | Semantic search + grounded answers, **tenant-isolated** at the SQL level |
| **Streaming answers** | Server-Sent-Events style `text/plain` stream via `StreamingResponse` |
| **Hybrid chat** | Exact document registry, bounded follow-up history and labelled general fallback |
| **RBAC** | 8 roles, 11 permissions, 56 role→permission links, enforced by a reusable dependency |
| **Async document processing** | Celery + Redis; PDF/DOCX/TXT extraction never blocks a request |
| **Versioned storage** | `Document` + `DocumentVersion` lineage, objects in MinIO (S3-compatible) |
| **Hierarchical folders** | Nested parent/child tree, cascade-safe deletes |
| **Audit log** | Async trail of actor, action, entity, IP and JSONB detail |
| **Notifications** | Per-user read/unread with bulk operations |
| **Rate limiting** | SlowAPI, e.g. 30 req/min on RAG endpoints |

**Scale:** 4,200+ lines across 70+ Python files · 11 routers · 10 model modules · 7 stored Alembic revisions.

---

## Architecture

Layered, so a request never skips straight to the database:

```
                         ┌──────────────────────────────┐
   HTTP request  ───────►│  API        src/api/v1       │  routing, auth deps,
                         │              PermissionChecker│  rate limiting
                         └───────────────┬──────────────┘
                                         ▼
                         ┌──────────────────────────────┐
                         │  SERVICES    src/services    │  business logic,
                         │              RAGService      │  storage, AI calls
                         └───────┬──────────────┬───────┘
                                 ▼              ▼
              ┌──────────────────────┐   ┌──────────────────────┐
              │ REPOSITORIES         │   │ TASKS    src/tasks   │
              │ src/repositories     │   │ Celery: extract → chunk  │
              │ per-entity queries   │   │ → embed → pgvector   │
              └──────────┬───────────┘   └──────────┬───────────┘
                         ▼                          ▼
              ┌────────────────────────────────────────────┐
              │  PostgreSQL + pgvector   │   Redis   MinIO  │
              │  asyncpg / SQLAlchemy 2.0 │  broker   S3     │
              └────────────────────────────────────────────┘
```

### Two details worth calling out

**CPU-bound work is pushed off the event loop.** Embedding generation is synchronous and
blocking, but it runs inside an async request path. Rather than stalling every concurrent
request, `RAGService` hands it to a thread pool:

```python
loop = asyncio.get_running_loop()
embeddings = await loop.run_in_executor(
    None, self.embedding_service.get_embeddings_batch, raw_chunks
)
```

**RAG is tenant-isolated in SQL, not in Python.** The organization filter is part of the
`WHERE` clause, so a missing application-level check cannot leak another tenant's chunks:

```python
stmt = (
    select(DocumentChunk)
    .join(Document, DocumentChunk.document_id == Document.id)
    .where(Document.organization_id == org_id)          # ← tenant boundary
    .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
    .limit(limit)
)
```

---

## The RAG pipeline

### Ingestion — `POST /documents` triggers a Celery task

```
PDF / DOCX / TXT uploaded
   └─► process_document_task              (Celery, max_retries=3, 5s backoff)
          ├─ minio.stat_object()          verify the object really exists
          ├─ extract_text()               pypdf / python-docx / plain decode
          ├─ chunk_text(500, overlap 50)   sliding window
          ├─ SentenceTransformer           all-MiniLM-L6-v2 → 384-d vectors
          └─ INSERT documentchunk         embedding column (pgvector)
```

Supported extractors are PDF (`pypdf`), DOCX (`python-docx`, paragraphs and tables) and
UTF-8/UTF-16 text formats (`.txt`, `.md`, `.csv`, `.json`, `.log`). Images and legacy `.doc`
files have no configured extractor, so they are marked `failed` with an explicit reason
instead of being reported as indexed.

Retries are bounded: on the final attempt the document is marked `failed` instead of
retrying forever, and the error is re-raised so it is not silently swallowed.

### Query — `POST /api/v1/query`

```
question
  ├─ embed the question              → 384-d vector
  ├─ top-5 cosine neighbours         → filtered by organization_id
  ├─ build a grounded prompt         → "answer only from this context"
  └─ Gemini → OpenRouter fallback    → configurable provider chain
```

Retrieval applies a `RAG_MIN_SIMILARITY` gate (default `0.34`), so unrelated
questions do not pull arbitrary chunks into the prompt. `POST /api/v1/query-stream`
yields chunks as they arrive and falls back to a buffered completion if upstream
streaming is unavailable.

### Hybrid chat — `POST /api/v1/chat/`

The chat endpoint handles three modes:

- **Registry questions** such as “documents”, “all documents”, “which files failed”
  and “archived documents” are answered directly from the organization-scoped register.
- **Document questions and follow-ups** pass through the retrieval gate and return
  source document titles. Exact and partial document-title queries are resolved before
  vector search, and a bounded history handles natural follow-up references.
- **General questions** receive clearly labelled general knowledge when no passage
  clears the gate; they are never presented as document-backed.

Registry and follow-up detection are deterministic, avoiding an extra model round-trip.

**Retrieval diversity.** Vector search fetches a wider candidate set, caps how many chunks a
single document can contribute, drops duplicate chunks from repeated uploads, and backfills
from the next-best results. Without this, one long CV or contract could fill all five context
slots and hide the quiz or agreement the user actually asked about.

**Multiple-choice documents.** Quiz files usually contain the question and options but not a
marked answer key. When the retrieved context shows a complete multiple-choice item (question
mark plus A–D option lines), the prompt recalls the fact without looking at the options —
identifying the foundational publication when the question asks when a model was presented —
then matches it to the best option and labels the reply
`(inferred; the source does not mark an answer)`. That mode also enables reasoning, greedy
decoding (temperature `0`) and a larger token budget so the reasoning step is not truncated.
Every other document answer keeps the strict grounding rule; unmatched questions are handled
by the labelled general-knowledge path.

**Resilience.** `gemini-3.5-flash-lite` is the primary model when `GEMINI_API_KEY`
is configured. A Gemini quota/auth/provider failure immediately falls back to an
OpenRouter chain led by `nvidia/nemotron-3.5-lightning:free`, followed by Gemma,
Xing and Nemotron Nano. Provider-specific cooldowns honor `Retry-After` and avoid
repeatedly hitting a throttled service. Transport and 5xx failures use bounded
exponential backoff; a 429 moves to the next provider instead of being hammered.
If OpenRouter SSE fails before the first token, the compatibility streaming endpoint
falls back to a buffered multi-provider completion and chunks it.
Reasoning is disabled (`reasoning.enabled = false`) by default so a hidden chain of thought
does not consume the answer budget; multiple-choice inference opts in selectively. Errors are
translated to short, non-leaky messages and never include the API key.

**Model caching.** The embedding model is resolved by `EMBEDDING_MODEL_PATH` first and only
falls back to the HuggingFace hub id when that directory is missing. Offline flags are
applied **only** in the local case — see the debugging notes below.

---

## Multi-tenancy & RBAC

8 seeded roles over 11 permissions (56 role→permission links):

| Role | Permissions | Intent |
|---|---|---|
| `Super Admin` | 11 | Platform-wide |
| `Platform Admin` | 11 | Platform-wide |
| `Organization Owner` | 11 | Owns the tenant, manages members and roles |
| `Workspace Admin` | 8 | Manages documents and folders, invites members |
| `Contributor` | 5 | Creates and edits content |
| `Member` | 5 | Default role for invited teammates |
| `Reviewer` | 3 | Reads and comments |
| `Viewer` | 2 | Read-only |

Enforcement is a dependency, so it is impossible to forget at a route:

```python
async def create_document(
    _: bool = Depends(PermissionChecker("document:create")),
    ...
)
```

`PermissionChecker` **fails closed** — an unknown permission is a 403, never a pass. Seeding
is idempotent, so it is safe to re-run on every deploy, and it reports loudly on a
permission referenced by a role but missing from the catalogue instead of skipping it.

Creating an organization is an account-level action, so it cannot use the
`X-Organization-Id`-scoped dependency. `POST /organizations/` instead lets an account with
**no memberships** create its first workspace; anyone who already belongs to an
organization must hold `organization:manage` in at least one of them. Members,
Contributors, Reviewers, Viewers and Workspace Admins therefore receive `403` — only
owners and platform admins can add another organization.

### Invitations and membership

`POST /rbac/assign-role` only changes an existing membership, so a separate invitation
lifecycle adds people to an organization:

1. A member with `members:invite` calls `POST /members/invitations` with an email and an
   optional role id. The role defaults to `Member`; only `Member`, `Viewer`, `Contributor`
   and `Reviewer` can be granted this way, so ownership stays behind the permission-checked
   role-assignment endpoint.
2. The response includes a single-use `invite_url` (`FRONTEND_URL` + `/invite/{token}`)
   that expires after `INVITATION_EXPIRE_DAYS` (default 7). There is no SMTP integration;
   the caller shares the link.
3. The invitee signs in with the invited email address (acceptance is rejected otherwise),
   previews the invitation and calls `POST /members/invitations/accept`. A membership is
   created with the invited role, and accepting twice is idempotent for the same user.
4. `GET /members` lists the directory; `GET /members/invitations` lists pending invites and
   `POST /members/invitations/{id}/revoke` cancels one. `DELETE /members/{user_id}` removes
   a member, refusing self-removal and removal of the last organization owner.

Tokens are 256-bit URL-safe secrets generated with `secrets.token_urlsafe(32)`.

---

## Production debugging

Four bugs found and fixed while deploying this to Azure. Each is a commit, and each has a
regression test.

**1. `pg_hba.conf` trusted every local connection.** The password was correct and still
irrelevant — Postgres was configured with `trust` for loopback, so *any* password connected
successfully. Found by testing that an old password still worked after rotating it. Fixed by
switching to `scram-sha-256`, and both Postgres and Redis were rebound from `0.0.0.0` to
`127.0.0.1`.

**2. A failed model load poisoned the singleton forever.** `EmbeddingService` cached itself
in `__new__` *before* the model had loaded. The first load failed, but the half-initialised
instance stayed in `_instance`, so every later call reused the broken object instead of
retrying. The visible error was always a HuggingFace connection error, which hid the fact
that the API key was also missing. Fixed by memoising only after a successful load.

**3. Offline mode was forced at import time.** `document_tasks.py` and
`embedding_service.py` both set `HF_HUB_OFFLINE=1` on import, so the model could never be
downloaded in the first place. Offline flags are now applied only when a local model
directory actually exists.

**4. The org creator was given the weakest role.** `register_new_organization` looked up
`"Viewer"`, while the comment above it said "Get Admin role" and the error message said
`'Member' does not exist`. Whoever created an organization ended up unable to manage
members, documents or roles — unable to administer their own tenant. The test suite missed it
because the assertions were `assert response.status_code in [200, 400, 404, 422, 500]`,
which passes for almost any response. Fixed, and the test now asserts the exact role id;
it was verified to fail against the old code.

**5. A live endpoint returned 422 to every caller.** `GET /comments/documents/{document_id}/comments`
declared its path parameter as `doc_id`, so FastAPI treated the id as a *required query
parameter* and the endpoint could never succeed. The test for it had been pointed at
`/api/v1/comments/`, a path that does not exist, and asserted the 404 — a green test that
exercised nothing. Both are fixed: the parameter is named correctly, the tests call real
routes, and a tenant-isolation test now proves another tenant's document returns 404.

---

## Tech stack

| Layer | Choice |
|---|---|
| API framework | FastAPI 0.139, Starlette, Uvicorn (uvloop/httptools) |
| Data | PostgreSQL 15 + **pgvector**, SQLAlchemy 2.0 async, asyncpg |
| Migrations | Alembic (7 stored revisions) |
| Validation | Pydantic v2, pydantic-settings |
| Auth | JWT (PyJWT), Argon2 via `pwdlib`, FastAPI dependencies |
| Vector search | pgvector cosine distance, `sentence-transformers` MiniLM (384-d) |
| LLM | Gemini 3.5 Flash-Lite primary + OpenRouter high-context fallback pool over `httpx` |
| Background work | Celery + Redis, `pypdf` and `python-docx` for extraction |
| Object storage | MinIO (S3-compatible) via `minio` / `aioboto3` |
| Rate limiting | SlowAPI |
| Tests | pytest, pytest-asyncio, httpx |
| Lint | ruff (lint + format) |

---

## Project structure

```
backend/
├── .github/workflows/ci.yml      # lint, tests, secret scan (moved to repo root in the monorepo)
├── docker/                       # FastAPI & Celery Dockerfiles
├── docker-compose.yml            # postgres+pgvector, redis, minio
├── migrations/versions/          # 7 stored Alembic revisions
├── requirements.txt              # runtime deps
├── requirements-dev.txt          # test + lint tooling
├── requirements-rag.txt          # optional ~2 GB PyTorch stack
├── scripts/                      # manual dev utilities (need a live DB)
├── src/
│   ├── main.py                   # app, lifespan, routers, limiter
│   ├── core/                     # config, database, security, seeding, limiter
│   ├── api/v1/                   # 11 routers incl. rag.py and members.py
│   ├── models/                   # SQLAlchemy models (chunks.py holds pgvector)
│   ├── repositories/             # data access, one module per entity
│   ├── schemas/                  # Pydantic request/response models
│   ├── services/                 # business logic, RAG, embedding, storage
│   ├── tasks/                    # Celery app + document pipeline
│   └── utils/chunking.py         # sliding-window splitter
└── tests/                        # pytest suite, 190 tests (statement-aware fake DB)
```

---

## Setup

**Prerequisites:** Python 3.12+, Docker & Docker Compose.

```bash
git clone https://github.com/MuhammadHaider1/document-manager-kit.git
cd document-manager-kit/backend

python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt

cp .env.example .env        # then edit: SECRET_KEY + GEMINI_API_KEY
```

Generate a real signing key:

```bash
openssl rand -hex 32
```

Start the infrastructure. Host ports match `.env.example`:

```bash
docker compose up -d
```

| Service | Host port | Notes |
|---|---|---|
| PostgreSQL + pgvector | `5432` | needs the `vector` extension — the image ships it |
| Redis | `6380` | Celery broker |
| MinIO API | `9100` | |
| MinIO console | `9101` | <http://localhost:9101> |

Then initialise the database. The model metadata is the source of truth (`init_db.py` runs
`Base.metadata.create_all` and seeds RBAC, including the `Member` role and the `invitation`
table):

```bash
python init_db.py
```

The `migrations/versions/` files are legacy snapshots: the initial revision is empty and the
later ones expect tables it never creates, so `alembic upgrade head` does not reproduce the
current schema. Use `init_db.py` (or the API's `create_all` on startup) for a working
database.

Start the API and the worker:

```bash
uvicorn src.main:app --reload
celery -A src.tasks.celery_app.app worker --loglevel=info
```

API docs: <http://localhost:8000/docs>

### Enabling the RAG features

The core API runs without them. To ingest vectors and answer questions:

```bash
pip install -r requirements-rag.txt
```

Set `GEMINI_API_KEY` in `.env` to use `gemini-3.5-flash-lite` as the primary
provider. `OPENROUTER_API_KEY` enables the comma-separated `OPENROUTER_MODELS`
fallback pool. Set `FRONTEND_URL` so invitation links point at the web app. If
you want the embedding model served from disk instead of downloaded on first use,
place it at `EMBEDDING_MODEL_PATH` (default
`models/all-MiniLM-L6-v2`) and the app will never contact HuggingFace.

---

## API surface

All routes are prefixed `/api/v1`. Requests need `Authorization: Bearer <token>`, and
tenant-scoped requests need an `X-Organization-Id` header.

| Module | Endpoints |
|---|---|
| **Auth** | `POST /auth/register`, `/auth/login`, `/auth/refresh` |
| **Organizations** | list / create / get / update / delete |
| **Documents & folders** | CRUD, nested folder tree, version history, download |
| **RBAC** | `GET /roles`, `GET /permissions`, assign / revoke / read member role |
| **Members** | `GET /members`, `DELETE /members/{user_id}`, invitation create / list / preview / accept / revoke |
| **RAG** | `POST /query`, `POST /query-stream` |
| **Chat** | `POST /chat/` |
| **Comments** | CRUD |
| **Audit** | `GET /audit` |
| **Notifications** | CRUD, read/unread, bulk mark-read |
| **Admin** | `/admin` |

```bash
# ask a question about your documents
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"query": "What database does this project use?"}'
```

---

## Testing & CI

```bash
pytest              # 190 tests
ruff check src/ tests/ scripts/
ruff format --check src/ tests/ scripts/
```

Tests run against a mocked async DB session, so **no PostgreSQL, Redis or MinIO is needed**
to run the suite — which is what makes it usable in CI.

GitHub Actions runs on every push and PR to `main`:

- **Lint** — `ruff check` and `ruff format --check`
- **Tests** — full suite on a clean environment
- **Secret scan** — fails if a `.env` was ever committed, or if an OpenRouter API key /
  HuggingFace token / private key appears in the tree

That last job exists because this project has actually leaked a key once. It has been
rotated, and the check is there to stop it happening again.

---

## Security

- `.env` is git-ignored and has never been committed; CI enforces this.
- Passwords are hashed with Argon2 and validated on registration: minimum 12 characters, a
  128-character ceiling (bcrypt/Argon2 truncate beyond 72 bytes, which would otherwise make
  two different passwords equivalent), and a rejection list of the most common passwords.
  `user1` and `password123` do not pass.
- `SECRET_KEY`, the database password, the MinIO keys and provider API keys have all been
  rotated off their defaults.
- Postgres, Redis and MinIO all bind to `127.0.0.1`; only SSH and the API port are
  published, and an external scan confirms nothing else answers.
- Every one of the 38 routes carries a rate limit. `POST /auth/login` and
  `POST /auth/register` are capped at **5/minute** and `POST /auth/refresh` at 10/minute, so a
  public deployment cannot be used for offline password guessing; `tests/test_auth.py` asserts
  the 429 actually fires rather than trusting the decorator is present.
- Authorization is deny-by-default.

> **Deployment note:**
>
> The API is designed to sit behind a TLS reverse proxy (Tailscale Funnel, nginx, Caddy or a
> cloud load balancer). Bind Uvicorn to `127.0.0.1:8000` and expose only the proxy on 443;
> Postgres, Redis, MinIO and the API's own port should stay private. Because the API is
> public, every route is rate limited (38/38): `login` and `register` at 5/minute, so the
> endpoint cannot be used for offline password guessing.

---

## Roadmap

- [ ] Replace the hard-coded Celery broker URL with a setting
- [ ] Real integration tests against a live Postgres + pgvector instance
- [x] HTTPS deployment support (Tailscale Serve / Let's Encrypt)
- [ ] OCR for scanned PDFs and images (`pypdf` and `python-docx` only read text layers)
- [ ] Presigned upload/download URLs that work outside the host
- [ ] Hybrid retrieval (BM25 + vector) and a re-ranker
- [ ] Container images for the API and worker
- [ ] Rate-limit and audit-log dashboards

---

## License

MIT — see [LICENSE](LICENSE).
