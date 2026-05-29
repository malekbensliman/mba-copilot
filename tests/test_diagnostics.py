"""Tests for the /diagnostics endpoint configuration checks."""

from __future__ import annotations

import asyncio
from unittest import mock

from serverless.backend import index as backend


def test_diagnostics_flags_missing_keys(monkeypatch):
    """Missing API keys are reported and the overall status is not ok."""
    monkeypatch.setattr(backend.config, "OPENAI_API_KEY", None)
    monkeypatch.setattr(backend.config, "PINECONE_API_KEY", None)

    result = asyncio.run(backend.diagnostics())

    assert result["ok"] is False
    assert any(not check["ok"] for check in result["checks"])


def test_diagnostics_ok_when_index_dimension_matches(monkeypatch):
    """Keys present and an index with the expected dimension reports ok."""
    monkeypatch.setattr(backend.config, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(backend.config, "PINECONE_API_KEY", "pc-test")
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test")
    fake_pc = mock.MagicMock()
    fake_pc.describe_index.return_value.dimension = backend.config.EMBEDDING_DIMENSIONS

    with mock.patch("pinecone.Pinecone", return_value=fake_pc):
        result = asyncio.run(backend.diagnostics())

    assert result["ok"] is True


def test_diagnostics_flags_missing_blob_storage(monkeypatch):
    """A missing Blob token is reported and fails the overall status."""
    monkeypatch.setattr(backend.config, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(backend.config, "PINECONE_API_KEY", "pc-test")
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    fake_pc = mock.MagicMock()
    fake_pc.describe_index.return_value.dimension = backend.config.EMBEDDING_DIMENSIONS

    with mock.patch("pinecone.Pinecone", return_value=fake_pc):
        result = asyncio.run(backend.diagnostics())

    assert result["ok"] is False
    blob_check = next(c for c in result["checks"] if "blob" in c["name"].lower())
    assert blob_check["ok"] is False


def test_diagnostics_flags_wrong_dimension(monkeypatch):
    """A Pinecone index with the wrong dimension is reported clearly."""
    monkeypatch.setattr(backend.config, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(backend.config, "PINECONE_API_KEY", "pc-test")
    fake_pc = mock.MagicMock()
    fake_pc.describe_index.return_value.dimension = 1536

    with mock.patch("pinecone.Pinecone", return_value=fake_pc):
        result = asyncio.run(backend.diagnostics())

    assert result["ok"] is False
    index_check = next(c for c in result["checks"] if "index" in c["name"].lower())
    assert index_check["ok"] is False
    assert "1536" in index_check["detail"]
