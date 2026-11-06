import logging
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import PermissionChecker
from src.core.database import get_db
from src.core.limiter import limiter
from src.core.security import is_authenticated
from src.models.auth import User
from src.services.document_registry import DocumentRegistryService
from src.services.query_router import QueryRouter, QueryType
from src.services.rag_service import OpenRouterError, RAGService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat & AI Assistant"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


@router.post("/")
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request,
    payload: ChatRequest,
    x_organization_id: uuid.UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
    _: bool = Depends(PermissionChecker("document:read")),
) -> dict[str, Any]:
    query = payload.query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string cannot be empty.",
        )

    history = [message.model_dump() for message in payload.history]

    # Registry and follow-up detection are deterministic, so they never need an
    # extra LLM round-trip. Everything else goes through the retrieval gate in
    # RAGService.answer_chat, which automatically falls back to labelled general
    # knowledge when no document passage is relevant.
    try:
        intent = await QueryRouter.route_query(query, history=history)
    except OpenRouterError:
        logger.exception("Intent classification failed; defaulting to document search")
        intent = QueryType.DOCUMENT_SEARCH

    if intent is QueryType.DOCUMENT_REGISTRY:
        registry_data = await DocumentRegistryService.list_documents(
            db,
            x_organization_id,
            status_filter=QueryRouter.registry_status(query),
            archived=QueryRouter.is_archived_request(query),
        )
        return {
            "type": "registry_list",
            "answer": DocumentRegistryService.render_markdown_table(registry_data),
            "sources": [],
        }

    rag_service = RAGService(db_session=db)
    result = await rag_service.answer_chat(
        query=query,
        org_id=x_organization_id,
        history=history if intent is QueryType.FOLLOW_UP else None,
        search_documents=intent is not QueryType.GENERAL_KNOWLEDGE,
    )

    response_type = {
        "documents": "document_answer",
        "general": "general_answer",
    }.get(result.mode, "error")
    body: dict[str, Any] = {
        "type": response_type,
        "answer": result.answer,
        "sources": result.sources,
    }
    if result.disclaimer:
        body["disclaimer"] = result.disclaimer
    return body
