# Docuflow Web

The React frontend for [Docuflow](../backend/README.md) — a multi-tenant legal
document workspace with versioned files, folder trees, comments, an audit trail
and an organization-scoped Ask AI (RAG) experience.

The UI is built against the **live** OpenAPI document served by the backend
(`http://localhost:8000/api/v1/openapi.json`, vendored as `openapi.json`). Every
request in `src/lib/api/endpoints.ts` maps to a real endpoint; capabilities the
API does not expose are listed under [Backend gaps](#backend-gaps) instead of
being simulated.

---

## Stack

| Concern       | Choice                                            |
| ------------- | ------------------------------------------------- |
| UI            | React 18, Vite 5, TypeScript (strict)             |
| Styling       | Tailwind CSS, shadcn-style primitives on Radix UI |
| Icons         | lucide-react                                      |
| Routing       | React Router v6 (lazy-loaded routes)              |
| Server state  | TanStack Query v5                                 |
| Client state  | Zustand (auth session, theme, UI)                 |
| Forms         | react-hook-form + zod                             |
| Uploads       | react-dropzone, XHR with per-file progress        |
| Markdown      | react-markdown + remark-gfm + rehype-sanitize     |
| Notifications | sonner                                            |
| Tests         | Vitest + React Testing Library                    |

Design tokens: navy `#0B1F3A`, ivory `#FAF8F4`, gold `#B08D57`; Fraunces for
display type, Inter for UI; full light/dark/system theme support.

---

## Quick start

### 1. Start the API

Follow the backend README, or use the already-provisioned local services:

```bash
cd ../backend
# Postgres, Redis and MinIO must be running; then:
uvicorn src.main:app --reload --port 8000
# and, in a second shell, for text extraction / indexing:
celery -A src.tasks.celery_app.app worker --loglevel=info
```

The frontend expects the API at `http://localhost:8000`.

### 2. Configure and run the web app

```bash
cd frontend
cp .env.example .env.local     # optional: defaults already work locally
npm install
npm run dev                    # http://localhost:5180
```

Vite proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`), so the
browser makes same-origin requests and **no backend CORS changes are needed**.
Override the proxy target with `VITE_DEV_API_PROXY`.

### 3. Create an account

Register at `/register`, then create an organization at `/app/onboarding`; the
creator receives the **Organization Owner** role. Upload a PDF/DOCX/TXT/image
and wait for the status to move from _Queued_ → _Processing_ → _Indexed_ before
asking questions about it.

> The live API rate-limits registration and rejects some reserved TLDs
> (for example `.test`). Use a normal domain such as `gmail.com`.

---

## Scripts

| Command              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Vite dev server on port **5180** with the API proxy |
| `npm run build`      | Type-check (`tsc -b`) and produce `dist/`           |
| `npm run preview`    | Serve the production build locally                  |
| `npm run lint`       | ESLint with `--max-warnings=0`                      |
| `npm run format`     | Prettier write                                      |
| `npm run test`       | Vitest single run                                   |
| `npm run test:watch` | Vitest watch mode                                   |
| `npm run typecheck`  | TypeScript only, no emit                            |
| `npm run api:types`  | Regenerate `src/types/api.d.ts` from `openapi.json` |

`npm run build`, `npm run lint` and `npm run test` are the acceptance gates and
all pass on a clean checkout.

---

## Environment variables

All are optional locally; only `VITE_`-prefixed values reach the bundle.

| Variable             | Default                 | Purpose                                         |
| -------------------- | ----------------------- | ----------------------------------------------- |
| `VITE_API_BASE_URL`  | `/api/v1`               | API base, including the version segment         |
| `VITE_APP_NAME`      | `Docuflow`              | Product name in metadata/labels                 |
| `VITE_MAX_UPLOAD_MB` | `25`                    | Client-side upload limit (keep ≤ backend limit) |
| `VITE_DEV_API_PROXY` | `http://localhost:8000` | Dev-only proxy target; never bundled            |

---

## Architecture

```
src/
├── app/              router, layouts, guards, providers
├── components/
│   ├── ui/           shadcn-style primitives (Radix + Tailwind)
│   └── shared/       cross-feature components (headers, states, palette)
├── features/
│   ├── auth/         login, register, password input, schemas
│   ├── organizations onboarding + workspace switcher + form
│   ├── landing/      public marketing page
│   ├── dashboard/    organization overview
│   ├── documents/    list, detail tabs, upload queue, folders, comments
│   ├── archive/      audit-derived recovery list + restore by ID
│   ├── ask/          streaming Ask AI client
│   ├── audit/        audit log with filter, paging and CSV export
│   ├── team/         member directory, invitations, role catalogue, invite page
│   ├── settings/     organization, account, theme, danger zone
│   ├── notifications notification menu
│   └── misc/         404
├── hooks/            capabilities, active organization, document title
├── lib/
│   ├── api/          fetch/XHR client, session, endpoints, error mapping
│   ├── permissions.ts role → capability map (documented gap)
│   ├── download.ts   presigned URL handling
│   └── …             constants, query keys, utils
├── store/            Zustand auth + UI stores
├── styles/           Tailwind layers, design tokens
└── types/            generated OpenAPI types + domain aliases
```

### Session handling

- Access token: **memory only** (never written to storage).
- Refresh token: `sessionStorage` — survives reloads, cleared when the tab
  closes or the user signs out.
- Active organization: `localStorage`, validated against the member's
  organization list on every bootstrap.
- A `401` triggers one silent `POST /auth/refresh` and a retry; a second `401`
  emits a session-expired event, clears caches and returns to `/login` with a
  notice. `403` renders the friendly permission state; network/5xx failures are
  retried by TanStack Query and surfaced with a retry action.

### Permissions

The API returns roles and permissions as separate catalogues but exposes **no
role→permission links and no "my permissions" endpoint**. The UI therefore maps
the role name from `GET /rbac/members/{user_id}/role` to capabilities in one
central file, `src/lib/permissions.ts`. Unknown roles fail closed. Every action
is still authorized by the backend; the UI treats its own mapping as a hint and
handles `403` gracefully. Swap the map for a server-provided permission list
when that endpoint exists.

The `organizations:create` capability is deliberately limited to
owner/platform-admin roles, and the API enforces the same rule: `POST
/organizations/` returns `403` unless the account has no memberships yet (its
first workspace) or holds `organization:manage` in an existing organization. A
Member, Contributor, Reviewer or Viewer who already belongs to an organization
therefore never sees “Create organization” in the switcher, and `/app/onboarding`
redirects them back to `/app`. Creating a first workspace is still available to
accounts that belong to no organization at all.

### Invitations and members

The Team screen lists the organization's members from `GET /members` (name,
email, role, join date and account status). Controls follow the backend's three
member permissions: `members:invite` shows the invite dialog and pending
invitations, `members:manage_roles` enables the inline role selector, and
`members:remove` enables removal; a role that lacks all three still sees the
directory. The invite dialog calls `POST /members/invitations` and returns a
single-use link to `/invite/{token}`; the invitee signs in (or registers) with the
invited address, sees the organization and role, and accepts. On success the app
refreshes the organization list and switches to the newly joined workspace.
Invitees receive the default `Member` role and never a personal workspace.

