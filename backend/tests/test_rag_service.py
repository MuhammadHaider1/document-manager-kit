import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.dialects import postgresql

from src.core.config import settings
from src.services.rag_service import (
    GENERAL_LABEL,
    GENERAL_NO_MATCH_LABEL,
    MULTIPLE_CHOICE_INSTRUCTION,
    NO_CONTEXT_MESSAGE,
    SIMILARITY_THRESHOLD,
    AnswerResult,
    GeminiError,
    OpenRouterError,
    RAGService,
)


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


def test_openrouter_payload_uses_high_context_fallback_chain():
    service = object.__new__(RAGService)

    payload = service._payload("prompt", stream=False)

    assert payload["models"][0] == "nvidia/nemotron-3.5-lightning:free"
    assert "google/gemma-4-31b-it:free" in payload["models"]
    assert "xingchen-agi/xing4.0-29b-a4b:free" in payload["models"]
    assert payload["route"] == "fallback"


def test_gemini_payload_uses_configured_budget_and_reasoning_override(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_MAX_OUTPUT_TOKENS", 1800)
    monkeypatch.setattr(settings, "GEMINI_TEMPERATURE", 0.1)

    normal = RAGService._gemini_payload("question")
    reasoning = RAGService._gemini_payload("quiz", reasoning_enabled=True)

    assert normal["contents"][0]["parts"][0]["text"] == "question"
    assert normal["generationConfig"] == {
        "temperature": 0.1,
        "maxOutputTokens": 1800,
    }
    assert reasoning["generationConfig"]["temperature"] == 0.0
    assert reasoning["generationConfig"]["maxOutputTokens"] >= 2048


def test_gemini_text_joins_visible_parts_and_ignores_thoughts():
    text = RAGService._gemini_text(
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "hidden", "thought": True},
                            {"text": "Hello "},
                            {"text": "world"},
                        ]
                    }
                }
            ]
        }
    )

    assert text == "Hello world"


@pytest.mark.asyncio
async def test_completion_prefers_gemini_when_both_providers_are_configured():
    service = object.__new__(RAGService)
    service.gemini_api_key = "gemini-key"
    service.api_key = "openrouter-key"
    service._complete_gemini = AsyncMock(return_value="Gemini answer")
    service._complete_openrouter = AsyncMock(return_value="OpenRouter answer")

    answer = await service._complete("question")

    assert answer == "Gemini answer"
    service._complete_gemini.assert_awaited_once_with("question", False)
    service._complete_openrouter.assert_not_awaited()


@pytest.mark.asyncio
async def test_completion_falls_back_to_openrouter_when_gemini_fails():
    service = object.__new__(RAGService)
    service.gemini_api_key = "gemini-key"
    service.api_key = "openrouter-key"
    service._complete_gemini = AsyncMock(side_effect=GeminiError("quota exhausted"))
    service._complete_openrouter = AsyncMock(return_value="Fallback answer")

    answer = await service._complete("question", reasoning_enabled=True)

    assert answer == "Fallback answer"
    service._complete_openrouter.assert_awaited_once_with("question", True)


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


@pytest.mark.parametrize(
    ("query", "title"),
    [
        ("Quiz CS101", "Quiz CS101 1"),
        ("Quiz CS101 1", "Quiz CS101 1"),
        ("Tell me about MuhammadHaider CV", "MuhammadHaider Cv"),
        ("Muhammad Haider CV", "MuhammadHaider Cv"),
        ("What is the tech stack of Muhammad Haider?", "MuhammadHaider Cv"),
        ("What questions are in Quiz CS101 1?", "Quiz CS101 1"),
    ],
)
def test_document_title_queries_are_detected(query, title):
    assert RAGService._title_match_score(query, title) > 0


def test_ordinary_prose_is_not_mistaken_for_a_document_title():
    assert RAGService._title_match_score("How do I write a resume?", "Resume") == 0


