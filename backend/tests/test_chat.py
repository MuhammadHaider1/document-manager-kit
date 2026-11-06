from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from src.services.query_router import QueryRouter, QueryType
from src.services.rag_service import AnswerResult, OpenRouterError, RAGService


@pytest.mark.asyncio
async def test_chat_requires_authentication(client: AsyncClient):
    response = await client.post("/api/v1/chat/", json={"query": "List documents"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_rejects_empty_query(auth_client: AsyncClient):
    response = await auth_client.post("/api/v1/chat/", json={"query": "  "})

    assert response.status_code == 400
    assert response.json()["detail"] == "Query string cannot be empty."


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query",
    [
        "List all documents",
        "All Documents",
        "documents",
        "tell me availabe documents in my organization",
        "list of documents",
        "check my documents",
    ],
)
async def test_chat_registry_intent_returns_markdown_table(
    auth_client: AsyncClient,
    query: str,
):
    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": query},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["type"] == "registry_list"
    assert "Architecture Decision Record" in body["answer"]
    assert body["sources"] == []


@pytest.mark.asyncio
async def test_chat_document_search_uses_rag(
    auth_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        QueryRouter,
        "route_query",
        AsyncMock(return_value=QueryType.DOCUMENT_SEARCH),
    )
    monkeypatch.setattr(RAGService, "__init__", lambda self, db_session: None)
    answer_chat = AsyncMock(
        return_value=AnswerResult(
            answer="Document-backed answer\n\n**Sources**\n- Contract.pdf",
            mode="documents",
            sources=["Contract.pdf"],
        )
    )
    monkeypatch.setattr(RAGService, "answer_chat", answer_chat)

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "What does the document say?"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "type": "document_answer",
        "answer": "Document-backed answer\n\n**Sources**\n- Contract.pdf",
        "sources": ["Contract.pdf"],
    }
    answer_chat.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_followup_passes_history_to_rag(
    auth_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        QueryRouter,
        "route_query",
        AsyncMock(return_value=QueryType.FOLLOW_UP),
    )
    monkeypatch.setattr(RAGService, "__init__", lambda self, db_session: None)
    answer_chat = AsyncMock(
        return_value=AnswerResult(answer="Thirty days.", mode="documents")
    )
    monkeypatch.setattr(RAGService, "answer_chat", answer_chat)
    history = [
        {"role": "user", "content": "What does the contract say about notice?"},
        {"role": "assistant", "content": "It mentions a notice period."},
    ]

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "How long is it?", "history": history},
    )

    assert response.status_code == 200
    answer_chat.assert_awaited_once()
    assert answer_chat.await_args.kwargs["query"] == "How long is it?"
    assert answer_chat.await_args.kwargs["history"] == history


@pytest.mark.asyncio
async def test_chat_falls_back_to_document_search_if_classification_fails(
    auth_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        QueryRouter,
        "route_query",
        AsyncMock(side_effect=OpenRouterError("Classifier unavailable")),
    )
    monkeypatch.setattr(RAGService, "__init__", lambda self, db_session: None)
    answer_chat = AsyncMock(
        return_value=AnswerResult(answer="Document-backed answer", mode="documents")
    )
    monkeypatch.setattr(RAGService, "answer_chat", answer_chat)

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "Could you explain the policy?"},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "document_answer"
    answer_chat.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_general_answer_is_labelled(
    auth_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        QueryRouter,
        "route_query",
        AsyncMock(return_value=QueryType.GENERAL_KNOWLEDGE),
    )
    monkeypatch.setattr(RAGService, "__init__", lambda self, db_session: None)
    answer_chat = AsyncMock(
        return_value=AnswerResult(
            answer="**General knowledge** — not from your documents.\n\nGeneral answer",
            mode="general",
        )
    )
    monkeypatch.setattr(RAGService, "answer_chat", answer_chat)

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "What is a database index?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "general_answer"
    assert body["answer"].startswith("**General knowledge**")
    assert "disclaimer" not in body
    answer_chat.assert_awaited_once()
    assert answer_chat.await_args.kwargs["search_documents"] is False


@pytest.mark.asyncio
async def test_chat_error_result_returns_error_type(
    auth_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        QueryRouter,
        "route_query",
        AsyncMock(return_value=QueryType.DOCUMENT_SEARCH),
    )
    monkeypatch.setattr(RAGService, "__init__", lambda self, db_session: None)
    monkeypatch.setattr(
        RAGService,
        "answer_chat",
        AsyncMock(return_value=AnswerResult(answer="Rate limited.", mode="error")),
    )

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "What is the notice period?"},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "error"
    assert response.json()["answer"] == "Rate limited."


@pytest.mark.asyncio
async def test_chat_rejects_oversized_history(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/v1/chat/",
        json={
            "query": "What about that?",
            "history": [
                {"role": "user", "content": f"turn {index}"} for index in range(13)
            ],
        },
    )

    assert response.status_code == 422
