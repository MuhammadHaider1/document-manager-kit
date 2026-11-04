import uuid
from types import SimpleNamespace

from src.core.config import settings
from src.services.rag_service import MULTIPLE_CHOICE_INSTRUCTION, RAGService


def chunk(text: str) -> SimpleNamespace:
    return SimpleNamespace(chunk_text=text)


def test_detects_complete_multiple_choice_item():
    text = (
        "Q.4 When did David Berlo present his SMCR model?\n"
        "A. 1959\nB. 1961\nC. 1962\nD. 1960"
    )
    assert RAGService._context_has_multiple_choice([chunk(text)]) is True


def test_ignores_options_without_a_question():
    text = "Clause list:\nA. Fees\nB. Term\nC. Notice\nD. Law"
    assert RAGService._context_has_multiple_choice([chunk(text)]) is False


def test_ignores_incomplete_options():
    text = "Q.1 Pick one?\nA. One\nB. Two\nC. Three"
    assert RAGService._context_has_multiple_choice([chunk(text)]) is False


def test_ignores_options_split_across_chunks_without_question():
    chunks = [
        chunk("A. 1959\nB. 1961"),
        chunk("C. 1962\nD. 1960"),
    ]
    assert RAGService._context_has_multiple_choice(chunks) is False


def test_payload_opts_into_reasoning_for_multiple_choice(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_REASONING_ENABLED", False)
    service = object.__new__(RAGService)

    payload = service._payload("prompt", stream=False, reasoning_enabled=True)

    assert payload["reasoning"] == {"enabled": True}
    assert payload["temperature"] == 0.0
    assert payload["max_tokens"] >= 2048


def test_payload_keeps_reasoning_off_by_default(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_REASONING_ENABLED", False)
    service = object.__new__(RAGService)

    payload = service._payload("prompt", stream=False)

    assert payload["reasoning"] == {"enabled": False}
    assert payload["temperature"] == settings.OPENROUTER_TEMPERATURE


def test_multiple_choice_instruction_targets_foundational_work():
    assert "foundational" in MULTIPLE_CHOICE_INSTRUCTION
    assert "inferred; the source does not mark an answer" in (
        MULTIPLE_CHOICE_INSTRUCTION
    )


def test_diverse_chunks_stop_one_document_dominating():
    doc_a = uuid.uuid4()
    doc_b = uuid.uuid4()
    doc_c = uuid.uuid4()
    chunks = [
        SimpleNamespace(document_id=doc_a, chunk_text="a1"),
        SimpleNamespace(document_id=doc_a, chunk_text="a2"),
        SimpleNamespace(document_id=doc_a, chunk_text="a3"),
        SimpleNamespace(document_id=doc_a, chunk_text="a4"),
        SimpleNamespace(document_id=doc_a, chunk_text="a5"),
        SimpleNamespace(document_id=doc_b, chunk_text="b1"),
        SimpleNamespace(document_id=doc_c, chunk_text="c1"),
    ]

    selected = RAGService._select_diverse_chunks(chunks, limit=5)

    assert [chunk.chunk_text for chunk in selected] == ["a1", "a2", "b1", "c1", "a3"]


def test_diverse_chunks_backfill_for_single_document():
    doc = uuid.uuid4()
    chunks = [
        SimpleNamespace(document_id=doc, chunk_text=f"chunk-{index}")
        for index in range(5)
    ]

    selected = RAGService._select_diverse_chunks(chunks, limit=5)

    assert [chunk.chunk_text for chunk in selected] == [
        "chunk-0",
        "chunk-1",
        "chunk-2",
        "chunk-3",
        "chunk-4",
    ]


def test_diverse_chunks_handles_zero_limit():
    assert RAGService._select_diverse_chunks([], limit=0) == []


def test_diverse_chunks_deduplicate_same_text():
    first_doc = uuid.uuid4()
    second_doc = uuid.uuid4()
    chunks = [
        SimpleNamespace(document_id=first_doc, chunk_text="same text"),
        SimpleNamespace(document_id=second_doc, chunk_text="same text"),
        SimpleNamespace(document_id=first_doc, chunk_text="unique text"),
    ]

    selected = RAGService._select_diverse_chunks(chunks, limit=5)

    assert [chunk.chunk_text for chunk in selected] == ["same text", "unique text"]
