from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from src.services.query_router import QueryRouter, QueryType
from src.services.rag_service import OpenRouterError, RAGService


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
async def test_chat_registry_intent_returns_markdown_table(
    auth_client: AsyncClient,
):
    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "List all documents"},
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
    answer_query = AsyncMock(return_value="Document-backed answer")
    monkeypatch.setattr(RAGService, "answer_query", answer_query)

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "What does the document say?"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "type": "document_answer",
        "answer": "Document-backed answer",
        "sources": [],
    }
    answer_query.assert_awaited_once()


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
    answer_query = AsyncMock(return_value="Thirty days.")
    monkeypatch.setattr(RAGService, "answer_query", answer_query)
    history = [
        {"role": "user", "content": "What does the contract say about notice?"},
        {"role": "assistant", "content": "It mentions a notice period."},
    ]

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "How long is it?", "history": history},
    )

    assert response.status_code == 200
    answer_query.assert_awaited_once()
    assert answer_query.await_args.kwargs["query"] == "How long is it?"
    assert answer_query.await_args.kwargs["history"] == history


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
    answer_query = AsyncMock(return_value="Document-backed answer")
    monkeypatch.setattr(RAGService, "answer_query", answer_query)

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "Could you explain the policy?"},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "document_answer"
    answer_query.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_general_intent_uses_llm_fallback(
    auth_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        QueryRouter,
        "route_query",
        AsyncMock(return_value=QueryType.GENERAL_KNOWLEDGE),
    )
    monkeypatch.setattr(RAGService, "__init__", lambda self, db_session: None)
    monkeypatch.setattr(RAGService, "is_configured", property(lambda self: True))
    complete = AsyncMock(return_value="General answer")
    monkeypatch.setattr(RAGService, "_complete", complete)

    response = await auth_client.post(
        "/api/v1/chat/",
        json={"query": "What is a database index?"},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "general_answer"
    assert response.json()["answer"] == "General answer"
    assert "not organization documents" in response.json()["disclaimer"]
    complete.assert_awaited_once_with("What is a database index?")


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
