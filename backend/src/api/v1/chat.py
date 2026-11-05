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
    query: str
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
    rag_service: RAGService | None = None

    async def complete_for_routing(prompt: str) -> str:
        nonlocal rag_service
        if rag_service is None:
            rag_service = RAGService(db_session=db)
        if not rag_service.is_configured:
            return QueryType.DOCUMENT_SEARCH.value
        return await rag_service._complete(prompt)

    try:
        intent = await QueryRouter.route_query(
            query,
            history=history,
            llm_complete=complete_for_routing,
        )
    except OpenRouterError:
        logger.exception("Intent classification failed; defaulting to document search")
        intent = QueryType.DOCUMENT_SEARCH

    if intent is QueryType.DOCUMENT_REGISTRY:
        registry_data = await DocumentRegistryService.list_documents(
            db, x_organization_id
        )
        return {
            "type": "registry_list",
            "answer": DocumentRegistryService.render_markdown_table(registry_data),
            "sources": [],
        }

    if intent in (QueryType.DOCUMENT_SEARCH, QueryType.FOLLOW_UP):
        if rag_service is None:
            rag_service = RAGService(db_session=db)
        answer = await rag_service.answer_query(
            query=query,
            org_id=x_organization_id,
            history=history if intent is QueryType.FOLLOW_UP else None,
        )
        return {
            "type": "document_answer",
            "answer": answer,
            "sources": [],
        }

    if rag_service is None:
        rag_service = RAGService(db_session=db)
    if rag_service.is_configured:
        try:
            general_answer = await rag_service._complete(query)
        except OpenRouterError:
            logger.exception("General knowledge fallback failed")
        else:
            return {
                "type": "general_answer",
                "answer": general_answer,
                "sources": [],
                "disclaimer": (
                    "Note: Answer generated from general knowledge, "
                    "not organization documents."
                ),
            }

    return {
        "type": "error",
        "answer": "I couldn't process your request. Please try rephrasing.",
        "sources": [],
    }
