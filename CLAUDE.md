# CLAUDE.md — MBA Copilot

Personal RAG copilot for MBA students: upload course documents, chat with them.
Each student **self-deploys their own instance** (fork → Vercel) with their own
OpenAI + Pinecone keys. Built for a Columbia Business School GenAI course.

## Stack & layout

- **Frontend:** Next.js 16 (App Router, React 19), Tailwind, NextAuth v5. Code in `app/`.
- **Backend:** FastAPI, Python 3.12 — single module `serverless/backend/index.py`
  (chunking, embeddings, Pinecone ops, RAG, routes).
- **Vector DB:** Pinecone **serverless**, index dimension **1024**, cosine
  (matches OpenAI `text-embedding-3-large` requested at 1024 dims).
- **LLM/embeddings:** OpenAI, or CBS's OpenAI-compatible endpoint via `OPENAI_BASE_URL`.
- **Hosting:** Vercel — Next on `@vercel/next`, Python on `@vercel/python`.
  `vercel.json` routes `/backend/*` to the Python function. `proxy.ts` is Next 16's
  renamed middleware (formerly `middleware.ts`).

## Commands (local dev — for maintainers/instructors; students never touch a terminal)

Tooling: **mise** (tool versions + `.env` loading) + **uv** (Python deps/venv); Node via mise.

- `make setup` — install everything · `make dev-all` — both servers · `make dev` / `make dev-api`
- `make lint` — ruff + mypy + eslint · `make format` — ruff · `make test` — pytest
- `make requirements` — regenerate `requirements.txt` from `pyproject.toml` **for Vercel's
  Python build**. Run after any dependency change, or the deploy ships stale deps.

## Conventions

- Python: ruff (google-style docstrings, line-length 100, mccabe ≤15) + mypy strict
  (`disallow_untyped_defs` — every function fully type-annotated).
- TypeScript: eslint (no prettier).

## Gotchas (load-bearing — these cause silent failures if ignored)

- **Pinecone serverless does NOT support delete-by-metadata-filter.** Always delete by
  **ID**: chunk IDs are `{document_id}_chunk_{i}`, so list by prefix `{document_id}_` then
  delete those IDs. Query-by-filter is fine; *delete*-by-filter is not.
- **Vercel free tier: 4.5MB request-body limit and 60s function cap.** Large files upload
  via chunked Blob upload; document processing must be batched to stay under 60s.
- **Vercel Blob must be private** (signed read for the backend) — never expose student
  documents at public URLs.
- **`/backend/*` must be reached only through the auth-gated Next forwarding route**
  (shared token derived from `AUTH_SECRET`); never leave the Python endpoints open.
- Never return raw tracebacks to clients — log server-side, return clean messages.

## Environment variables

`AUTH_SECRET`, `AUTH_PASSWORD`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `PINECONE_API_KEY`,
`PINECONE_INDEX`. Students fill a blank `.env` and paste it into Vercel's env-var screen.

## Deploy model

- **Students:** browser-only — fork the repo, create the Pinecone index (1024 dims),
  web-generate `AUTH_SECRET`, fill + paste `.env` into Vercel, deploy. Doing the setup
  themselves is intentional — it's part of the course.
- **Maintainers/instructors:** terminal OK — mise + uv local dev.

## Active work

In-flight deployment hardening + fixes (auth routing, private Blob, batched ingestion,
Pinecone delete fix, README) are specced in
`docs/superpowers/specs/2026-05-29-mba-copilot-deploy-and-fixes-design.md`. Several gotchas
above are the *target* rules being brought into the code now.