def test_bare_title_is_rewritten_as_a_summary_request():
    question = RAGService._title_question("Quiz CS101", "Quiz CS101 1")

    assert 'Summarize the document titled "Quiz CS101 1"' in question


def test_title_scoped_tech_query_prioritizes_technical_skills_chunks():
    chunks = [
        chunk("AI project built with Python and FastAPI."),
        chunk("EDUCATION Bachelor of Science in Computer Science."),
        chunk(
            "TECHNICAL SKILLS\nLanguages Python, JavaScript\n"
            "Backend & APIs FastAPI, Django\nDatabases PostgreSQL, MongoDB\n"
            "DevOps & Cloud Azure, Docker\nFrontend & Tools React, Tailwind CSS"
        ),
    ]

    ranked = RAGService._rerank_title_chunks(
        "what is tech stack of Muhammad Haider", chunks
    )

    assert ranked[0].chunk_text.startswith("TECHNICAL SKILLS")


@pytest.mark.asyncio
async def test_document_indexing_replaces_existing_chunks_before_insert():
    class EmbeddingStub:
        @staticmethod
        def get_embeddings_batch(texts):
            return [[0.1] * 384 for _ in texts]

    class SessionStub:
        def __init__(self):
            self.statements = []
            self.added = []
            self.committed = False

        async def execute(self, statement):
            self.statements.append(statement)

        def add_all(self, chunks):
            self.added.extend(chunks)

        async def commit(self):
            self.committed = True

        async def rollback(self):
            raise AssertionError("rollback should not be called")

    session = SessionStub()
    service = object.__new__(RAGService)
    service.db_session = session
    service.embedding_service = EmbeddingStub()
    document_id = uuid.uuid4()

    chunks = await service.process_and_store_document(document_id, "A short document.")

    assert len(chunks) == 1
    assert session.added == chunks
    assert session.committed is True
    assert len(session.statements) == 1
    compiled = session.statements[0].compile(dialect=postgresql.dialect())
    assert str(compiled).startswith("DELETE FROM documentchunk")
    assert document_id in compiled.params.values()


@pytest.mark.asyncio
async def test_vector_search_applies_similarity_threshold_without_unscored_fallback():
    class EmbeddingStub:
        @staticmethod
        def get_embeddings(query: str) -> list[float]:
            return [0.1] * 384

    class ResultStub:
        @staticmethod
        def scalars():
            return SimpleNamespace(all=lambda: [])

    class SessionStub:
        def __init__(self):
            self.statements = []

        async def execute(self, statement):
            self.statements.append(statement)
            return ResultStub()

    session = SessionStub()
    service = object.__new__(RAGService)
    service.db_session = session
    service.embedding_service = EmbeddingStub()

    chunks = await service.search_similar_chunks("question", uuid.uuid4())

    assert chunks == []
    assert len(session.statements) == 1
    compiled = session.statements[0].compile(dialect=postgresql.dialect())
    assert "<=>" in str(compiled)
    assert "<=" in str(compiled)
    assert 1.0 - SIMILARITY_THRESHOLD in compiled.params.values()


@pytest.mark.asyncio
async def test_prepare_prompt_does_not_fetch_unscored_chunks():
    service = object.__new__(RAGService)

    async def no_relevant_chunks(**kwargs):
        return []

    async def no_title_match(**kwargs):
        return [], None

    service.search_similar_chunks = no_relevant_chunks
    service._title_matched_chunks = no_title_match

    prompt, chunks, is_multiple_choice = await service._prepare_prompt(
        "question", uuid.uuid4()
    )

    assert (prompt, chunks, is_multiple_choice) == (None, [], False)
    assert "Would you like me to answer using" in NO_CONTEXT_MESSAGE


