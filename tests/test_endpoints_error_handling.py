"""Error-handling tests for the FastAPI endpoints.

These verify that when an internal operation fails, the handler returns a
generic 500 message and never leaks exception text or a traceback to the client.
"""

from __future__ import annotations

import asyncio
from io import BytesIO
from unittest import mock

import pytest
from fastapi import HTTPException, UploadFile

from serverless.backend import index as backend


def test_chat_error_returns_clean_detail() -> None:
    """A failure during chat yields a generic 500 with no internal details."""
    request = backend.ChatRequest(message="hello")

    with mock.patch.object(
        backend, "generate_embedding", side_effect=RuntimeError("secret-internal-error")
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(backend.chat(request))

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Failed to generate a response."
    assert "secret-internal-error" not in str(exc_info.value.detail)
    assert "Traceback" not in str(exc_info.value.detail)


def test_extract_error_returns_clean_detail() -> None:
    """A failure during extract yields a generic 500 without a traceback."""
    upload_file = UploadFile(file=BytesIO(b"some content"), filename="notes.txt")

    with mock.patch.object(
        backend, "_extract_and_dedupe", side_effect=RuntimeError("secret-internal-error")
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(backend.extract(upload_file, None))

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Failed to extract the document."
    assert "secret-internal-error" not in str(exc_info.value.detail)
    assert "Traceback" not in str(exc_info.value.detail)
