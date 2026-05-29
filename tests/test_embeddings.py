"""Tests for batched embedding generation."""

from __future__ import annotations

import asyncio
from unittest import mock

from serverless.backend import index as backend


def test_generate_embeddings_batch_preserves_order(monkeypatch):
    """Embeddings are returned in the same order as the input texts."""
    monkeypatch.setattr(backend.config, "OPENAI_API_KEY", "sk-test")

    async def fake_create(*, model, input, dimensions):
        """Return a deterministic embedding derived from the input length."""
        return mock.MagicMock(data=[mock.MagicMock(embedding=[float(len(input))])])

    fake_client = mock.MagicMock()
    fake_client.embeddings.create = fake_create

    with mock.patch("openai.AsyncOpenAI", return_value=fake_client):
        result = asyncio.run(backend.generate_embeddings_batch(["a", "bb", "ccc"]))

    assert result == [[1.0], [2.0], [3.0]]