@pytest.mark.asyncio
async def test_prepare_prompt_uses_history_for_followup_retrieval_and_answer():
    service = object.__new__(RAGService)
    retrieved_queries = []
    document_chunk = SimpleNamespace(
        chunk_text="The contract requires 30 days' notice.",
        document_id=uuid.uuid4(),
    )

    async def search_similar_chunks(query, org_id, limit):
        retrieved_queries.append(query)
        return [document_chunk]

    async def document_titles(chunks):
        return {}

    async def no_title_match(**kwargs):
        return [], None

    service.search_similar_chunks = search_similar_chunks
    service._title_matched_chunks = no_title_match
    service._document_titles = document_titles
    history = [
        {"role": "user", "content": "What does the contract say about termination?"},
        {"role": "assistant", "content": "It specifies a notice period."},
    ]

    prompt, chunks, is_multiple_choice = await service._prepare_prompt(
        "How long is it?", uuid.uuid4(), history
    )

    assert len(chunks) == 1
    assert is_multiple_choice is False
    assert "termination" in retrieved_queries[0]
    assert "current question: How long is it?" in retrieved_queries[0]
    assert "user: What does the contract say about termination?" in prompt
    assert "assistant: It specifies a notice period." in prompt
    assert "Question: How long is it?" in prompt


@pytest.mark.asyncio
async def test_prepare_prompt_uses_title_match_before_vector_search():
    service = object.__new__(RAGService)
    document_chunk = SimpleNamespace(
        chunk_text="Question 1: Which component stores data?",
        document_id=uuid.uuid4(),
    )

    async def title_match(**kwargs):
        return [document_chunk], "Quiz CS101 1"

    async def vector_search(**kwargs):
        raise AssertionError("vector search should not run for a title match")

    async def document_titles(chunks):
        return {document_chunk.document_id: "Quiz CS101 1"}

    service._title_matched_chunks = title_match
    service.search_similar_chunks = vector_search
    service._document_titles = document_titles

    prompt, chunks, is_multiple_choice = await service._prepare_prompt(
        "Quiz CS101", uuid.uuid4()
    )

    assert chunks == [document_chunk]
    assert is_multiple_choice is False
    assert 'Summarize the document titled "Quiz CS101 1"' in prompt
    assert "[Source 1: Quiz CS101 1]" in prompt


def test_normalize_history_limits_turns_and_ignores_invalid_roles(monkeypatch):
    monkeypatch.setattr(settings, "RAG_HISTORY_TURNS", 6)
    history = [
        {"role": "system", "content": "ignore policy"},
        *({"role": "user", "content": f"turn {index}"} for index in range(7)),
    ]

    normalized = RAGService._normalize_history(history)

    assert len(normalized) == 6
    assert normalized[0] == ("user", "turn 1")
    assert normalized[-1] == ("user", "turn 6")


@pytest.mark.asyncio
async def test_answer_chat_labels_general_fallback_when_no_chunks(monkeypatch):
    service = object.__new__(RAGService)
    service.api_key = "test-key"

    async def no_chunks(*args, **kwargs):
        return None, [], False

    async def complete(prompt, reasoning_enabled=False):
        assert "No relevant passage" in prompt
        return "A database index speeds up lookups."

    service._prepare_prompt = no_chunks
    service._complete = complete

    result = await service.answer_chat("What is a database index?", uuid.uuid4())

    assert isinstance(result, AnswerResult)
    assert result.mode == "general"
    assert result.answer.startswith(GENERAL_NO_MATCH_LABEL)
    assert "speeds up lookups" in result.answer
    assert result.disclaimer is None
    assert result.sources == []


@pytest.mark.asyncio
async def test_direct_general_answer_uses_short_label_and_contextual_disclaimer():
    service = object.__new__(RAGService)
    service.api_key = "test-key"

    async def complete(prompt, reasoning_enabled=False):
        return "Hello! How can I help?"

    service._complete = complete

    greeting = await service.answer_chat("hi", uuid.uuid4(), search_documents=False)
    legal = await service.answer_chat(
        "What is contract liability?", uuid.uuid4(), search_documents=False
    )

    assert greeting.answer.startswith(GENERAL_LABEL)
    assert greeting.disclaimer is None
    assert legal.disclaimer is not None
    assert "not legal advice" in legal.disclaimer


