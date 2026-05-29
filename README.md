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
- `OPENAI_BASE_URL` = `https://cbsai.business.columbia.edu/api/v1`

(If you downloaded the `.env` from Canvas, these may already be filled in — you can skip this step.)

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

### Step 6: Enable Vercel Blob Storage (for large files)

**Required** if you'll upload files larger than 4 MB (big PDFs or slide decks). Blob is temporary storage for large uploads; files are deleted right after processing (free tier: 500 MB, your cost ≈ $0).

1. In your Vercel project, open the **Storage** tab → **Create Database → Blob**, name it (e.g. `mba-copilot-files`), and click **Create**.
2. Click **Connect to Project** → select your project → **Connect**.
3. Open **Settings → Deployment Protection** and disable **Vercel Authentication** (so classmates can reach the app without a Vercel login).
4. Open the **Deployments** tab → the latest deployment's **⋯** menu → **Redeploy**.

Vercel adds the `BLOB_READ_WRITE_TOKEN` variable automatically. **Skip this** if you only upload small files (< 4 MB).

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

### Troubleshooting Deployment

**If deployment fails:**

1. Check the build logs in Vercel dashboard
2. Verify all environment variables are set correctly
3. Make sure your Pinecone index exists and has **1024 dimensions** (not 768 or 1536)
4. Ensure your OpenAI API key is valid and has credits
5. Verify you're using the `text-embedding-3-large` model (default in this project)

**Common Pinecone issues:**

- **"Dimension mismatch"** - Your index must have exactly 1024 dimensions
- **"Index not found"** - Check that `PINECONE_INDEX` matches your index name exactly
- **"Invalid API key"** - Verify you copied the full API key from Pinecone console

---

## For Instructors: Complete Setup

This section walks you through setting up the template on GitHub so students can deploy it.

### Prerequisites

- <a href="https://git-scm.com/downloads" target="_blank">Git</a> installed
- <a href="https://mise.jdx.dev/" target="_blank">mise</a> installed (manages the Python + Node versions)
- <a href="https://docs.astral.sh/uv/" target="_blank">uv</a> installed (Python dependencies)
- Make (comes with macOS/Linux, or install via `choco install make` on Windows)
- A <a href="https://github.com/" target="_blank">GitHub</a> account
- A code editor (VS Code recommended)

### Step 1: Create GitHub Repository

**Option A: Via GitHub Website (Easier)**

1. Go to <a href="https://github.com/new" target="_blank">github.com/new</a>
2. Repository name: `mba-copilot`
3. Description: "Personal AI copilot for MBA students"
4. Choose **Public** (so students can fork it)
5. **Don't** initialize with README (we'll push our own)
6. Click **Create repository**
7. Keep this page open - you'll need the URL

**Option B: Via Terminal**

```bash
# Install GitHub CLI if you haven't
brew install gh  # macOS
# or visit <a href="https://cli.github.com/" target="_blank">cli.github.com</a>

# Login to GitHub
gh auth login

# Create repo
gh repo create mba-copilot --public --description "Personal AI copilot for MBA students"
```

### Step 2: Clone and Set Up Locally

```bash
# Navigate to where you want the project
cd ~/Projects  # or wherever you keep code

# Clone your empty repo
git clone https://github.com/YOUR_USERNAME/mba-copilot.git
cd mba-copilot

# Copy the template files into this directory
# (Unzip the template you downloaded and copy all files here)
```

Or if starting fresh:

```bash
# Initialize the project in an existing directory
cd mba-copilot
git init
git remote add origin https://github.com/YOUR_USERNAME/mba-copilot.git
```

### Step 3: Install Dependencies

```bash
# Install the pinned Python (3.12.2) and Node (20) versions
mise install

# Create the uv venv and install Python + Node dependencies
mise run setup
```

This will:

- Use the Python 3.12.2 and Node 20 versions pinned in `.mise.toml`
- Create a project-local `.venv` via uv
- Install all Python dependencies (uv) and Node dependencies (npm)

### Step 4: Set Up Environment Variables

```bash
# Copy the example env file (gitignored; loaded by mise and the backend)
cp .env.example .env

# Edit with your editor and fill in every value
code .env
```