The link is displayed for copying because no SMTP service is configured; the
dialog also offers a prefilled `mailto:` draft. Pending invitations can be
revoked from the Team screen. Acceptance is restricted to the invited email
address, and administrative roles (Owner/Admin) can only be granted after the
person joins by someone with `members:manage_roles`.

### Uploads

- Extension + size validation before the request (client mirror of backend rules).
- Deduplicated queue with editable titles, per-file XHR progress, cancel/retry.
- Files go to `POST /documents`; versions go to
  `POST /documents/{id}/versions`.
- Titles derived from file names are title-cased, preserving acronyms.

### Downloads and previews

The API returns presigned object-storage URLs. `src/lib/download.ts` checks the
URL host before embedding it in an `<iframe>`/`<img>` and shows an explicit
error when the storage host is unreachable from the browser (common with
MinIO running on `localhost:9100` inside Docker). Downloads fall back to opening
the presigned URL in a new tab.

### Ask AI

`POST /query-stream` returns raw `text/plain` chunks (not SSE), so the client
reads the body stream and appends decoded text. SSE frames are also handled
defensively. Answers are rendered as sanitized Markdown; there is no `dangerouslySetInnerHTML`.
The API returns **no citation metadata** and queries are **organization-wide**,
not per document — the UI labels this clearly. Multiple-choice questions whose
options are in the source but whose answer key is not are answered by choosing
the best option and labeling it as inferred; all other answers stay grounded in
the retrieved context.

