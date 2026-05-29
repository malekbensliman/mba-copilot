"""Tests for the two-phase (extract + embed-batch) ingestion flow."""

from __future__ import annotations

import asyncio
from typing import Any

from serverless.backend import index as backend


def test_extract_and_dedupe_returns_chunks_and_drops_same_name(monkeypatch) -> None:
    """Phase 1 returns the parsed chunks and deletes only the same-name doc."""
    monkeypatch.setattr(backend.config, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(backend.config, "PINECONE_API_KEY", "pc-test")
    monkeypatch.setattr(
        backend,
        "extract_structured_chunks",
        lambda _file: [{"text": "a", "chunk_index": 0}, {"text": "b", "chunk_index": 1}],
    )
    monkeypatch.setattr(
        backend,
        "list_documents",
        lambda: [
            {"id": "old_doc", "filename": "report.pdf"},
            {"id": "keep_doc", "filename": "other.pdf"},
        ],
    )
    deleted: list[str] = []
    monkeypatch.setattr(backend, "delete_document", lambda doc_id: deleted.append(doc_id))

    result = asyncio.run(backend._extract_and_dedupe(object(), "report.pdf"))

    assert result["filename"] == "report.pdf"
    assert result["total_chunks"] == 2
    assert result["document_id"].startswith("doc_")
    assert [c["chunk_index"] for c in result["chunks"]] == [0, 1]
    # Only the document sharing the filename is removed.
    assert deleted == ["old_doc"]


def test_embed_and_store_uses_chunk_index_for_ids(monkeypatch) -> None:
    """A later batch maps to globally-correct IDs, not its position in the batch."""
    captured: dict[str, Any] = {}

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        """Return one trivial embedding per input text."""
        return [[0.0] for _ in texts]

    monkeypatch.setattr(backend, "generate_embeddings_batch", fake_embed)
    monkeypatch.setattr(backend, "store_chunks", lambda records: captured.update(records=records))

    # Second batch of a 4-chunk document: chunk_index 2 and 3.
    batch = [{"text": "c2", "chunk_index": 2}, {"text": "c3", "chunk_index": 3}]
    count = asyncio.run(
        backend._embed_and_store("doc_1", "f.pdf", "2026-01-01T00:00:00Z", 4, batch)
    )

    assert count == 2
    records = captured["records"]
    assert [r["id"] for r in records] == ["doc_1_chunk_2", "doc_1_chunk_3"]
    assert [r["metadata"]["chunk_index"] for r in records] == [2, 3]
    assert all(r["metadata"]["is_first_chunk"] is False for r in records)
    assert all(r["metadata"]["total_chunks"] == 4 for r in records)


def test_embed_and_store_marks_only_first_chunk(monkeypatch) -> None:
    """``is_first_chunk`` is true only for the chunk with index 0."""
    captured: dict[str, Any] = {}

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        """Return one trivial embedding per input text."""
        return [[0.0] for _ in texts]

    monkeypatch.setattr(backend, "generate_embeddings_batch", fake_embed)
    monkeypatch.setattr(backend, "store_chunks", lambda records: captured.update(records=records))

    batch = [{"text": "c0", "chunk_index": 0}, {"text": "c1", "chunk_index": 1}]
    asyncio.run(backend._embed_and_store("doc_x", "f.pdf", "2026-01-01T00:00:00Z", 2, batch))

    records = captured["records"]
    assert records[0]["metadata"]["is_first_chunk"] is True
    assert records[1]["metadata"]["is_first_chunk"] is False
