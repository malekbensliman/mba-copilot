"""Tests for the internal-auth middleware that gates the backend.

The backend must reject any request that didn't arrive through the authenticated
Next.js proxy (which forwards an ``X-Internal-Auth`` header). The health check is
the one public exception. The middleware is exercised directly with a minimal
ASGI scope so the tests need no HTTP client and never touch Pinecone/OpenAI.
"""

from __future__ import annotations

import asyncio
import hashlib

from starlette.requests import Request
from starlette.responses import JSONResponse

from serverless.backend import index as backend


def _dispatch(path, headers):
    """Run the auth middleware for a GET request and return the response."""
    scope = {
        "type": "http",
        "method": "GET",
        "scheme": "http",
        "server": ("testserver", 80),
        "path": path,
        "query_string": b"",
        "root_path": "",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }

    async def _call_next(_request):
        """Stand-in downstream handler that signals the gate was passed."""
        return JSONResponse(content={"ok": True})

    return asyncio.run(backend.require_internal_auth(Request(scope), _call_next))


def test_health_is_public():
    """The health check passes the gate without any header."""
    assert _dispatch("/health", {}).status_code == 200


def test_missing_header_is_rejected(monkeypatch):
    """A request without the internal-auth header is rejected with 401."""
    monkeypatch.setenv("AUTH_SECRET", "test-secret")
    assert _dispatch("/documents", {}).status_code == 401


def test_wrong_header_is_rejected(monkeypatch):
    """A request with an incorrect internal-auth header is rejected with 401."""
    monkeypatch.setenv("AUTH_SECRET", "test-secret")
    assert _dispatch("/documents", {"x-internal-auth": "nope"}).status_code == 401


def test_correct_header_passes_gate(monkeypatch):
    """A correct header passes the gate and reaches the downstream handler."""
    monkeypatch.setenv("AUTH_SECRET", "test-secret")
    token = hashlib.sha256(b"test-secret").hexdigest()
    assert _dispatch("/documents", {"x-internal-auth": token}).status_code == 200