### Archive recovery

`GET /documents/search` excludes archived documents and there is no archived
listing endpoint. The Archive screen replays the most recent 300 `DOCUMENT`
audit events, derives the current archive state, and verifies each candidate
with `GET /documents/{id}`. `POST /documents/{id}/restore` returns a document to
the active register. Restore by ID covers documents outside the audit window;
users without `audit:read` only get that fallback. See [Backend gaps](#backend-gaps).

---

## Manual test checklist

Run through this against a fresh account and organization:

1. **Auth** — register, sign out, sign in; reload mid-session; wrong password
   shows an inline error; expired session returns to `/login` with a notice.
2. **Onboarding** — create a first organization; slug validation; copy the
   account ID shown on the setup screen; switch between organizations in the
   header (documents must not leak between them). A Member who already belongs
   to an organization sees no “Create organization” action, and `/app/onboarding`
   redirects to `/app`.
3. **Documents** — upload PDF/DOCX/TXT/PNG; reject `.zip` and >25 MB; edit the
   title; watch processing; search (title and body text); sort; paginate;
   create/rename/delete folders; bulk archive and restore.
4. **Archive** — open it from the sidebar or the folder panel; archive a
   document first to see the audit-derived list; restore it; restore by
   document ID; confirm the list refreshes and the document returns to search.
5. **Document detail** — Overview/Preview/Versions/Activity/Ask AI/Comments
   tabs; upload a new version; download both versions; archive and restore;
   add/reply/delete a comment; activity lists audit events.
6. **Ask AI** — suggested question, streamed answer, Stop, Regenerate, Copy;
   empty input disabled; rate limit and network failures surface a message.
7. **Audit** — filter by entity type, page forward/back, expand details,
   export the current page as CSV.
8. **Members & roles** — member directory with role/joined/status, inline role
   change, removal confirmation, pending invitations with copy-link and revoke,
   invite dialog, and the `/invite/:token` acceptance page. The role and
   permission catalogues remain available as reference tabs.
9. **Settings** — rename organization and change slug, session/account details,
   light/dark/system themes, typed-confirmation delete of a throwaway org.
10. **Accessibility/responsive** — keyboard-only navigation, visible focus,
    mobile sidebar drawer, skip link, reduced-motion preference, 404 inside and
    outside the app shell.

Automated coverage (`npm run test`) covers the capability map, API error
mapping, upload validation/title casing, the login flow, Ask AI streaming,
archive-event replay, the invitation builder/dialog and the `/invite/:token`
acceptance flow.

---

## Deployment

### Docker (static build + nginx)

```bash
docker build -t docuflow-web \
  --build-arg VITE_API_BASE_URL=/api/v1 .
docker run --rm -p 8080:80 docuflow-web
```

`nginx.conf` serves the SPA with history fallback, immutable asset caching, and
proxies `/api/` to the Compose service `backend:8000`. Point it at your API host
by editing the `upstream` block, or build with an absolute `VITE_API_BASE_URL`
(the API must then allow the web origin via CORS). `/healthz` is available for
container health checks.

### Vercel / static hosts

`vercel.json` configures the Vite build, SPA rewrites (leaving `/api/*` alone)
and security headers. Set `VITE_API_BASE_URL` in the project environment to your
API URL, or add a rewrite from `/api/:path*` to the backend and keep the default
relative base.

Serve `dist/` from any static host with a catch-all rewrite to `index.html`.

---

## Backend gaps

These are capabilities the UI would use but the API does not expose. They are
surfaced honestly in the interface rather than faked:

1. **No role → permission mapping / "my permissions" endpoint.** Capabilities
   are derived from role names client-side (see above); the catalogue of
   permission names is shown for reference only.
2. **No transactional email.** Member invitations are real API objects
   (`GET/POST /members/invitations`, preview, accept and revoke), but the API has
   no SMTP integration. The inviter copies the single-use link or an email draft
   from the dialog; the invitee joins the inviting organization as the chosen
   role (Member by default) after signing in with the invited address.
3. **No aggregate document statistics.** The dashboard derives counts and index
   coverage from the latest page (up to 100 documents) and labels the sample.
4. **No document-level filters or archived listing.**
   `GET /documents/search` supports only `q`, `folder_id`, `page`, `page_size`,
   `sort_by` and `sort_order` — no status, MIME type, uploader or date-range
   filters, and it always excludes archived documents. The Archive screen
   reconstructs the list by replaying the most recent 300 `DOCUMENT` audit
   events and verifying each candidate with `GET /documents/{id}`; it also
   offers restore-by-ID for anything outside that window. The list is therefore
   best-effort, not authoritative.
5. **RAG is organization-wide and uncited.** `/query` and `/query-stream` accept
   only a query string; there is no document scope, conversation memory, or
   source metadata, so answers must be verified against the source file.
6. **No audit totals or entity filtering.** `GET /audit-logs/` returns an array
   with `limit` (max 100) and `offset` but no total and no `entity_id` filter;
   pagination is forward/backward.
7. **No profile update, password change or MFA endpoints.** Account details are
   read-only.
8. **No per-document permissions or sharing.** Access is organization- + role-based.
9. **No bulk operations.** Bulk archive/restore is a client-side fan-out of
   individual calls, reported per document.
10. **No notification preferences or push.** Only in-app notifications with
    read/unread state.

---

## Known backend issues (observed, not caused by the UI)

These were reproduced against the reference backend while testing. The UI
surfaces them as errors or honest empty states; fixing them is backend work.

1. **Text extraction covers PDF, DOCX and plain-text formats.** `.txt`, `.md`,
   `.csv` and `.json` are read directly; `.docx` paragraphs and tables are
   parsed with `python-docx`. Images and legacy `.doc` files have no extractor
   (no OCR/antiword configured) and are marked `FAILED` with an explicit message
   instead of being reported as indexed.
2. **RAG needs pgvector.** The `documentchunk.embedding` column must be a
   `vector(384)` with the `vector` extension installed. On a database where the
   extension is missing, every chunk insert fails, the task rolls back, and the
   document is still marked `INDEXED`; Ask AI then answers “No relevant
   information found in documents.” This workstation runs the RAG-ready
   database in Docker (`pgvector/pgvector:pg16` on port `55432`) and the backend
   `.env` points at it; see the root README. On any other machine, install
   `postgresql-16-pgvector`, run `CREATE EXTENSION vector`, migrate the column
   and re-index.
3. **`POST /comments/documents/{id}/comments` returns 500.** Response validation
   trips over the lazily loaded `replies` relationship (`MissingGreenlet`). The
   comment is written but the UI shows the API error because the response fails.
4. **Ask AI is organization-wide and uncited** (see gap 5 above), and answers are
   generated text — verify against the source document.

---

## Assumptions

- The **live** API is the source of truth. The vendored spec differs from the
  repository copy only in the RAG mount (`/api/v1/query` vs `/rag/query`); the
  paths are centralized in `src/lib/constants.ts`.
- Roles are the eight names returned by `/rbac/roles`; the mapping is a UI
  convenience, not an authorization boundary.
- Uploads are capped at 25 MB in the UI; the backend limit wins if they differ.
- The app is same-origin in development (Vite proxy) and in the Docker image
  (nginx proxy). Split deployments require CORS on the API.
- Presigned storage URLs must be reachable by the browser for previews; the UI
  detects and explains unreachable hosts instead of failing silently.
