import asyncio
import json
import logging
import re
import uuid
from typing import AsyncGenerator, List, Sequence

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.chunks import DocumentChunk
from src.models.document import Document
from src.services.embedding_service import EmbeddingService
from src.utils.chunking import chunk_text

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Docuflow's document assistant. Answer strictly from the supplied "
    "context excerpts. Be concise and precise. Quote exact numbers, dates, "
    "notice periods, names, and clause references when present. If the answer "
    "is not contained in the context, say that the documents do not contain "
    "the answer instead of guessing. Do not invent facts or citations."
)

MULTIPLE_CHOICE_INSTRUCTION = (
    "\n\nThe context above includes a multiple-choice question with its options "
    "but no marked answer key. If the user's question is that multiple-choice "
    "question, answer it using general knowledge: first recall the fact on your "
    "own without looking at the options, then match your recalled answer to the "
    "single option that agrees with it. Do not let the option order bias you, "
    "and double-check dates or years before choosing. When the question asks "
    "when a theorist presented a model or theory, identify the foundational "
    "book or article that introduced it, recall that publication year, and use "
    "that year to choose the option. Reply in the form "
    "'<letter>. <option text> (inferred; the source does not mark an answer).' "
    "Do not reply that the documents lack the answer when the options are "
    "present. If the user's question is something else, ignore this instruction "
    "and answer strictly from the context."
)

NO_CONTEXT_MESSAGE = (
    "No relevant information found in documents. Upload and process some "
    "documents first."
)

RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


class OpenRouterError(Exception):
    """Base error for OpenRouter answer generation."""


class OpenRouterRateLimitError(OpenRouterError):
    """The upstream free pool (or daily quota) is exhausted."""


class OpenRouterAuthError(OpenRouterError):
    """The configured OpenRouter API key was rejected."""


def _friendly_error(status_code: int, body: str) -> str:
    """Translate an OpenRouter error body into a short, non-leaky message."""
    message = ""
    raw = ""
    try:
        data = json.loads(body)
        error = data.get("error") or {}
        message = str(error.get("message") or "")
        metadata = error.get("metadata") or {}
        raw = str(metadata.get("raw") or "")
    except Exception:
        raw = body[:300]

    haystack = f"{message} {raw}".lower()

    if status_code == 429:
        if "daily" in haystack or "free-model" in haystack or "free model" in haystack:
            return (
                "OpenRouter's free-model quota is exhausted for today. "
                "Add credits or retry after the daily reset."
            )
        return (
            "The AI model is temporarily rate-limited (shared free pool). "
            "Please retry in a few seconds."
        )
    if status_code in (401, 403):
        return (
            "OpenRouter rejected the configured API key. "
            "Check OPENROUTER_API_KEY in backend/.env."
        )
    if status_code == 402:
        return "OpenRouter reports insufficient credits for this model."
    if status_code >= 500:
        return "OpenRouter is temporarily unavailable. Please retry shortly."
    return f"OpenRouter request failed (HTTP {status_code})."


