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

### Step 1: Get API Keys (5 minutes)

The copilot requires keys from both OpenAI and Pinecone.

**OpenAI Configuration:**

You have two options for accessing OpenAI:

#### Option A: Use Columbia Business School's OpenAI Access (Recommended for students)

If your instructor has provided access to Columbia's OpenAI endpoint:

1. You'll receive an API key from your instructor
2. You'll use:
   - **API Key:** The key provided by your instructor
   - **Base URL:** `https://cbsai.business.columbia.edu/api/v1`
3. Skip to Step 2 (you don't need to create your own OpenAI account)

#### Option B: Use Your Own OpenAI Account

1. Go to <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. You'll use:
   - **API Key:** Your OpenAI key
   - **Base URL:** `https://api.openai.com/v1`
6. Note: You'll be charged based on usage (~$1-5/semester)

**Pinecone API Key:**

1. Go to <a href="https://app.pinecone.io/" target="_blank">app.pinecone.io</a>
2. Create a free account
3. Click "API Keys" in the sidebar
4. Copy your API key

### Step 2: Fork the Repository

1. Go to the [MBA Copilot GitHub repository](https://github.com/malekbensliman/mba-copilot)
2. Click the **"Fork"** button in the top right
3. This creates your own copy of the project

### Step 3: Create Pinecone Index (2 minutes)

In the Pinecone console:

1. Click **"Create Index"**
2. Select **Custom Settings**
3. Configure the index:
   - **Name:** `mba-copilot`
   - **Model:** `text-embedding-3-large`
   - **Dimensions:** `1024`
   - **Metric:** `cosine`
   - **Cloud Provider:** AWS (or your preferred region)
   - **Region:** `us-east-1` (or closest to you)
4. Click **"Create Index"**

**Important:** The dimensions **must be 1024** to match the OpenAI `text-embedding-3-large` model used by this app.

### Step 4: Generate Auth Secret

#### Option 1: Online Generator (Works on all platforms)

Visit <a href="https://generate-secret.vercel.app/32" target="_blank">generate-secret.vercel.app/32</a> and copy the generated secret.

#### Option 2: Command Line (No third-party websites, generated locally on your machine)

macOS/Linux:

```bash
openssl rand -base64 32
```

Windows PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Windows (if Git is installed):

```bash
openssl rand -base64 32
```

Copy the output - you'll need it in the next step.

### Step 5: Choose a Password

Pick a memorable password for accessing your copilot. You'll share this with anyone you want to give access (classmates, study group members, etc.).

**Example:** `mba-copilot-2024` or `columbia-rag-spring`

### Step 6: Deploy to Vercel

1. Go to <a href="https://vercel.com" target="_blank">vercel.com</a> and sign in
2. Click **"Add New"** → **"Project"**
3. Import your **forked** GitHub repository
4. Configure the project (click "Build and Output Settings"):

   | Setting | Value |
   |---------|-------|
   | **Framework Preset** | `Next.js` |
   | **Root Directory** | `.` (leave default) |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `.next` |
   | **Install Command** | `npm install` |

5. **Add Environment Variables** (click "Environment Variables" section and "Add More"):

   | Variable | Value | Where to Get It |
   |----------|-------|-----------------|
   | `AUTH_SECRET` | Output from `openssl rand -base64 32` | Step 4 - random secret |
   | `AUTH_PASSWORD` | `your-password-here` | Step 5 - your chosen password |
   | `OPENAI_API_KEY` | `sk-...` or instructor-provided key | From Step 1 |
   | `OPENAI_BASE_URL` | `https://api.openai.com/v1` OR `https://cbsai.business.columbia.edu/api/v1` | From Step 1 - depends on option chosen |
   | `PINECONE_API_KEY` | `pc-...` | From Step 1 - your Pinecone API key |
   | `PINECONE_INDEX` | `mba-copilot` | Must match the index name from Step 3 |

   **Important:** Make sure to add these for **all environments** (Production, Preview, Development)

6. Click **"Deploy"**

#### Wait for Deployment (2-3 minutes)

Vercel will:

- Install dependencies
- Build your Next.js app
- Deploy Python serverless functions
- Provide you with a live URL

**Done!** Your app will be live at `https://your-project.vercel.app`

### Step 6.5: Enable Vercel Blob Storage (For Large Files)

**Important:** This step is **required** if you plan to upload files larger than 4MB (like large PDFs or PowerPoint presentations).

Vercel Blob storage is used as temporary storage for large files during upload. The files are automatically deleted after processing to minimize costs.

1. Go to your Vercel project dashboard
2. Click **"Storage"** tab in the top navigation
3. Click **"Create Database"** → Select **"Blob"**
4. Choose a name (e.g., `mba-copilot-files`)
5. Click **"Create"**
6. Click **"Connect to Project"**
7. Select your `mba-copilot` project
8. Click **"Connect"**

Vercel will automatically add the `BLOB_READ_WRITE_TOKEN` environment variable to your project.

**Storage Costs:**

- **Free tier:** 500MB storage
- **Pricing:** $0.15/GB/month after free tier
- **Your cost:** ~$0 (files are deleted immediately after processing)

**Skip this step if:** You only need to upload small files (< 4MB). The app will still work, but large file uploads will fail.

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
- <a href="https://github.com/pyenv/pyenv#installation" target="_blank">pyenv</a> installed
- <a href="https://nodejs.org/" target="_blank">Node.js 18+</a> installed
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
# This installs Python (via pyenv), creates venv, installs Python + Node deps
make setup
```

This will:

- Install Python 3.11.9 via pyenv (if not present)
- Create a virtualenv named `mba-copilot-3.11.9`
- Install Poetry and all Python dependencies
- Install Node.js dependencies

### Step 4: Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env.local

# Edit with your editor
code .env.local  # VS Code
# or
nano .env.local  # Terminal
```

Add your keys:

```
OPENAI_API_KEY=sk-your-actual-key
PINECONE_API_KEY=your-actual-pinecone-key
```

### Step 5: Test Locally

```bash
# Start both frontend and backend
make dev-all
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

- <a href="https://github.com/pyenv/pyenv" target="_blank">pyenv</a> - Python version management
- <a href="https://nodejs.org/" target="_blank">Node.js 18+</a>
- Make (comes with macOS/Linux)

### Quick Start

```bash
# One-time setup (installs Python 3.11, creates venv, installs all deps)
make setup

# Start both servers
make dev-all
```

Or run them separately:

```bash
# Terminal 1: Backend
make dev-api

# Terminal 2: Frontend  
make dev
```

### Available Make Commands

```bash
make help        # Show all commands
make setup       # Install everything
make dev-all     # Start both servers
make dev         # Frontend only
make dev-api     # Backend only
make format      # Format Python code
make lint        # Lint all code
make clean       # Remove build artifacts
make nuke        # Full reset (removes venv + node_modules)
```

### How Local Development Works

```
┌─────────────────────────────────────────┐
│         http://localhost:3000           │
│              (Next.js)                  │
│                                         │
│  Your browser talks to Next.js          │
│  Next.js proxies /api/* requests        │
│                                         │
└─────────────────────────────────────────┘
                    │
                    │ /api/* requests
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

The `next.config.js` file proxies `/api/*` requests to the Python backend during development.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Random secret for NextAuth (generate with `openssl rand -base64 32`) |
| `AUTH_PASSWORD` | Yes | Password for accessing the app |
| `OPENAI_API_KEY` | Yes | Your OpenAI API key (from OpenAI or instructor) |
| `OPENAI_BASE_URL` | Yes | OpenAI endpoint: `https://api.openai.com/v1` or `https://cbsai.business.columbia.edu/api/v1` |
| `PINECONE_API_KEY` | Yes | Your Pinecone API key |
| `PINECONE_INDEX` | No | Index name (default: `mba-copilot`) |

### Useful Commands

```bash
# Start frontend only
npm run dev

# Start backend only
npm run dev:api

# Start both (requires concurrently)
npm run dev:all

# Build for production
npm run build

# Lint code
npm run lint

# Create Python venv
npm run setup
```

---

## Project Structure

```
mba-copilot/
├── api/
│   └── index.py              # Python backend (FastAPI)
├── app/
│   ├── layout.tsx            # Next.js layout
│   ├── page.tsx              # Main UI component
│   ├── globals.css           # Tailwind + custom styles
│   └── types.ts              # TypeScript types
├── Makefile                  # Development commands
├── pyproject.toml            # Python dependencies (Poetry)
├── package.json              # Node dependencies
├── next.config.js            # Next.js config (API proxy)
├── tailwind.config.ts        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
├── vercel.json               # Vercel deployment config
├── .env.example              # Environment template
└── README.md
```

---

## Customization

### Change the AI Model

In `api/index.py`, find the `Config` class:

```python
CHAT_MODEL = "gpt-4o-mini"    # Default: good balance
# CHAT_MODEL = "gpt-4o"       # More capable, higher cost
# CHAT_MODEL = "gpt-3.5-turbo"  # Fastest, lowest cost
```

### Customize the System Prompt

Edit `SYSTEM_PROMPT` in `api/index.py`:

```python
SYSTEM_PROMPT = """You are an intelligent assistant for MBA students...
```

### Adjust RAG Settings

```python
CHUNK_SIZE = 1000      # Characters per chunk
CHUNK_OVERLAP = 200    # Overlap between chunks  
TOP_K = 5              # Chunks to retrieve
MIN_SCORE = 0.7        # Minimum similarity (0-1)
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

**"pyenv: command not found"**

```bash
# macOS
brew install pyenv pyenv-virtualenv

# Add to ~/.zshrc or ~/.bashrc:
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
```

**"Cannot connect to backend"**

- Make sure you ran `make dev-all` or `make dev-api`
- Check that port 8000 is not in use: `lsof -i :8000`
- Verify `.env.local` exists with valid API keys

**"Module not found" in Python**

```bash
make nuke
make setup
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
- **For large files (> 4MB):** Make sure you've set up Vercel Blob storage (see Step 6.5)
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

| Service | Free Tier | Typical Usage |
|---------|-----------|---------------|
| **Pinecone** | 2GB storage, 1M reads/month | $0 |
| **OpenAI** | Pay-as-you-go | $1-5/semester |
| **Vercel** | Hobby plan free | $0 |
| **Vercel Blob** | 500MB storage | $0* |

**Total estimated cost:** $1-5/semester (OpenAI usage only)

**\*Vercel Blob Note:** Files are automatically deleted after processing, so you'll stay well within the free 500MB tier. Only the text embeddings are stored permanently in Pinecone.

**No external auth services needed!** Authentication uses simple password check built into the app.

---

## License

MIT - Use and modify freely for your own learning!

---

*Built for Columbia Business School's "Generative AI for Business" course.*
