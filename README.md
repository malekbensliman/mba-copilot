# MBA Copilot

Your personal AI assistant for MBA coursework. Upload your course materials and chat with them using RAG (Retrieval-Augmented Generation).

**Stack:** Next.js + Python (FastAPI) + Pinecone + OpenAI

---

## Table of Contents

- [Quick Start (For Students)](#quick-start-for-students)
- [For Instructors: Complete Setup](#for-instructors-complete-setup)
- [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)
- [Cost Estimates](#cost-estimates)

---

## Quick Start (For Students)

You'll fill in one file — `.env` — across these steps, then paste it into Vercel. **No terminal required.**

### Step 1: Get your `.env` file

Two ways to get it:

- **From Canvas (easiest for the course):** download the ready-made `.env` your instructor posted — the OpenAI settings are already filled in, so you only add your Pinecone key and a password.
- **From GitHub:** download <a href="https://github.com/malekbensliman/mba-copilot/blob/main/.env.example" target="_blank">`.env.example`</a> and save it as `.env`. You'll fill in every value below.

Open it in any text editor and keep it handy — the next steps fill in its values.

### Step 2: Fork the repo, then set your secret and password

1. Create a <a href="https://github.com/" target="_blank">GitHub</a> account if you don't have one.
2. Go to the [MBA Copilot repository](https://github.com/malekbensliman/mba-copilot) and click **Fork** (top right). This creates your own copy.

Now fill in two values in your `.env` — neither needs an external account:

- **`AUTH_SECRET`** — visit <a href="https://generate-secret.vercel.app/32" target="_blank">generate-secret.vercel.app/32</a> and copy **one** value into your `.env`. It's a random server-side key that signs your login session so it can't be forged. You set it **once** and it never changes (the page shows a different string on every refresh — that's just it offering fresh randomness; pick one and keep it). You never type this to log in — that's the password below.
- **`AUTH_PASSWORD`** — choose a memorable password. You'll share it with anyone you want to give access (classmates, study group). Example: `columbia-rag-spring`.

### Step 3: Get your OpenAI access (5 minutes)

You have two options:

**Option A — Columbia Business School's endpoint (recommended for students)**

If your instructor provided access to Columbia's OpenAI endpoint, set in your `.env`:

- `OPENAI_API_KEY` = the key from your instructor
  - Can be found at <a href="https://cbsai.business.columbia.edu" target="_blank">https://cbsai.business.columbia.edu</a>
- `OPENAI_BASE_URL` = `https://cbsai.business.columbia.edu/api/v1`

**Option B — your own OpenAI account**

1. Go to <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>, sign in, and click **Create new secret key**.
2. Copy the key (starts with `sk-`), then set in your `.env`:
   - `OPENAI_API_KEY` = your key
   - `OPENAI_BASE_URL` = `https://api.openai.com/v1`
3. Note: you'll be charged based on usage (~$1–5/semester).

### Step 4: Get your Pinecone key and create the index (5 minutes)

1. Go to <a href="https://app.pinecone.io/" target="_blank">app.pinecone.io</a> and create a free account (you can "Skip" the optional account questions at the top).
2. Copy your default API key — or create one under **API Keys → + API Key** — and set it in `.env` as `PINECONE_API_KEY`.
3. Create the index: click **Database → Create Index** and configure it exactly:
   - **Name:** `mba-copilot`
   - **Model:** `text-embedding-3-large`
   - **Dimensions:** `1024`
   - **Metric:** `cosine`
   - **Cloud Provider:** AWS (other providers need a paid plan) · **Region:** `us-east-1`
4. Set `PINECONE_INDEX` = `mba-copilot` in `.env` (must match the index name).

**Important:** the dimension **must be 1024** to match the `text-embedding-3-large` embeddings this app uses.

### Step 5: Deploy to Vercel

1. Go to <a href="https://vercel.com" target="_blank">vercel.com</a>, sign in, and click **Add New → Project**.
2. Click **Continue with GitHub** and import your fork. Leave the build settings at their defaults (Framework: `Next.js`, Build: `npm run build`, Install: `npm install`).
3. Open the **Environment Variables** section and **paste your completed `.env`** — Vercel parses every `KEY=value` line at once. You should have all six: `AUTH_SECRET`, `AUTH_PASSWORD`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `PINECONE_API_KEY`, `PINECONE_INDEX`.
   - **Important:** apply them to **all environments** (Production, Preview, Development).
4. Click **Deploy**. After 2–3 minutes you'll get a live URL at `https://your-project.vercel.app`.

> If anything's misconfigured, the app shows a **setup banner** after you sign in, naming exactly what to fix (e.g. a wrong Pinecone dimension).

### Step 6: Create a Private Vercel Blob store

**Required.** Most course PDFs and slide decks are larger than 4 MB, and the app uploads those through Blob — temporary, **private** storage. Upload parts are deleted right after processing (free tier: 500 MB, your cost ≈ $0).

1. In your Vercel project, open the **Storage** tab → **Create Database → Blob**. When prompted for access, choose **Private**, name it (e.g. `mba-copilot-files`), and create it.
2. Click **Connect to Project** → select your project → **Connect**.
3. Open **Settings → Deployment Protection** and disable **Vercel Authentication** (so you can share your app if you wish).
4. Open the **Deployments** tab → the latest deployment's **⋯** menu → **Redeploy**.

Vercel adds the `BLOB_READ_WRITE_TOKEN` variable automatically. The store **must be Private** — the backend reads upload parts with that token, so your documents are never exposed at a public URL. (If the setup banner flags Blob after you sign in, the store isn't connected yet.)

### Step 7: Sign In

1. Go to your deployed app URL
2. Enter the password you set in `AUTH_PASSWORD`
3. Click "Sign In"
4. You're in! You'll stay logged in for 30 days.

**Note:** Anyone with your password can access the app. Keep it secure!

### Step 8: Managing Access

**To share access with someone:**

1. Give them your app URL
2. Share the `AUTH_PASSWORD` with them (via secure channel)
3. They sign in with the password

**To revoke access from everyone:**

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Change `AUTH_PASSWORD` to a new value
3. Redeploy (Vercel will prompt you)
4. Share the new password only with people you still want to have access
5. Everyone else will be logged out and can't sign back in

### Step 9: Making Updates (Auto-Deploy)

Once deployed, Vercel automatically redeploys your app whenever you push changes to your GitHub repository.

**To update your app:**

1. Make changes to your forked repository on GitHub (edit files directly or push from local)
2. Commit and push to the `main` branch
3. Vercel automatically detects the changes and redeploys (takes 2-3 minutes)
4. You'll get a notification when the new version is live

**To disable auto-deploy:**

1. Go to your Vercel project dashboard
2. Settings → Git → Production Branch
3. Uncheck "Automatically deploy" (not recommended)

---

## For Instructors: Complete Setup

The [Quick Start](#quick-start-for-students) above is written for **students** forking your published copy. If you want to **adopt this template for your own course** — rename, customize, distribute to students — here's the short version.

### Adopt this template

1. **Fork** this repository on GitHub to your account or course organization.
2. **Clone** your fork locally to test and customize:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mba-copilot.git
   cd mba-copilot
   ```
3. **Set up local development** — follow [Local Development](#local-development) below to install the pinned tools (mise + uv), create a `.env`, and run `mise run dev-all` to verify everything works locally.
4. **Customize** as needed — see [Customization](#customization) for the AI model, system prompt, RAG settings, and colors.
5. **Deploy your own copy** — follow the student [Quick Start](#quick-start-for-students) from Step 5 onward to put your customized version on Vercel.
6. **Distribute** — share your fork's URL with students; they fork yours and follow the Quick Start.

### Optional: pre-fill `.env` on Canvas

If you provide a shared OpenAI endpoint (e.g. Columbia's `cbsai.business.columbia.edu`), you can pre-fill `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `PINECONE_INDEX` in a starter `.env` and post it to Canvas. Students still set their own `AUTH_SECRET`, `AUTH_PASSWORD`, and `PINECONE_API_KEY`.

> ⚠️ **Never pre-fill `AUTH_SECRET`** in a shared `.env`. A shared secret would let any classmate who has the Canvas file forge a session cookie on another student's deployment and bypass `AUTH_PASSWORD`. Each student must generate their own.

---

## Local Development

### Prerequisites

- <a href="https://mise.jdx.dev/" target="_blank">mise</a> — manages the pinned Python (3.12.2) and Node (20) versions and loads `.env`
- <a href="https://docs.astral.sh/uv/" target="_blank">uv</a> — Python dependencies and virtualenv

### Quick Start

```bash
# Install the pinned tool versions (Python 3.12.2, Node 20)
mise install

# One-time setup (creates the uv venv, installs Python + Node deps)
mise run setup

# Start both servers (frontend on :3000, backend on :8000)
mise run dev-all
```

Or run them separately:

```bash
# Terminal 1: Backend
mise run dev-api

# Terminal 2: Frontend
mise run dev
```

### Tasks

`mise tasks` lists everything. The common ones:

```bash
mise run setup        # Install Python (uv) + Node (npm) dependencies
mise run dev-all      # Start frontend (:3000) and backend (:8000) together
mise run dev          # Frontend only (Next.js)
mise run dev-api      # Backend only (FastAPI)
mise run build        # Build the Next.js app for production
mise run format       # Format Python with ruff
mise run lint         # Lint Python (ruff + ty) and TypeScript (eslint)
mise run typecheck    # Type-check the backend with ty
mise run check        # Read-only: format-check + lint + types
mise run test         # Run the Python test suite (pytest)
mise run requirements # Regenerate requirements.txt for Vercel after dep changes
mise run clean        # Remove build artifacts and caches
mise run nuke         # Full reset (removes venv + node_modules)
```

### How Local Development Works

```
┌─────────────────────────────────────────┐
│         http://localhost:3000           │
│              (Next.js)                  │
│                                         │
│  Your browser talks to Next.js, which   │
│  gates /api/backend/* with the session  │
│  and forwards to the Python backend     │
└─────────────────────────────────────────┘
                    │
                    │ /api/backend/* (authenticated)
                    ▼
┌─────────────────────────────────────────┐
│         http://localhost:8000           │
│            (FastAPI/Python)             │
│                                         │
│  Handles all backend logic:             │
│  • Document processing                  │
│  • Embeddings                           │
│  • Pinecone operations                  │
│  • Chat completions                     │
└─────────────────────────────────────────┘
```

In development the Next.js `/api/backend/*` route verifies the session and forwards requests to FastAPI on `localhost:8000`. In production, `vercel.json` routes `/backend/*` to the Python serverless function, and that same `/api/backend/*` route forwards to it with an internal-auth header.

### Environment Variables

| Variable           | Required | Description                                                                                  |
| ------------------ | -------- | -------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`      | Yes      | Server-side key that signs login sessions (web: `generate-secret.vercel.app/32`, or `openssl rand -base64 32`) |
| `AUTH_PASSWORD`    | Yes      | Password for accessing the app                                                               |
| `OPENAI_API_KEY`   | Yes      | Your OpenAI API key (from OpenAI or instructor)                                              |
| `OPENAI_BASE_URL`  | Yes      | OpenAI endpoint: `https://api.openai.com/v1` or `https://cbsai.business.columbia.edu/api/v1` |
| `PINECONE_API_KEY` | Yes      | Your Pinecone API key                                                                        |
| `PINECONE_INDEX`   | No       | Index name (default: `mba-copilot`)                                                          |

---

## Project Structure

```
mba-copilot/
├── serverless/
│   └── backend/
│       └── index.py          # Python backend (FastAPI): chunking, embeddings, Pinecone, RAG
├── app/
│   ├── layout.tsx            # Next.js layout
│   ├── page.tsx              # Main chat UI
│   ├── components/           # DocumentTree, SettingsModal, PasswordGate, ...
│   ├── api/backend/[...path]/ # Authenticated proxy to the Python backend
│   ├── api/upload-chunk/     # Chunked large-file upload
│   └── types.ts              # TypeScript types
├── lib/backend.ts            # Proxy helpers (internal-auth token, backend URL)
├── auth.ts, proxy.ts         # NextAuth (proxy.ts is Next 16's renamed middleware)
├── tests/                    # Python tests (pytest)
├── .mise.toml                # Tool versions (uv, Node) + .env loading
├── pyproject.toml            # Python dependencies (uv)
├── requirements.txt          # Generated from pyproject.toml for Vercel's Python build
├── package.json              # Node dependencies
├── vercel.json               # Vercel config (routes /backend/* to Python)
├── .env.example              # Environment template
└── README.md
```

---

## Customization

### Change the AI Model

In `serverless/backend/index.py`, find the `Config` class:

```python
CHAT_MODEL = "gpt-4o-mini"    # Default: good balance
# CHAT_MODEL = "gpt-4o"       # More capable, higher cost
# CHAT_MODEL = "gpt-3.5-turbo"  # Fastest, lowest cost
```

### Customize the System Prompt

Edit the default `system_prompt` in `app/types.ts` (`DEFAULT_SETTINGS`), or change it per-session in the in-app Settings panel:

```typescript
system_prompt: `You are an intelligent assistant for MBA students...`
```

### Adjust RAG Settings

In the `Config` class in `serverless/backend/index.py` (chunking is token-based):

```python
CHUNK_TOKENS_DOCS = 800          # Tokens per chunk
CHUNK_OVERLAP_TOKENS_DOCS = 150  # Token overlap between chunks
RETRIEVAL_TOP_K = 20             # Candidate chunks retrieved from Pinecone
CONTEXT_MAX_CHUNKS = 8           # Best chunks passed to the LLM
MIN_SCORE = 0.25                 # Minimum similarity (0-1)
```

### Change Colors

Edit `tailwind.config.ts` to change the Columbia Blue palette:

```typescript
colors: {
  columbia: {
    500: '#0c87f2',  // Primary
    600: '#006fcf',  // Darker
    // ...
  },
},
```

---

## Troubleshooting

### Local Development Issues

**"mise: command not found" or wrong Python/Node version**

```bash
# macOS
brew install mise
# Add to ~/.zshrc:  eval "$(mise activate zsh)"

# Then, in the project, install the pinned versions:
mise install   # Python 3.12.2 + Node 20
```

**"Cannot connect to backend"**

- Make sure you ran `mise run dev-all` or `mise run dev-api`
- Check that port 8000 is not in use: `lsof -i :8000`
- Verify `.env` exists with valid API keys

**"Module not found" in Python**

```bash
mise run nuke
mise run setup
```

**"CORS error"**

- Access via `localhost:3000`, not `127.0.0.1:3000`

### Deployment Issues

**Setup banner appears with a failing check**

- The `/setup` diagnostics found a misconfigured key, index, or store. The banner names exactly what to fix — correct it in Vercel → Environment Variables (or Storage), then **redeploy** (env vars are baked into each deployment).

**Pinecone errors**

- **Dimension mismatch** — the index must be exactly **1024** dimensions to match `text-embedding-3-large`. Recreate it with 1024.
- **Index not found** — `PINECONE_INDEX` must match the index name exactly (case-sensitive).
- **Invalid API key** — recopy the full key from the Pinecone console.

**Upload fails**

- Small files (< 4 MB) post to `/api/backend/extract` directly. Large files use chunked uploads through Vercel Blob — confirm the Blob store is connected and **Private** (Step 6); the setup banner will flag it if not.
- Supported formats: PDF, DOCX, PPTX, TXT, MD, CSV.
- A flaky part can transiently fail; the browser retries each part up to 3 times. If a file still fails, try a smaller one — very large files (~80 MB+) may exceed Vercel's per-function limits even with chunked uploads.

**API errors**

- Verify all keys in Vercel → Environment Variables. After any change, **redeploy** so the new values take effect.
- Check Vercel → Functions logs for the underlying error.

### Authentication Issues

**"Invalid credentials" error:**

1. Double-check you're entering the correct `AUTH_PASSWORD`
2. Verify `AUTH_PASSWORD` is set correctly in Vercel environment variables
3. If you recently changed it, make sure you redeployed

**Can't sign in at all:**

- Verify `AUTH_SECRET` is set in environment variables
- Make sure `AUTH_SECRET` is the same across all deployments
- Clear browser cookies and try again

**Session expires too quickly:**

- Sessions last 30 days by default
- If you change `AUTH_SECRET`, all sessions are invalidated
- Clearing browser cookies will also log you out

### Getting Help

1. Check the Vercel function logs for error details
2. Open an issue on this repository
3. Ask in the course discussion forum

---

## Cost Estimates

| Service         | Free Tier                   | Typical Usage |
| --------------- | --------------------------- | ------------- |
| **Pinecone**    | 2GB storage, 1M reads/month | $0            |
| **OpenAI**      | Pay-as-you-go               | $1-5/semester |
| **Vercel**      | Hobby plan free             | $0            |
| **Vercel Blob** | 500MB storage               | $0\*          |

**Total estimated cost:** $1-5/semester (OpenAI usage only)

**\*Vercel Blob:** Upload parts go to a **private** Blob store and are deleted right after the file is processed — well within the free 500 MB tier. Only the text embeddings persist (in Pinecone).

---

## License

MIT - Use and modify freely for your own learning!

---

_Built for Columbia Business School's "Generative AI for Business" course._
