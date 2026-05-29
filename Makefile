# ==============================================================================
# MBA Copilot - uv-based Makefile
# ==============================================================================
#
# This Makefile manages Python environments and dependencies using uv,
# and Node.js dependencies via npm.
#
# Key differences from the previous poetry-based setup:
#   - Virtualenv is project-local (.venv/) instead of ~/.pyenv/versions/...
#   - Single tool (uv) replaces pyenv + pyenv-virtualenv + poetry
#   - 10-100x faster dependency resolution
#   - Lock file is uv.lock instead of poetry.lock
#
# Quick start:
#   make setup    # Install Python + Node deps, create venv
#   make dev-all  # Start frontend + backend
#   make format   # Format code with ruff
#   make lint     # Run ruff + ty + eslint
#   make nuke     # Remove venv + node_modules and start fresh
#
# ==============================================================================

SHELL = /bin/bash

# ==============================================================================
# Colors for Output
# ==============================================================================
CYAN    := \033[0;36m
RED     := \033[0;31m
ORANGE  := \033[38;5;208m
GREEN   := \033[0;32m
WHITE   := \033[1;37m
RST     := \033[0m

# ==============================================================================
# Project Configuration
# ==============================================================================
NAME      := mba-copilot
PYMAJOR   := 3
PYREV     := 12
PYPATCH   := 2
PYVERSION := ${PYMAJOR}.${PYREV}.${PYPATCH}

# ==============================================================================
# uv Configuration
# ==============================================================================
VENV_DIR  := .venv
UV_BIN    := uv
UV_RUN    := ${UV_BIN} run

# ==============================================================================
# Python Runtime Management
# ==============================================================================

.python-version:
	@echo -e "${CYAN}*** Installing Python ${WHITE}${PYVERSION}${CYAN} via uv${RST}"
	${UV_BIN} python install ${PYVERSION}
	@echo ${PYVERSION} > .python-version

${VENV_DIR}: .python-version
	@echo -e "${CYAN}*** Creating virtualenv in ${WHITE}${VENV_DIR}${RST}"
	${UV_BIN} venv --python ${PYVERSION}

# ==============================================================================
# Project Setup
# ==============================================================================

setup: ${VENV_DIR} node_modules
	@echo -e "${CYAN}*** Installing project dependencies${RST}"
	${UV_BIN} sync
	@echo -e "${GREEN}*** Setup complete!${RST}"
	@echo -e "${CYAN}*** Activate with: ${WHITE}source .venv/bin/activate${RST}"
	@echo -e "${WHITE}Run 'make dev-all' to start development servers${RST}"

node_modules: package.json
	@echo -e "${CYAN}*** Installing Node.js dependencies${RST}"
	npm install
	touch node_modules

install: setup

# Full one-stop setup: Python env + Node deps + frontend build + requirements.txt
full-setup: setup build requirements
	@echo -e "${GREEN}*** Full setup complete!${RST}"
	@echo -e "${CYAN}*** Generated: ${WHITE}.python-version, .venv/, node_modules/, requirements.txt${RST}"
	@echo -e "${WHITE}Run 'make dev-all' to start development servers${RST}"

# ==============================================================================
# Dependency Management
# ==============================================================================

lock:
	@echo -e "${CYAN}*** Generating/updating uv.lock from pyproject.toml${RST}"
	${UV_BIN} lock

update:
	@echo -e "${ORANGE}*** Updating all dependencies to latest compatible versions${RST}"
	${UV_BIN} lock --upgrade
	${UV_BIN} sync

add:
ifndef DEP
	$(error Usage: make add DEP=package_name)
endif
	@echo -e "${CYAN}*** Adding dependency: ${WHITE}${DEP}${RST}"
	${UV_BIN} add ${DEP}

add-dev:
ifndef DEP
	$(error Usage: make add-dev DEP=package_name)
endif
	@echo -e "${CYAN}*** Adding dev dependency: ${WHITE}${DEP}${RST}"
	${UV_BIN} add --dev ${DEP}

remove:
ifndef DEP
	$(error Usage: make remove DEP=package_name)
endif
	@echo -e "${ORANGE}*** Removing dependency: ${WHITE}${DEP}${RST}"
	${UV_BIN} remove ${DEP}

lockcheck:
	@echo -e "${CYAN}*** Checking that uv.lock is up to date${RST}"
	${UV_BIN} lock --check

# ==============================================================================
# Development Servers
# ==============================================================================

dev:
	@echo -e "${CYAN}*** Starting Next.js frontend on http://localhost:3000${RST}"
	npm run dev

dev-api:
	@echo -e "${CYAN}*** Starting FastAPI backend on http://localhost:8000${RST}"
	${UV_RUN} uvicorn serverless.backend.index:app --reload --port 8000

dev-all:
	@echo -e "${CYAN}*** Starting both frontend and backend${RST}"
	@echo -e "${WHITE}Frontend: http://localhost:3000${RST}"
	@echo -e "${WHITE}Backend:  http://localhost:8000${RST}"
	@echo -e "${ORANGE}(Press Ctrl+C to stop both)${RST}"
	@trap 'kill 0' EXIT; \
		${UV_RUN} uvicorn serverless.backend.index:app --reload --port 8000 & \
		npm run dev & \
		wait

# ==============================================================================
# Build & Deploy
# ==============================================================================

build:
	@echo -e "${CYAN}*** Building Next.js for production${RST}"
	npm run build

# ==============================================================================
# Code Quality
# ==============================================================================

format:
	@echo -e "${CYAN}*** Formatting Python with ruff${RST}"
	${UV_RUN} ruff format serverless/
	@echo -e "${CYAN}*** Sorting imports${RST}"
	${UV_RUN} ruff check --select I --fix serverless/

lint:
	@echo -e "${CYAN}*** Linting Python with ruff${RST}"
	${UV_RUN} ruff check serverless/
	@echo -e "${CYAN}*** Running ty type checks${RST}"
	${UV_RUN} ty check serverless/
	@echo -e "${CYAN}*** Linting TypeScript with ESLint${RST}"
	npm run lint

lint-fix:
	@echo -e "${CYAN}*** Fixing Python lint issues${RST}"
	${UV_RUN} ruff check --fix serverless/

typecheck:
	@echo -e "${CYAN}*** Running ty type checks${RST}"
	${UV_RUN} ty check serverless/

check:
	@echo -e "${CYAN}*** Checking formatting${RST}"
	${UV_RUN} ruff format --check serverless/
	@echo -e "${CYAN}*** Checking imports${RST}"
	${UV_RUN} ruff check --select I serverless/
	@echo -e "${CYAN}*** Running linter${RST}"
	${UV_RUN} ruff check serverless/
	@echo -e "${CYAN}*** Running type checks${RST}"
	${UV_RUN} ty check serverless/

# ==============================================================================
# Testing
# ==============================================================================

test:
	@echo -e "${CYAN}*** Running tests${RST}"
	${UV_RUN} pytest

test-cov:
	@echo -e "${CYAN}*** Running tests with coverage${RST}"
	${UV_RUN} pytest --cov=serverless --cov-report=term-missing

# ==============================================================================
# Utilities
# ==============================================================================

run:
ifndef CMD
	$(error Usage: make run CMD='command to run')
endif
	${UV_RUN} ${CMD}

requirements:
	@echo -e "${CYAN}*** Exporting requirements.txt for Vercel${RST}"
	${UV_BIN} pip compile pyproject.toml -o requirements.txt

# ==============================================================================
# Cleanup
# ==============================================================================

clean:
	@echo -e "${ORANGE}*** Cleaning build artifacts${RST}"
	rm -rf .next/
	rm -rf node_modules/.cache/
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

nuke: clean
	@echo -e "${RED}*** Removing virtualenv: ${WHITE}${VENV_DIR}${RST}"
	rm -rf ${VENV_DIR}
	rm -f .python-version uv.lock
	rm -rf node_modules/
	@echo -e "${ORANGE}*** Run 'make setup' to rebuild${RST}"

# ==============================================================================
# Help
# ==============================================================================

.PHONY: setup install full-setup lock update add add-dev remove lockcheck \
        dev dev-api dev-all build \
        format lint lint-fix typecheck check \
        test test-cov \
        run requirements \
        clean nuke help

help:
	@echo -e "${WHITE}MBA Copilot - Available Commands${RST}"
	@echo ""
	@echo -e "${CYAN}Setup & Dependencies:${RST}"
	@echo "  make setup        - Install all dependencies (Python + Node)"
	@echo "  make full-setup   - Setup + build frontend + export requirements.txt"
	@echo "  make install      - Alias for setup"
	@echo "  make lock         - Generate/update uv.lock"
	@echo "  make update       - Update all dependencies"
	@echo "  make add DEP=x    - Add a runtime dependency"
	@echo "  make add-dev DEP=x - Add a dev dependency"
	@echo "  make remove DEP=x - Remove a dependency"
	@echo "  make lockcheck    - Verify uv.lock is current (CI)"
	@echo ""
	@echo -e "${CYAN}Development:${RST}"
	@echo "  make dev          - Start Next.js frontend only"
	@echo "  make dev-api      - Start FastAPI backend only"
	@echo "  make dev-all      - Start both frontend and backend"
	@echo ""
	@echo -e "${CYAN}Code Quality:${RST}"
	@echo "  make format       - Format Python code with ruff"
	@echo "  make lint         - Lint Python (ruff + ty) and TypeScript"
	@echo "  make lint-fix     - Auto-fix Python lint issues"
	@echo "  make typecheck    - Run type checks"
	@echo "  make check        - Run all checks (CI)"
	@echo ""
	@echo -e "${CYAN}Testing:${RST}"
	@echo "  make test         - Run tests"
	@echo "  make test-cov     - Run tests with coverage"
	@echo ""
	@echo -e "${CYAN}Build & Deploy:${RST}"
	@echo "  make build        - Build for production"
	@echo "  make requirements - Export requirements.txt for Vercel"
	@echo ""
	@echo -e "${CYAN}Utilities:${RST}"
	@echo "  make run CMD='...' - Run command in venv"
	@echo ""
	@echo -e "${CYAN}Cleanup:${RST}"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make nuke         - Remove everything (venv + node_modules)"

.DEFAULT_GOAL := help