`.env.example` lists all required variables — `AUTH_SECRET`, `AUTH_PASSWORD`,
`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `PINECONE_API_KEY`, and `PINECONE_INDEX`.
`AUTH_SECRET` must be set for both the frontend session and the backend auth check.

### Step 5: Test Locally

```bash
# Start both frontend and backend
mise run dev-all
```

You should see:

```
*** Starting both frontend and backend
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

**Open <http://localhost:3000>** in your browser.

**Test it:**

1. Upload a PDF or text file
2. Wait for "X chunks indexed" message
3. Ask a question about the document

(Press Ctrl+C to stop both servers)

### Step 6: Push to GitHub

Once everything works locally:

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit: MBA Copilot template"

# Push to GitHub
git push -u origin main
```

### Step 7: Update the Deploy Button

Edit `README.md` and replace `YOUR_USERNAME` with your actual GitHub username in the deploy button URL:

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_ACTUAL_USERNAME%2Fmba-copilot&env=OPENAI_API_KEY,PINECONE_API_KEY&envDescription=API%20keys%20for%20OpenAI%20and%20Pinecone&envLink=https%3A%2F%2Fgithub.com%2FYOUR_ACTUAL_USERNAME%2Fmba-copilot%23-quick-start-for-students&project-name=mba-copilot&repository-name=mba-copilot)
```

Commit and push:

```bash
git add README.md
git commit -m "Update deploy button URL"
git push
```

### Step 8: Test the Deploy Flow

1. Open your repo in a **private/incognito browser window**
2. Click the "Deploy with Vercel" button
3. Walk through the flow as a student would
4. Verify the deployed app works

---

## Local Development

### Prerequisites

- <a href="https://mise.jdx.dev/" target="_blank">mise</a> — manages the pinned Python (3.12.2) and Node (20) versions and loads `.env`
- <a href="https://docs.astral.sh/uv/" target="_blank">uv</a> — Python dependencies and virtualenv
- Make (comes with macOS/Linux)

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

### Available Tasks (`mise tasks`)

```bash
mise tasks       # List all available tasks
mise run setup       # Install everything
mise run dev-all     # Start both servers
mise run dev         # Frontend only
mise run dev-api     # Backend only
mise run format      # Format Python code
mise run lint        # Lint all code
mise run clean       # Remove build artifacts
mise run nuke        # Full reset (removes venv + node_modules)
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
| `AUTH_SECRET`      | Yes      | Random secret for NextAuth (generate with `openssl rand -base64 32`)                         |
| `AUTH_PASSWORD`    | Yes      | Password for accessing the app                                                               |
| `OPENAI_API_KEY`   | Yes      | Your OpenAI API key (from OpenAI or instructor)                                              |
| `OPENAI_BASE_URL`  | Yes      | OpenAI endpoint: `https://api.openai.com/v1` or `https://cbsai.business.columbia.edu/api/v1` |
| `PINECONE_API_KEY` | Yes      | Your Pinecone API key                                                                        |
| `PINECONE_INDEX`   | No       | Index name (default: `mba-copilot`)                                                          |

### Useful Commands

```bash
mise run dev-all      # Both servers
mise run dev          # Frontend only (Next.js on :3000)
mise run dev-api      # Backend only (FastAPI on :8000)
mise run format       # Format Python with ruff
mise run lint         # Lint Python (ruff + ty) and TypeScript (eslint)
mise run test         # Run the Python test suite (pytest)
mise run requirements # Regenerate requirements.txt for Vercel after changing deps
```

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
├── Makefile                  # Development commands
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

**"No relevant documents found"**

- Upload documents first
- Check Pinecone console to verify index exists
- Ensure index has dimension 1024

**"Upload failed" or "403 Forbidden"**

- **For small files (< 4MB):** Check Vercel function logs for details
- **For large files (> 4MB):** Make sure you've set up Vercel Blob storage (see Step 6)
- Verify `BLOB_READ_WRITE_TOKEN` is set in your environment variables
- Try a different file format (PDF, DOCX, PPTX, TXT, MD, CSV supported)
- Check file isn't corrupted by opening it locally first

**"API errors"**

- Verify API keys in Vercel environment settings
- Check Vercel function logs for details

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

**\*Vercel Blob Note:** Files are automatically deleted after processing, so you'll stay well within the free 500MB tier. Only the text embeddings are stored permanently in Pinecone.

**No external auth services needed!** Authentication uses simple password check built into the app.

---

## License

MIT - Use and modify freely for your own learning!

---

_Built for Columbia Business School's "Generative AI for Business" course._