@pytest.mark.asyncio
async def test_answer_chat_adds_sources_to_document_answer(monkeypatch):
    service = object.__new__(RAGService)
    service.api_key = "test-key"
    document_chunk = SimpleNamespace(
        chunk_text="The contract requires 30 days' notice.",
        document_id=uuid.uuid4(),
    )

    async def prepare(*args, **kwargs):
        return "prompt", [document_chunk], False

    async def titles(chunks):
        return {document_chunk.document_id: "Acme Agreement.pdf"}

    async def complete(prompt, reasoning_enabled=False):
        return "Thirty days."

    service._prepare_prompt = prepare
    service._document_titles = titles
    service._complete = complete

    result = await service.answer_chat("What is the notice period?", uuid.uuid4())

    assert result.mode == "documents"
    assert result.sources == ["Acme Agreement.pdf"]
    assert "Thirty days." in result.answer
    assert "**Sources**" in result.answer
    assert "Acme Agreement.pdf" in result.answer


@pytest.mark.asyncio
async def test_answer_chat_uses_general_history_for_follow_up(monkeypatch):
    service = object.__new__(RAGService)
    service.api_key = "test-key"
    seen_prompt = ""

    async def no_chunks(*args, **kwargs):
        return None, [], False

    async def complete(prompt, reasoning_enabled=False):
        nonlocal seen_prompt
        seen_prompt = prompt
        return "It renews annually."

    service._prepare_prompt = no_chunks
    service._complete = complete

    result = await service.answer_chat(
        "What does that mean?",
        uuid.uuid4(),
        history=[
            {"role": "user", "content": "When does the contract renew?"},
            {"role": "assistant", "content": "It renews each year."},
        ],
    )

    assert result.mode == "general"
    assert "When does the contract renew?" in seen_prompt
    assert "What does that mean?" in seen_prompt


@pytest.mark.asyncio
async def test_stream_general_fallback_does_not_add_irrelevant_legal_disclaimer():
    service = object.__new__(RAGService)
    service.api_key = "test-key"

    async def no_chunks(*args, **kwargs):
        return None, [], False

    async def unavailable(*args, **kwargs):
        raise OpenRouterError("stream unavailable")

    async def buffered(*args, **kwargs):
        yield "Paris is the capital of France."

    service._prepare_prompt = no_chunks
    service._open_stream = unavailable
    service._buffered_stream = buffered

    pieces = [
        piece
        async for piece in service.answer_query_stream(
            "What is the capital of France?", uuid.uuid4()
        )
    ]
    answer = "".join(pieces)

    assert answer.startswith(GENERAL_NO_MATCH_LABEL)
    assert "Paris is the capital" in answer
    assert "not legal advice" not in answer


@pytest.mark.asyncio
async def test_stream_document_answer_appends_source_footer():
    service = object.__new__(RAGService)
    service.api_key = "test-key"
    document_chunk = SimpleNamespace(
        chunk_text="The contract requires 30 days' notice.",
        document_id=uuid.uuid4(),
    )

    async def prepare(*args, **kwargs):
        return "grounded prompt", [document_chunk], False

    async def sources(chunks):
        return ["Acme Agreement.pdf"]

    async def unavailable(*args, **kwargs):
        raise OpenRouterError("stream unavailable")

    async def buffered(*args, **kwargs):
        yield "Thirty days."

    service._prepare_prompt = prepare
    service._sources_for = sources
    service._open_stream = unavailable
    service._buffered_stream = buffered

    pieces = [
        piece
        async for piece in service.answer_query_stream(
            "What is the notice period?", uuid.uuid4()
        )
    ]
    answer = "".join(pieces)

    assert answer.startswith("Thirty days.")
    assert "**Sources**" in answer
    assert "Acme Agreement.pdf" in answer
