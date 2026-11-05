import logging
import re
from collections.abc import Awaitable, Callable
from enum import Enum
from typing import ClassVar, Dict, List, Optional, Protocol, Sequence


logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    DOCUMENT_SEARCH = "DOCUMENT_SEARCH"
    DOCUMENT_REGISTRY = "DOCUMENT_REGISTRY"
    GENERAL_KNOWLEDGE = "GENERAL_KNOWLEDGE"
    FOLLOW_UP = "FOLLOW_UP"
    AMBIGUOUS = "AMBIGUOUS"


class _Message(Protocol):
    content: Optional[str]


class _Choice(Protocol):
    message: _Message


class _Completion(Protocol):
    choices: Sequence[_Choice]


class _Completions(Protocol):
    async def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> _Completion: ...


class _Chat(Protocol):
    completions: _Completions


class LLMClient(Protocol):
    """The chat-completions interface used by OpenAI-compatible clients."""

    chat: _Chat


class QueryRouter:
    REGISTRY_PATTERNS: ClassVar[List[str]] = [
        r"^(list|show|get|display|count|how many)\s+(all\s+)?(documents?|files?|uploads?|versions?|folders?)",
        r"^(which|what)\s+(documents?|files?)\s+(failed|are processing|are completed|were uploaded)",
        r"^(all\s+)?documents?$",
        r"^(status of|check)\s+(documents?|files?)",
    ]

    FOLLOWUP_PATTERNS: ClassVar[List[str]] = [
        r"^(the|that)\s+(first|second|third|last|previous)\s+(one|document|file)",
        r"^(what about|tell me more about)\s+(it|that|them)",
        r"^(more|details|summary)$",
    ]

    CLASSIFICATION_MODEL: ClassVar[str] = "gpt-4o-mini"
    CLASSIFICATION_SYSTEM_PROMPT: ClassVar[str] = (
        "Classify the user's request into exactly one category: "
        "DOCUMENT_REGISTRY, DOCUMENT_SEARCH, or GENERAL_KNOWLEDGE. "
        "Return only the category name. A registry request lists, counts, "
        "or checks the status of workspace files. A document search asks "
        "about content inside workspace documents. General knowledge is "
        "unrelated to workspace files."
    )

    @classmethod
    async def route_query(
        cls,
        query: str,
        history: Optional[List[dict]] = None,
        llm_client: Optional[LLMClient] = None,
        llm_complete: Optional[Callable[[str], Awaitable[str]]] = None,
    ) -> QueryType:
        clean_query = query.strip().lower()

        if history and any(
            re.search(pattern, clean_query) for pattern in cls.FOLLOWUP_PATTERNS
        ):
            return QueryType.FOLLOW_UP

        for pattern in cls.REGISTRY_PATTERNS:
            if re.search(pattern, clean_query):
                return QueryType.DOCUMENT_REGISTRY

        if clean_query in {"documents", "files", "all files", "list"}:
            if history:
                return QueryType.FOLLOW_UP
            return QueryType.DOCUMENT_REGISTRY

        if llm_client is not None:
            return await cls._llm_classify_intent(query, llm_client)

        if llm_complete is not None:
            prompt = (
                f"{cls.CLASSIFICATION_SYSTEM_PROMPT}\n\n"
                f"User request: {query}\n\nCategory:"
            )
            return cls._parse_classification(await llm_complete(prompt))

        return QueryType.DOCUMENT_SEARCH

    @classmethod
    async def _llm_classify_intent(cls, query: str, llm_client: LLMClient) -> QueryType:
        response = await llm_client.chat.completions.create(
            model=cls.CLASSIFICATION_MODEL,
            messages=[
                {"role": "system", "content": cls.CLASSIFICATION_SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            temperature=0.0,
            max_tokens=10,
        )

        choices = response.choices
        content = choices[0].message.content if choices else None
        return cls._parse_classification(content)

    @classmethod
    def _parse_classification(cls, content: Optional[str]) -> QueryType:
        result = content.strip().upper() if content else ""
        categories = {
            QueryType.DOCUMENT_REGISTRY.value: QueryType.DOCUMENT_REGISTRY,
            QueryType.DOCUMENT_SEARCH.value: QueryType.DOCUMENT_SEARCH,
            QueryType.GENERAL_KNOWLEDGE.value: QueryType.GENERAL_KNOWLEDGE,
        }
        category = categories.get(result)
        if category is None:
            logger.warning(
                "LLM returned an invalid query category; defaulting to document search"
            )
            return QueryType.DOCUMENT_SEARCH
        return category