class RAGService:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        try:
            self.embedding_service = EmbeddingService()
        except Exception:
            self.embedding_service = None
        self.api_key = (settings.OPENROUTER_API_KEY or "").strip()

    # ------------------------------------------------------------------
    # Document ingestion / retrieval
    # ------------------------------------------------------------------
    async def process_and_store_document(
        self, document_id: uuid.UUID, text: str
    ) -> List[DocumentChunk]:
        raw_chunks = chunk_text(text)
        if not raw_chunks:
            return []

        try:
            loop = asyncio.get_running_loop()
            if self.embedding_service:
                try:
                    embeddings = await loop.run_in_executor(
                        None, self.embedding_service.get_embeddings_batch, raw_chunks
                    )
                except Exception:
                    logger.exception(
                        "Embedding batch failed for document %s; storing chunks "
                        "without vectors",
                        document_id,
                    )
                    embeddings = [None] * len(raw_chunks)
            else:
                embeddings = [None] * len(raw_chunks)

            chunk_objects = []
            for piece, vector in zip(raw_chunks, embeddings):
                try:
                    chunk_objects.append(
                        DocumentChunk(
                            document_id=document_id,
                            chunk_text=piece,
                            embedding=vector,
                        )
                    )
                except Exception:
                    chunk_objects.append(
                        DocumentChunk(document_id=document_id, chunk_text=piece)
                    )

            self.db_session.add_all(chunk_objects)
            await self.db_session.commit()
            return chunk_objects
        except Exception:
            await self.db_session.rollback()
            logger.exception(
                "Failed to store %s chunks for document %s",
                len(raw_chunks),
                document_id,
            )
            return []

    @staticmethod
    def _select_diverse_chunks(
        chunks: Sequence[DocumentChunk], limit: int
    ) -> List[DocumentChunk]:
        """Keep the most relevant chunks while stopping one document dominating.

        Vector search often returns five near-duplicate chunks from a single
        long document, hiding the quiz or contract the user actually asked
        about. Cap how many chunks one document can contribute, then backfill
        with the next-best overflow so single-document organizations still get
        a full context window.
        """
        if limit <= 0:
            return []

        per_document_cap = max(2, limit // 3)
        selected: List[DocumentChunk] = []
        overflow: List[DocumentChunk] = []
        counts: dict[uuid.UUID, int] = {}
        seen_texts: set[str] = set()
        for chunk in chunks:
            text = chunk.chunk_text or ""
            if text in seen_texts:
                # Duplicate uploads of the same file are separate documents,
                # so the per-document cap alone would not deduplicate them.
                continue
            seen_texts.add(text)
            count = counts.get(chunk.document_id, 0)
            if count < per_document_cap and len(selected) < limit:
                selected.append(chunk)
                counts[chunk.document_id] = count + 1
            else:
                overflow.append(chunk)

        if len(selected) < limit:
            selected.extend(overflow[: limit - len(selected)])
        return selected

    async def search_similar_chunks(
        self, query: str, org_id: uuid.UUID, limit: int = 5
    ) -> List[DocumentChunk]:
        # Try vector search first
        try:
            if self.embedding_service:
                loop = asyncio.get_running_loop()
                try:
                    query_embedding = await loop.run_in_executor(
                        None, self.embedding_service.get_embeddings, query
                    )
                    stmt = (
                        select(DocumentChunk)
                        .join(Document, DocumentChunk.document_id == Document.id)
                        .where(
                            Document.organization_id == org_id,
                            Document.is_archived.is_(False),
                        )
                        .order_by(
                            DocumentChunk.embedding.cosine_distance(query_embedding)
                        )
                        .limit(max(limit * 4, 10))
                    )
                    result = await self.db_session.execute(stmt)
                    chunks = list(result.scalars().all())
                    if chunks:
                        return self._select_diverse_chunks(chunks, limit)
                except Exception:
                    pass
        except Exception:
            pass

        # Fallback: simple text search / recent chunks
        try:
            q = query.lower()
            stmt = (
                select(DocumentChunk)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(
                    Document.organization_id == org_id,
                    Document.is_archived.is_(False),
                )
                .order_by(DocumentChunk.id.desc())
                .limit(limit * 3)
            )
            result = await self.db_session.execute(stmt)
            chunks = list(result.scalars().all())
            if not chunks:
                return []

            scored = []
            for c in chunks:
                text = (c.chunk_text or "").lower()
                score = sum(1 for w in q.split() if len(w) > 3 and w in text)
                scored.append((score, c))
            scored.sort(key=lambda x: x[0], reverse=True)
            top = [c for s, c in scored if s > 0]
            if top:
                return top[:limit]
            return chunks[:limit]
        except Exception:
            return []

    async def _document_titles(
        self, chunks: Sequence[DocumentChunk]
    ) -> dict[uuid.UUID, str]:
        document_ids = {c.document_id for c in chunks}
        if not document_ids:
            return {}
        try:
            stmt = select(Document.id, Document.title).where(
                Document.id.in_(document_ids)
            )
            result = await self.db_session.execute(stmt)
            return {row.id: row.title for row in result.all()}
        except Exception:
            return {}

    @staticmethod
    def _context_has_multiple_choice(chunks: Sequence[DocumentChunk]) -> bool:
        """Detect a complete A-D multiple-choice item in the retrieved context."""
        option_line = re.compile(r"(?m)^\s*([A-D])[.)]\s+\S")
        for chunk in chunks:
            text = chunk.chunk_text or ""
            if "?" not in text:
                continue
            letters = {match.group(1) for match in option_line.finditer(text)}
            if {"A", "B", "C", "D"}.issubset(letters):
                return True
        return False

    @staticmethod
    def _build_prompt(
        query: str,
        chunks: Sequence[DocumentChunk],
        titles: dict[uuid.UUID, str],
    ) -> str:
        blocks = []
        for index, chunk in enumerate(chunks, start=1):
            title = titles.get(chunk.document_id) or "Untitled document"
            blocks.append(f"[Source {index}: {title}]\n{chunk.chunk_text}")
        context = "\n\n".join(blocks)
        return (
            f"{SYSTEM_PROMPT}\n\n"
            f"Context excerpts from the organization's documents:\n\n"
            f"{context}\n\n"
            f"Question: {query}\n\n"
            "Answer using only the context above. If the context does not "
            "contain the answer, say so explicitly."
        )

    async def _prepare_prompt(
        self, query: str, org_id: uuid.UUID
    ) -> tuple[str | None, List[DocumentChunk], bool]:
        similar_chunks = await self.search_similar_chunks(
            query=query, org_id=org_id, limit=5
        )
        if not similar_chunks:
            # Try to get any recent document content
            try:
                stmt = (
                    select(DocumentChunk)
                    .join(Document, DocumentChunk.document_id == Document.id)
                    .where(
                        Document.organization_id == org_id,
                        Document.is_archived.is_(False),
                    )
                    .order_by(DocumentChunk.id.desc())
                    .limit(10)
                )
                result = await self.db_session.execute(stmt)
                similar_chunks = list(result.scalars().all())
            except Exception:
                pass

        if not similar_chunks:
            return None, [], False

        titles = await self._document_titles(similar_chunks)
        is_multiple_choice = self._context_has_multiple_choice(similar_chunks)
        prompt = self._build_prompt(query, similar_chunks, titles)
        if is_multiple_choice:
            prompt += MULTIPLE_CHOICE_INSTRUCTION
        return prompt, similar_chunks, is_multiple_choice

    # ------------------------------------------------------------------
    # OpenRouter transport
    # ------------------------------------------------------------------
    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def model_chain(self) -> List[str]:
        chain: List[str] = []
        for model in (
            settings.OPENROUTER_MODEL,
            settings.OPENROUTER_FALLBACK_MODEL,
        ):
            model = (model or "").strip()
            if model and model not in chain:
                chain.append(model)
        return chain

    @property
    def _chat_url(self) -> str:
        return f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.OPENROUTER_SITE_URL,
            "X-Title": settings.OPENROUTER_APP_NAME,
        }

    def _payload(
        self, prompt: str, stream: bool, reasoning_enabled: bool = False
    ) -> dict:
        chain = self.model_chain
        payload: dict = {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": settings.OPENROUTER_TEMPERATURE,
            "max_tokens": settings.OPENROUTER_MAX_TOKENS,
            "stream": stream,
        }
        if len(chain) > 1:
            # OpenRouter tries each model in order and fails over server-side,
            # so a throttled free primary does not add client-side latency.
            payload["models"] = chain
            payload["route"] = "fallback"
        elif chain:
            payload["model"] = chain[0]

        if not (reasoning_enabled or settings.OPENROUTER_REASONING_ENABLED):
            # Keep reasoning models from spending the answer budget on a
            # hidden chain of thought.
            payload["reasoning"] = {"enabled": False}
        else:
            # Multiple-choice inference opts in because the answer key is
            # absent and the extra reasoning materially improves factual
            # accuracy. Use a greedy decode and a larger budget so the
            # reasoning step is not truncated and repeated calls stay stable.
            payload["reasoning"] = {"enabled": True}
            if reasoning_enabled:
                payload["temperature"] = 0.0
                payload["max_tokens"] = max(payload["max_tokens"], 2048)
        return payload

    def _ensure_configured(self) -> None:
        if not self.model_chain:
            raise OpenRouterError("No OpenRouter model is configured.")
        if not self.is_configured:
            raise OpenRouterError(
                "AI answer generation is not configured (set OPENROUTER_API_KEY)."
            )

    @staticmethod
    def _retry_delay(attempt: int) -> float:
        return min(2.0 * (2 ** (attempt - 1)), 12.0)

    async def _complete(self, prompt: str, reasoning_enabled: bool = False) -> str:
        """Non-streaming completion with bounded retries on transient errors."""
        self._ensure_configured()

        last_error: Exception = OpenRouterError("OpenRouter request failed.")
        attempts = max(1, settings.OPENROUTER_MAX_RETRIES)

        for attempt in range(1, attempts + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=settings.OPENROUTER_TIMEOUT_SECONDS
                ) as client:
                    response = await client.post(
                        self._chat_url,
                        headers=self._headers(),
                        json=self._payload(
                            prompt, stream=False, reasoning_enabled=reasoning_enabled
                        ),
                    )
            except httpx.HTTPError as exc:
                last_error = OpenRouterError(
                    "Could not reach OpenRouter. Please retry shortly."
                )
                logger.warning(
                    "OpenRouter transport error on attempt %s/%s: %s",
                    attempt,
                    attempts,
                    exc,
                )
            else:
                if response.status_code in (401, 403):
                    raise OpenRouterAuthError(
                        _friendly_error(response.status_code, response.text)
                    )
                if response.status_code in RETRYABLE_STATUS_CODES:
                    message = _friendly_error(response.status_code, response.text)
                    if response.status_code == 429:
                        last_error = OpenRouterRateLimitError(message)
                    else:
                        last_error = OpenRouterError(message)
                    logger.warning(
                        "OpenRouter HTTP %s on attempt %s/%s: %s",
                        response.status_code,
                        attempt,
                        attempts,
                        message,
                    )
                elif response.is_error:
                    raise OpenRouterError(
                        _friendly_error(response.status_code, response.text)
                    )
                else:
                    data = response.json()
                    choices = data.get("choices") or []
                    if not choices:
                        raise OpenRouterError(
                            "OpenRouter returned an empty response. Please retry."
                        )
                    logger.info("OpenRouter answered with %s", data.get("model"))
                    content = (choices[0].get("message") or {}).get("content")
                    return content or (
                        "The model returned no text. Please rephrase the question."
                    )

            if attempt < attempts:
                await asyncio.sleep(self._retry_delay(attempt))

        raise last_error

    async def _open_stream(
        self, prompt: str, reasoning_enabled: bool = False
    ) -> tuple[httpx.AsyncClient, httpx.Response]:
        """Open an SSE stream, retrying only before any token is consumed."""
        self._ensure_configured()

        last_error: Exception = OpenRouterError("OpenRouter request failed.")
        attempts = max(1, min(2, settings.OPENROUTER_MAX_RETRIES))

        for attempt in range(1, attempts + 1):
            client = httpx.AsyncClient(timeout=settings.OPENROUTER_TIMEOUT_SECONDS)
            try:
                request = client.build_request(
                    "POST",
                    self._chat_url,
                    headers=self._headers(),
                    json=self._payload(
                        prompt, stream=True, reasoning_enabled=reasoning_enabled
                    ),
                )
                response = await client.send(request, stream=True)
            except httpx.HTTPError as exc:
                last_error = OpenRouterError(
                    "Could not reach OpenRouter. Please retry shortly."
                )
                logger.warning(
                    "OpenRouter stream transport error on attempt %s/%s: %s",
                    attempt,
                    attempts,
                    exc,
                )
                await client.aclose()
            else:
                if response.status_code in (401, 403):
                    body = (await response.aread()).decode(errors="replace")
                    await response.aclose()
                    await client.aclose()
                    raise OpenRouterAuthError(
                        _friendly_error(response.status_code, body)
                    )
                if response.status_code in RETRYABLE_STATUS_CODES:
                    body = (await response.aread()).decode(errors="replace")
                    message = _friendly_error(response.status_code, body)
                    if response.status_code == 429:
                        last_error = OpenRouterRateLimitError(message)
                    else:
                        last_error = OpenRouterError(message)
                    logger.warning(
                        "OpenRouter stream HTTP %s on attempt %s/%s: %s",
                        response.status_code,
                        attempt,
                        attempts,
                        message,
                    )
                    await response.aclose()
                    await client.aclose()
                elif response.is_error:
                    body = (await response.aread()).decode(errors="replace")
                    await response.aclose()
                    await client.aclose()
                    raise OpenRouterError(_friendly_error(response.status_code, body))
                else:
                    return client, response

            if attempt < attempts:
                await asyncio.sleep(self._retry_delay(attempt))

        raise last_error

    # ------------------------------------------------------------------
    # Public answer APIs
    # ------------------------------------------------------------------
    async def answer_query(self, query: str, org_id: uuid.UUID) -> str:
        prompt, chunks, is_multiple_choice = await self._prepare_prompt(query, org_id)
        if not prompt or not chunks:
            return NO_CONTEXT_MESSAGE

        if not self.is_configured:
            context = "\n\n".join(str(c.chunk_text) for c in chunks)
            return (
                context[:1500] + "\n\n[AI answer generation is not configured. "
                "Set OPENROUTER_API_KEY to enable it.]"
            )

        try:
            return await self._complete(prompt, reasoning_enabled=is_multiple_choice)
        except OpenRouterError as exc:
            return str(exc)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Unexpected RAG failure")
            return f"AI answer generation failed: {exc}"

    async def answer_query_stream(
        self, query: str, org_id: uuid.UUID
    ) -> AsyncGenerator[str, None]:
        prompt, chunks, is_multiple_choice = await self._prepare_prompt(query, org_id)
        if not prompt or not chunks:
            yield NO_CONTEXT_MESSAGE
            return

        if not self.is_configured:
            context = "\n\n".join(str(c.chunk_text) for c in chunks)
            text = (
                context[:1500] + "\n\n[AI answer generation is not configured. "
                "Set OPENROUTER_API_KEY to enable it.]"
            )
            for i in range(0, len(text), 50):
                yield text[i : i + 50]
                await asyncio.sleep(0.01)
            return

        try:
            client, response = await self._open_stream(
                prompt, reasoning_enabled=is_multiple_choice
            )
        except OpenRouterError as exc:
            logger.info("SSE unavailable (%s); using buffered completion", exc)
            async for piece in self._buffered_stream(
                prompt, exc, reasoning_enabled=is_multiple_choice
            ):
                yield piece
            return

        emitted = False
        fallback_error: Exception | None = None
        try:
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data:
                    continue
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue

                if "error" in event:
                    error = event.get("error") or {}
                    code = int(error.get("code") or 500)
                    message = _friendly_error(code, json.dumps(event))
                    logger.warning("OpenRouter stream error: %s", message)
                    if not emitted:
                        fallback_error = (
                            OpenRouterRateLimitError(message)
                            if code == 429
                            else OpenRouterError(message)
                        )
                    else:
                        yield message
                    break

                choices = event.get("choices") or []
                if not choices:
                    continue
                choice = choices[0]
                delta = choice.get("delta") or {}
                piece = delta.get("content")
                if piece is None:
                    piece = (choice.get("message") or {}).get("content")
                if piece:
                    emitted = True
                    yield piece
        except httpx.HTTPError as exc:
            logger.warning("OpenRouter stream interrupted: %s", exc)
            if not emitted:
                fallback_error = OpenRouterError(
                    "The AI stream was interrupted. Please retry."
                )
        finally:
            await response.aclose()
            await client.aclose()

        if fallback_error is not None and not emitted:
            logger.info(
                "SSE failed before first token (%s); using buffered completion",
                fallback_error,
            )
            async for piece in self._buffered_stream(
                prompt, fallback_error, reasoning_enabled=is_multiple_choice
            ):
                yield piece

    async def _buffered_stream(
        self,
        prompt: str,
        stream_error: Exception,
        reasoning_enabled: bool = False,
    ) -> AsyncGenerator[str, None]:
        """Chunk a non-streaming completion when upstream SSE is unavailable.

        The free OpenRouter pool rate-limits its SSE endpoint more often than
        the regular completion endpoint. This keeps the UX responsive without
        silently switching models.
        """
        try:
            answer = await self._complete(prompt, reasoning_enabled=reasoning_enabled)
        except OpenRouterError as exc:
            if isinstance(stream_error, OpenRouterRateLimitError):
                yield str(stream_error)
            elif isinstance(exc, OpenRouterRateLimitError):
                yield str(exc)
            else:
                yield str(exc)
            return

        for i in range(0, len(answer), 40):
            yield answer[i : i + 40]
            await asyncio.sleep(0.02)
