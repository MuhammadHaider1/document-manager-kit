from types import SimpleNamespace

import pytest
from src.services.query_router import QueryRouter, QueryType


class FakeLLMClient:
    def __init__(self, content: str | None = None) -> None:
        self.content = content
        self.calls: list[dict] = []
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=self.create_completion)
        )

    async def create_completion(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=self.content),
                )
            ]
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query",
    [
        "Show all documents",
        "How many files are there?",
        "Which files failed?",
        "Check files",
        "Documents",
        "All Documents",
        "all docs",
        "my documents",
        "recent files",
        "archived documents",
        "document register",
        "show failed documents",
        "documents still processing",
    ],
)
async def test_registry_regex_fast_path_does_not_call_llm(query):
    client = FakeLLMClient("GENERAL_KNOWLEDGE")

    result = await QueryRouter.route_query(query, llm_client=client)

    assert result is QueryType.DOCUMENT_REGISTRY
    assert client.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query",
    [
        "Show documents that mention termination",
        "What does the document say about notice?",
        "Summarise the Acme agreement",
    ],
)
async def test_content_questions_are_not_registry_requests(query):
    client = FakeLLMClient("DOCUMENT_SEARCH")

    result = await QueryRouter.route_query(query, llm_client=client)

    assert result is QueryType.DOCUMENT_SEARCH
    assert len(client.calls) == 1


def test_registry_status_and_archive_filters_are_detected():
    assert QueryRouter.registry_status("Which files failed?") == "failed"
    assert QueryRouter.registry_status("Documents still processing") == "processing"
    assert QueryRouter.registry_status("List completed documents") == "completed"
    assert QueryRouter.registry_status("List documents") is None
    assert QueryRouter.is_archived_request("Archived documents") is True
    assert QueryRouter.is_archived_request("List documents") is False


@pytest.mark.asyncio
async def test_follow_up_is_detected_before_registry_or_llm():
    client = FakeLLMClient("DOCUMENT_REGISTRY")

    result = await QueryRouter.route_query(
        "What about that?",
        history=[{"role": "user", "content": "Earlier question"}],
        llm_client=client,
    )

    assert result is QueryType.FOLLOW_UP
    assert client.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query",
    [
        "Does it apply to both parties?",
        "How long is it?",
        "What about the second one?",
        "And when does it expire?",
    ],
)
async def test_natural_follow_ups_use_conversation_history(query):
    client = FakeLLMClient("GENERAL_KNOWLEDGE")

    result = await QueryRouter.route_query(
        query,
        history=[{"role": "assistant", "content": "Prior answer"}],
        llm_client=client,
    )

    assert result is QueryType.FOLLOW_UP
    assert client.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("model_result", "expected"),
    [
        ("DOCUMENT_REGISTRY", QueryType.DOCUMENT_REGISTRY),
        ("DOCUMENT_SEARCH", QueryType.DOCUMENT_SEARCH),
        ("GENERAL_KNOWLEDGE", QueryType.GENERAL_KNOWLEDGE),
    ],
)
async def test_semantic_fallback_classifies_with_llm(model_result, expected):
    client = FakeLLMClient(model_result)

    result = await QueryRouter.route_query(
        "Could you tell me what our contract says about notice?",
        llm_client=client,
    )

    assert result is expected
    assert client.calls[0]["model"] == QueryRouter.CLASSIFICATION_MODEL
    assert client.calls[0]["temperature"] == 0.0
    assert client.calls[0]["max_tokens"] == 10


@pytest.mark.asyncio
async def test_semantic_fallback_classifies_registry_synonyms():
    client = FakeLLMClient("DOCUMENT_REGISTRY")

    result = await QueryRouter.route_query(
        "Could you show the current processing state of my uploads?",
        llm_client=client,
    )

    assert result is QueryType.DOCUMENT_REGISTRY
    assert len(client.calls) == 1


@pytest.mark.asyncio
async def test_invalid_llm_category_falls_back_to_document_search(caplog):
    client = FakeLLMClient("I'm not sure")

    result = await QueryRouter.route_query("A question", llm_client=client)

    assert result is QueryType.DOCUMENT_SEARCH
    assert "invalid query category" in caplog.text


@pytest.mark.asyncio
async def test_no_client_defaults_to_document_search():
    result = await QueryRouter.route_query("A question with no matching intent")

    assert result is QueryType.DOCUMENT_SEARCH


@pytest.mark.asyncio
async def test_completion_callback_classifies_when_no_client_is_supplied():
    prompts: list[str] = []

    async def complete(prompt: str) -> str:
        prompts.append(prompt)
        return "GENERAL_KNOWLEDGE"

    result = await QueryRouter.route_query(
        "What is a database index?",
        llm_complete=complete,
    )

    assert result is QueryType.GENERAL_KNOWLEDGE
    assert "Classify the user's request" in prompts[0]
    assert "What is a database index?" in prompts[0]
