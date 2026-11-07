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
        # The bare forms users actually type: "documents", "all docs", etc.
        r"^(all\s+)?(my\s+|our\s+|the\s+)?(documents?|docs?|files?)$",
        r"^(a\s+)?list\s+of\s+(all\s+)?((my|our|the)\s+)?(documents?|docs?|files?)$",
        r"^(check|show|list|view)\s+(all\s+)?(my|our)\s+(documents?|docs?|files?)$",
        r"^(tell me|show me|give me)\s+(the\s+)?(available|availabe|current)\s+(documents?|docs?|files?)(\s+in\s+(my|our|the)\s+(organization|workspace))?$",
        r"^(what|which)\s+(documents?|docs?|files?)\s+(do|can)\s+(i|we)\s+(have|access|see)$",
        r"^(all\s+)?(my\s+|our\s+)?(documents?|docs?|files?)\s+(list|register)$",
        # List requests must end at the file noun so "show documents that
        # mention termination" stays a content search.
        r"^(list|show|display|enumerate|view|get|give me)\s+(me\s+)?(all\s+)?(my\s+|our\s+|the\s+)?(documents?|docs?|files?|uploads?|versions?|folders?)$",
        r"^(how many|count|number of)\b.{0,40}\b(documents?|docs?|files?|uploads?)\b",
        r"^(which|what)\s+(documents?|docs?|files?)\s+(failed|are processing|are completed|were uploaded|need attention)",
        r"^(list|show|display|which|what)?\s*(all\s+)?(failed|processing|pending|queued|indexed|completed|ready)\s+(documents?|docs?|files?|uploads?)$",
        r"^(documents?|docs?|files?|uploads?)\s+(that\s+)?(failed|(are\s+)?(still\s+)?processing|are\s+pending|are\s+(indexed|completed|ready)|need\s+attention)$",
        r"^(status of|check)\s+(the\s+)?(documents?|files?|uploads?)$",
        r"^(recent|latest|newest)\s+(documents?|docs?|files?)$",
        r"^(archived|deleted)\s+(documents?|docs?|files?)$",
        r"\b(document register|document list|file register)\b",
    ]

    FOLLOWUP_PATTERNS: ClassVar[List[str]] = [
        r"^(the|that)\s+(first|second|third|last|previous)\s+(one|document|file)",
        r"^(what about|tell me more about)\s+(it|that|them)",
        r"^(what about|how about)\s+(the\s+)?(first|second|third|last|next|previous)\s+(one|document|file)",
        r"^(does|do|did|is|are|was|were|can|could|would|will|has|have|had)\s+(it|that|this|they|those|these)\b",
        r"^(how|when|where|why)\b.{0,30}\b(it|that|this|they|them|those|these)\b",
        r"^(and|also|then|so)\b",
        r"^(more|details|summary)$",
    ]

    GENERAL_PATTERNS: ClassVar[List[str]] = [
        r"^(hi|hello|hey|hiya|greetings)(\s+(there|docuflow))?$",
        r"^good\s+(morning|afternoon|evening)$",
    ]

    @staticmethod
    def _normalise(query: str) -> str:
        return re.sub(r"\s+", " ", query.strip().lower()).strip(" .,!?:;")

    @classmethod
    def is_greeting(cls, query: str) -> bool:
        text = cls._normalise(query)
        return any(re.search(pattern, text) for pattern in cls.GENERAL_PATTERNS)

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
        clean_query = cls._normalise(query)

        if history and any(
            re.search(pattern, clean_query) for pattern in cls.FOLLOWUP_PATTERNS
        ):
            return QueryType.FOLLOW_UP

        for pattern in cls.REGISTRY_PATTERNS:
            if re.search(pattern, clean_query):
                return QueryType.DOCUMENT_REGISTRY

        if cls.is_greeting(clean_query):
            return QueryType.GENERAL_KNOWLEDGE

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
    def registry_status(cls, query: str) -> Optional[str]:
        """Return the processing-status filter implied by a registry question."""
        text = cls._normalise(query)
        if re.search(r"\b(failed|failure|error|errored)\b", text):
            return "failed"
        if re.search(r"\b(processing|indexing)\b", text):
            return "processing"
        if re.search(r"\b(pending|queued|waiting)\b", text):
            return "pending"
        if re.search(r"\b(indexed|completed|complete|ready|processed)\b", text):
            return "completed"
        return None

    @classmethod
    def is_archived_request(cls, query: str) -> bool:
        return bool(re.search(r"\b(archived?|deleted)\b", cls._normalise(query)))

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
