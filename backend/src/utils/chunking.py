"""Structure-aware, token-budgeted text chunking.

The previous splitter cut the raw text every N *characters*, which sliced
sentences and words in half and produced chunks with no relation to the
document's structure. This module instead:

1. splits on the strongest natural boundary available (paragraph, then
   sentence, then a hard character cut as a last resort),
2. greedily packs those pieces up to a token budget, and
3. repeats a small tail of the previous chunk as overlap so a fact that
   straddles a boundary is still retrievable.

It is pure Python with no model dependency, so chunking a 1000-page book is
fast and completely free. ``chunk_text`` keeps returning ``list[str]``;
``chunk_text_with_spans`` additionally returns character offsets and an
optional page number, which the ingestion path stores for citations.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Callable, Iterable

# Boundaries, strongest first. Paragraph breaks are the best cut point; a
# sentence end is next; a hard cut is the fallback for minified text.
_PARAGRAPH_RE = re.compile(r"\n[ \t]*\n+")
_SENTENCE_RE = re.compile(r"[^.!?\n]+(?:[.!?]+|\n+|$)")

TokenCounter = Callable[[str], int]


@dataclass(frozen=True)
class ChunkSpan:
    """A chunk plus where it came from, for citations and page mapping."""

    text: str
    start: int
    end: int
    page_number: int | None = None


def _default_count_tokens(text: str) -> int:
    """Cheap ~4-chars-per-token estimate used when no tokenizer is supplied."""
    stripped = text.strip()
    if not stripped:
        return 0
    return max(1, math.ceil(len(stripped) / 4))


def _resolve_limits(
    max_tokens: int | None,
    overlap_tokens: int | None,
    min_chars: int | None,
) -> tuple[int, int, int]:
    if max_tokens is None or overlap_tokens is None or min_chars is None:
        # Imported lazily so the module stays usable without app settings.
        from src.core.config import settings

        if max_tokens is None:
            max_tokens = settings.CHUNK_MAX_TOKENS
        if overlap_tokens is None:
            overlap_tokens = settings.CHUNK_OVERLAP_TOKENS
        if min_chars is None:
            min_chars = settings.CHUNK_MIN_CHARS
    return max_tokens, overlap_tokens, min_chars


def _paragraph_spans(text: str) -> Iterable[tuple[int, int]]:
    start = 0
    for match in _PARAGRAPH_RE.finditer(text):
        yield start, match.start()
        start = match.end()
    yield start, len(text)


def _sentence_spans(text: str, start: int, end: int) -> Iterable[tuple[int, int]]:
    position = start
    for match in _SENTENCE_RE.finditer(text, start, end):
        span_start, span_end = match.span()
        if span_end <= position:
            continue
        if span_start < position:
            span_start = position
        yield span_start, span_end
        position = span_end
    if position < end:
        yield position, end


def _hard_split_spans(
    text: str,
    start: int,
    end: int,
    max_tokens: int,
    count_tokens: TokenCounter,
) -> list[tuple[int, int]]:
    """Last-resort split for a single run of text with no usable boundary."""
    approx_chars = max(1, max_tokens * 4)
    spans: list[tuple[int, int]] = []
    position = start
    while position < end:
        next_end = min(position + approx_chars, end)
        if next_end < end:
            space = text.rfind(" ", position + max(1, approx_chars // 2), next_end)
            if space > position:
                next_end = space + 1
        # A dense run can still exceed the budget; shrink until it fits.
        while next_end - position > 1:
            if count_tokens(text[position:next_end]) <= max_tokens:
                break
            next_end = position + max(1, (next_end - position) * 3 // 4)
        spans.append((position, next_end))
        position = next_end
    return spans


def _build_atoms(
    text: str, max_tokens: int, count_tokens: TokenCounter
) -> list[tuple[int, int]]:
    """Split ``text`` into boundary-aligned pieces, each within the budget."""
    atoms: list[tuple[int, int]] = []
    for paragraph_start, paragraph_end in _paragraph_spans(text):
        if paragraph_end <= paragraph_start:
            continue
        paragraph = text[paragraph_start:paragraph_end]
        if not paragraph.strip():
            continue
        # ``len // 4`` is a lower bound on the token count, so a paragraph
        # longer than this cannot fit; skip the tokenizer instead of encoding a
        # whole book just to learn it does not fit.
        if len(paragraph) <= max_tokens * 4 and (count_tokens(paragraph) <= max_tokens):
            atoms.append((paragraph_start, paragraph_end))
            continue

        for sentence_start, sentence_end in _sentence_spans(
            text, paragraph_start, paragraph_end
        ):
            sentence = text[sentence_start:sentence_end]
            if not sentence.strip():
                continue
            if len(sentence) <= max_tokens * 4 and (
                count_tokens(sentence) <= max_tokens
            ):
                atoms.append((sentence_start, sentence_end))
            else:
                atoms.extend(
                    _hard_split_spans(
                        text, sentence_start, sentence_end, max_tokens, count_tokens
                    )
                )
    return atoms


def _pack_atoms(
    text: str,
    atoms: list[tuple[int, int]],
    max_tokens: int,
    overlap_tokens: int,
    count_tokens: TokenCounter,
) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    index = 0
    total = len(atoms)
    while index < total:
        start = atoms[index][0]
        end = atoms[index][1]
        cursor = index + 1
        while cursor < total:
            candidate_end = atoms[cursor][1]
            if count_tokens(text[start:candidate_end]) > max_tokens:
                break
            end = candidate_end
            cursor += 1
        spans.append((start, end))

        if cursor >= total:
            break

        # Repeat the tail of this chunk as overlap for the next one, but never
        # spend more than the overlap budget and always make forward progress.
        next_index = cursor
        while next_index > index + 1 and (
            count_tokens(text[atoms[next_index - 1][0] : end]) <= overlap_tokens
        ):
            next_index -= 1
        index = max(next_index, index + 1)
    return spans


def _merge_short_tail(
    text: str, spans: list[tuple[int, int]], min_chars: int
) -> list[tuple[int, int]]:
    """Fold a tiny final fragment into the previous chunk."""
    if len(spans) < 2 or min_chars <= 0:
        return spans
    last_start, last_end = spans[-1]
    if len(text[last_start:last_end].strip()) >= min_chars:
        return spans
    previous_start, _ = spans[-2]
    return [*spans[:-2], (previous_start, last_end)]


def _page_for_offset(pages: list[tuple[int, str]], offset: int) -> int:
    """Map a character offset to a 1-based page number.

    ``pages`` must be the pages joined by a single newline, which is exactly
    how the PDF extractor assembles the document text.
    """
    cursor = 0
    for number, page_text in pages:
        length = len(page_text)
        if offset < cursor + length:
            return number
        cursor += length + 1
    return pages[-1][0]


def chunk_text_with_spans(
    text: str,
    max_tokens: int | None = None,
    overlap_tokens: int | None = None,
    min_chars: int | None = None,
    count_tokens: TokenCounter | None = None,
    pages: list[tuple[int, str]] | None = None,
) -> list[ChunkSpan]:
    """Chunk ``text`` and return each piece with its source offsets.

    ``count_tokens`` lets a caller supply the real embedding tokenizer; without
    it a fast character-based estimate is used.
    """
    if not text or not text.strip():
        return []

    max_tokens, overlap_tokens, min_chars = _resolve_limits(
        max_tokens, overlap_tokens, min_chars
    )
    if max_tokens <= 0:
        return []

    overlap_tokens = max(0, min(overlap_tokens, max_tokens - 1))
    counter = count_tokens or _default_count_tokens

    atoms = _build_atoms(text, max_tokens, counter)
    if not atoms:
        return []

    spans = _pack_atoms(text, atoms, max_tokens, overlap_tokens, counter)
    spans = _merge_short_tail(text, spans, min_chars)

    chunks: list[ChunkSpan] = []
    for start, end in spans:
        piece = text[start:end].strip()
        if not piece:
            continue
        page_number = _page_for_offset(pages, start) if pages else None
        chunks.append(
            ChunkSpan(text=piece, start=start, end=end, page_number=page_number)
        )
    return chunks


def chunk_text(
    text: str,
    max_tokens: int | None = None,
    overlap_tokens: int | None = None,
    min_chars: int | None = None,
    count_tokens: TokenCounter | None = None,
) -> list[str]:
    """Backwards-compatible wrapper returning only the chunk strings."""
    return [
        span.text
        for span in chunk_text_with_spans(
            text,
            max_tokens=max_tokens,
            overlap_tokens=overlap_tokens,
            min_chars=min_chars,
            count_tokens=count_tokens,
        )
    ]
