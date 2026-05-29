# MBA Copilot — Deployment Hardening & Core Fixes

- **Date:** 2026-05-29
- **Status:** Draft — pending user review
- **Owner:** Malek Ben Sliman

## 1. Summary

MBA Copilot is a RAG document-Q&A app (Next.js 16 + FastAPI on Vercel, OpenAI + Pinecone) that each student self-deploys for a Columbia Business School course. The current self-deploy flow is error-prone, the password auth has a hole, large-file uploads are fragile on Vercel's free tier, document deletion is silently broken on Pinecone serverless, and the README has drifted out of date.

This spec covers the work to make the student self-deploy reliable and the app correct, while preserving two things the maintainer values: the **free tier**, and students doing their own setup (it's part of the learning).

## 2. Goals

- Student deploy path stays **100% browser-based** (no terminal) and **free**.
- Reduce env-var mistakes without removing the steps students learn from.
- Close the auth hole exposing the backend.
- Make large-file ingestion reliable within free-tier limits.
- Fix document delete so it actually removes data from Pinecone.
- Protect student documents in transit (private Blob).
- Bring the README back in line with reality.
- Align the maintainer's local workflow with the dotfiles convention (mise).

## 3. Non-goals / deferred

- **Agentic RAG bonus** — feasible and attractive, deferred to a later spec. (Verify CBS endpoint supports OpenAI tool calling before committing.)
- **Deep refactor of the 916-line `serverless/backend/index.py`** — only targeted improvements where this work already touches the file; a full module split is a separate follow-up.
- **Instructor-hosted single shared instance** — considered and rejected; the per-student self-deploy model (own keys, own data) is retained.

## 4. Constraints (decided)

- **Platform: Vercel free Hobby.** Only option that runs Next.js + Python natively, free, browser-only, with no cold-start tax. (Render rejected for free-tier cold starts; Railway needs a card; HF Spaces/Replit need a Docker rewrite.)
- **Architecture stays two-runtime** (Next.js + Python). Most uploads exceed 4.5MB, so server-side extraction (pymupdf/python-docx/python-pptx) and therefore the Python backend are retained.
- **Distribution: fork-based.** Student forks on GitHub, then imports the fork into Vercel. No deploy button. Rationale: GitHub "Sync fork" gives terminal-free updates, and the fork count/list gives the instructor adoption tracking — both impossible with a Vercel clone.
- **Vercel free-tier function limits:** 4.5MB request body, 60s max duration. The design must respect both.

## 5. Architecture decisions

### 5.1 Env-var entry: blank `.env` → bulk paste
Ship a complete `.env.example`. Students fill in values and paste the whole file into Vercel's env-var screen (which parses all `KEY=value` lines at once). This eliminates variable-**name** typos (the main failure mode). Remove the `openssl rand` terminal reference; point `AUTH_SECRET` at the web generator.

### 5.2 Conditional setup diagnostics (`/setup`)
A read-only diagnostic, surfaced **only on failure**. On load the app runs a health check (keys present; Pinecone reachable and index dimension == 1024; OpenAI key + base URL authenticate). If green, go straight to the app. If something fails, render a focused "fix this" panel naming the exact problem and where to correct it. It diagnoses; the student repairs in the Vercel dashboard. Requires the backend to return clean, typed config errors (see 5.4) so the frontend can distinguish "misconfig" from "crash."

### 5.3 Private Blob + signed read
Switch the Blob store from public to **private** (Vercel private storage). The Python backend currently fetches parts with an unauthenticated `httpx.get`, which requires public blobs and exposes student documents at public (if unguessable) URLs — worsened by cleanup being best-effort with swallowed errors. New flow: generate a short-lived signed/authenticated read URL server-side for the backend to fetch each part, and make cleanup failures visible (no silent `catch`).

### 5.4 Backend authentication
**Today the backend is unauthenticated.** `proxy.ts`'s matcher excludes `/backend/*`, and `vercel.json` routes `/backend/(.*)` straight to the Python function — so anyone with the URL can call `/backend/chat`, `/backend/upload`, `/backend/documents` directly, bypassing the password.

Fix: the Python backend verifies the NextAuth session JWT on every request, using the shared `AUTH_SECRET` (HS256). Same-origin browser calls already send the session cookie, so the backend reads and verifies it and returns 401 otherwise. This reuses the existing password auth with no new secrets. (Verify NextAuth v5's JWT/cookie format and claims during implementation.)

## 6. Workstreams

### A. Distribution & setup
- `.env.example`: complete, ordered, with inline comments and the CBS-vs-OpenAI base-URL options.
- `/setup` diagnostics page/panel per 5.2.
- Confirm fork → Vercel import flow end to end (incognito walkthrough).

### B. Large-file ingestion (batched, browser-orchestrated)
- Keep Blob for >4.5MB byte transfer (now private, 5.3).
- Replace the all-in-one-request processing with a browser-driven loop: **upload → extract (one quick call) → embed in batches (~30–50 chunks/call) → upsert per batch → progress bar**, each call comfortably under 60s.
- This also bounds embedding concurrency, fixing the current unbounded `asyncio.gather` that risks tripping the CBS endpoint's Cloudflare rate limits on big documents.

### C. Security fixes
- Backend JWT verification per 5.4 (highest priority).
- CORS: replace `allow_origins=["*"]` + `allow_credentials=True` with the actual deployment origin.
- Stop returning raw tracebacks to clients; return clean typed errors (also enables 5.2).

### D. Pinecone correctness
- **Delete by ID prefix, not metadata filter.** Serverless + the pinned `pinecone-client` v3 do not support delete-by-metadata, so `delete_document` silently fails today — the delete button appears to do nothing and chunks remain. Chunk IDs are `{document_id}_chunk_{i}`, so use `index.list(prefix=f"{document_id}_")` → `index.delete(ids=[...])`.
- This same fix repairs **re-upload de-dupe** (`_process_file` deletes an existing same-named doc before re-adding; currently broken → duplicate chunks).
- Toggle/exclusion already works (query-with-filter is supported on serverless). Minor UX clarification: documents load all-selected; unchecking *all* reverts to searching all (not none) — document this as "select to narrow."
- `list_documents()` (zero-vector query, capped at 100) is fragile but functional — leave as-is for now.

### E. Tooling: mise (independent)
- Add `.mise.toml`: `python = "3.12.2"`, `node = "20"`, `[env] _.file = ".env"`.
- Expose existing Makefile targets via `mise run` (mise discovers Makefile tasks) or mirror key tasks in `[tasks]`. Incremental; the Makefile can remain during transition.
- Affects only local/instructor workflow, not the student path.

### F. README rewrite
- Fix stale references: pyenv/Poetry/Python 3.11.9/`api/index.py`/`npm run dev:api|dev:all|setup` → uv, Python 3.12.2, `serverless/backend/index.py`, real commands.
- Correct the Project Structure diagram.
- Restructure into: **Students** (browser-only: fork, create Pinecone index with 1024 dims, web-generate `AUTH_SECRET`, fill + paste `.env`, private Blob), **Instructors/local dev** (terminal OK: mise + uv), **Architecture**.
- Document the new upload flow, the `/setup` page, and the private Blob requirement.

### G. Project Claude Code config
- **`CLAUDE.md` (project root)** — the primary deliverable. Captures what isn't derivable from the code or is easy to get wrong:
  - Architecture: Next.js 16 (App Router) + FastAPI; `vercel.json` routes `/backend/*` directly to Python; `proxy.ts` is Next 16's renamed middleware.
  - Commands: mise / uv / Makefile equivalents — dev, lint, test, and regenerating `requirements.txt` for Vercel.
  - Conventions: ruff (google docstrings, line-length 100, mccabe ≤15), mypy strict (`disallow_untyped_defs`).
  - Load-bearing gotchas this work establishes: **Pinecone serverless ⇒ delete by ID prefix, never metadata-filter delete**; **Blob is private + signed read**; **backend verifies the NextAuth JWT**; **Vercel free limits: 4.5MB body, 60s**; `requirements.txt` is generated and must stay in sync with `pyproject.toml`.
  - Student (browser-only) vs instructor (terminal: mise + uv) workflows.
- **`.claude/settings.json` hooks** (low-risk, mirror existing Makefile targets): ruff-format-on-edit for `serverless/**/*.py`; a `requirements.txt` drift guard when `pyproject.toml`/`uv.lock` change.
- **Optional, opt-in (not default):** a `security-reviewer` subagent scoped to the proxy/upload/auth surface; Pinecone + Vercel entries in `.mcp.json`. Listed for the maintainer to pull in if wanted.

## 7. Sequencing

1. **G (CLAUDE.md + hooks)** + **E (mise)** — independent setup; do first so the documented conventions and gotchas guide everything after.
2. **C (security)** + **D (Pinecone)** — correctness/safety, independent of deploy UX; highest-value.
3. **B (batched ingestion)** + **5.3 (private Blob)** — coupled (both touch the upload path).
4. **A (setup/diagnostics)** — depends on C's clean typed errors.
5. **F (README)** — last, documents the final state.

**Parallelism note (for subagent execution):** C, D, and B all modify `serverless/backend/index.py`, so they must share a single owner/sequence to avoid clobbering — they are *not* safe to run as concurrent agents against the same file. Genuinely parallel-safe units: E (config files), G (mostly a new file + `.claude/`), and the frontend-only pieces of A. Every parallel subagent's diff is reviewed and verified before integration.

## 8. Verifications needed during implementation

- Confirm the Pinecone delete actually fails on the live serverless index (delete a doc in-app, check the console).
- Confirm NextAuth v5 JWT/cookie format for backend verification (5.4).
- Confirm Vercel private Blob beta is available on the account and supports signed reads (5.3).
- (For the deferred agentic bonus) confirm the CBS endpoint supports OpenAI function/tool calling.

## 9. Testing approach

- Backend: unit tests for chunking, delete-by-prefix, and JWT verification; `make test` / pytest.
- Ingestion: end-to-end upload of a large PPTX and a large PDF on a real free-tier deploy, watching for the 60s wall.
- Auth: verify direct `/backend/*` calls without a session are rejected (401).
- Deploy: incognito fork → import → `.env` paste → `/setup` green → upload → chat, as a student would.
