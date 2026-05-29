"""Unit tests for Pinecone operations.

These tests mock the Pinecone index entirely so they never reach the real
Pinecone or OpenAI services (no API keys are required to run them).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest import mock

from serverless.backend import index as backend

if TYPE_CHECKING:
    from collections.abc import Iterator


class FakeIndex:
    """Minimal stand-in for a Pinecone ``Index`` used by ``delete_document``.

    ``list`` mimics the real client, which returns a generator yielding one
    list (page) of vector IDs at a time. ``delete`` records every call so tests
    can assert on the IDs that were requested for deletion.
    """

    def __init__(self, pages: list[list[str]]) -> None:
        """Store the pages of IDs that ``list`` will yield."""
        self._pages = pages
        self.list_calls: list[dict[str, Any]] = []
        self.delete_calls: list[dict[str, Any]] = []

    def list(self, **kwargs: Any) -> Iterator[list[str]]:
        """Yield each configured page of IDs, recording the call kwargs."""
        self.list_calls.append(kwargs)
        yield from self._pages

    def delete(self, **kwargs: Any) -> dict[str, Any]:
        """Record a delete call and return an empty response like the client."""
        self.delete_calls.append(kwargs)
        return {}


def test_delete_document_lists_with_correct_prefix() -> None:
    """``delete_document`` lists IDs using the ``f"{document_id}_"`` prefix."""
    document_id = "doc_123_abcdef"
    fake = FakeIndex(pages=[[f"{document_id}_chunk_0", f"{document_id}_chunk_1"]])

    with mock.patch.object(backend, "get_pinecone_index", return_value=fake):
        backend.delete_document(document_id)

    assert len(fake.list_calls) == 1
    assert fake.list_calls[0].get("prefix") == f"{document_id}_"


def test_delete_document_deletes_collected_ids() -> None:
    """``delete_document`` deletes exactly the IDs returned by ``list``."""
    document_id = "doc_123_abcdef"
    expected_ids = [
        f"{document_id}_chunk_0",
        f"{document_id}_chunk_1",
        f"{document_id}_chunk_2",
    ]
    fake = FakeIndex(pages=[expected_ids])

    with mock.patch.object(backend, "get_pinecone_index", return_value=fake):
        backend.delete_document(document_id)

    assert len(fake.delete_calls) == 1
    assert fake.delete_calls[0].get("ids") == expected_ids


def test_delete_document_collects_ids_across_pages() -> None:
    """IDs spread across multiple pages are all collected before deletion."""
    document_id = "doc_xyz_000000"
    page_one = [f"{document_id}_chunk_0", f"{document_id}_chunk_1"]
    page_two = [f"{document_id}_chunk_2"]
    fake = FakeIndex(pages=[page_one, page_two])

    with mock.patch.object(backend, "get_pinecone_index", return_value=fake):
        backend.delete_document(document_id)

    assert len(fake.delete_calls) == 1
    assert fake.delete_calls[0].get("ids") == page_one + page_two


def test_delete_document_no_ids_skips_delete() -> None:
    """When no IDs match the prefix, ``delete`` is never called."""
    fake = FakeIndex(pages=[])

    with mock.patch.object(backend, "get_pinecone_index", return_value=fake):
        backend.delete_document("doc_missing_999999")

    assert fake.delete_calls == []


def test_delete_document_batches_large_id_sets() -> None:
    """More than 1000 IDs are deleted in batches of at most 1000."""
    document_id = "doc_big_111111"
    all_ids = [f"{document_id}_chunk_{i}" for i in range(2500)]
    fake = FakeIndex(pages=[all_ids])

    with mock.patch.object(backend, "get_pinecone_index", return_value=fake):
        backend.delete_document(document_id)

    # 2500 IDs -> batches of 1000, 1000, 500.
    assert len(fake.delete_calls) == 3
    batched_ids = [call["ids"] for call in fake.delete_calls]
    assert [len(b) for b in batched_ids] == [1000, 1000, 500]
    # The concatenation of all batches must equal the full set, in order.
    flattened = [vid for batch in batched_ids for vid in batch]
    assert flattened == all_ids
