"""Unit tests for the structure-aware chunker.

All limits are passed explicitly so the assertions do not depend on the values
in ``.env``. The default token counter is the ~4-chars-per-token estimate, which
is what the chunker falls back to when no model tokenizer is available.
"""

from src.utils.chunking import chunk_text, chunk_text_with_spans


def test_empty_or_whitespace_text_produces_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   \n\n  \t ") == []


def test_short_document_is_a_single_chunk():
    assert chunk_text("A short document.") == ["A short document."]


def test_long_text_splits_into_token_bounded_chunks():
    text = "Sentence number one is here. " * 30

    chunks = chunk_text_with_spans(text, max_tokens=20, min_chars=0)

    assert len(chunks) > 1
    for span in chunks:
        assert len(span.text) <= 20 * 4
        assert span.text.strip() == span.text


def test_chunks_overlap_when_the_previous_chunk_has_room():
    text = "aa. bb. cc. dd. ee. ff. gg. hh."

    spans = chunk_text_with_spans(text, max_tokens=4, overlap_tokens=2, min_chars=0)

    assert len(spans) >= 2
    assert spans[1].start < spans[0].end
    # The repeated tail is present in both the previous and the next chunk.
    assert "cc. dd." in spans[0].text
    assert "cc. dd." in spans[1].text


def test_tiny_trailing_fragment_is_merged_into_the_previous_chunk():
    text = "a" * 30 + "\n\n" + "tail"

    chunks = chunk_text_with_spans(text, max_tokens=8, min_chars=10)

    assert len(chunks) == 1
    assert chunks[0].text.endswith("tail")


def test_offsets_map_chunks_to_their_source_page():
    pages = [(1, "Alpha beta."), (2, "Gamma delta.")]
    text = "\n".join(page_text for _, page_text in pages)

    chunks = chunk_text_with_spans(
        text, max_tokens=3, overlap_tokens=0, min_chars=0, pages=pages
    )

    assert [chunk.page_number for chunk in chunks] == [1, 2]


def test_oversized_paragraph_is_cut_on_sentence_boundaries():
    text = "Short one. Short two. Short three."

    chunks = chunk_text_with_spans(text, max_tokens=6, overlap_tokens=0, min_chars=0)

    assert chunks[0].text == "Short one. Short two."
    assert chunks[1].text == "Short three."


def test_custom_token_counter_is_used():
    # A word-based counter makes each word one token.
    counter = lambda value: len(value.split())  # noqa: E731
    text = "one two three four five six seven eight"

    chunks = chunk_text_with_spans(
        text, max_tokens=3, overlap_tokens=0, min_chars=0, count_tokens=counter
    )

    assert len(chunks) > 1
    for span in chunks:
        assert counter(span.text) <= 3
