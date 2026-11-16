"""Optional LangSmith tracing for the Docuflow RAG pipeline.

LangSmith is a *soft* dependency. When the SDK is not installed, or tracing is
switched off, every helper here degrades to a no-op so ingestion and chat keep
working exactly as before. Configuration comes from ``Settings`` and is pushed
into the environment before the SDK builds its first run tree, because the SDK
reads ``LANGSMITH_*`` variables directly.

The public surface is deliberately tiny:

* :func:`traceable` -- decorate a function/method so each call becomes a run.
* :func:`trace_span` -- wrap a block of work (e.g. one PDF page) in a run.
* :func:`annotate_run` -- attach metadata/outputs to the active run.
* :func:`record_llm_usage` -- attach provider/model/token usage to an LLM run.
* :func:`summarize_chunks` -- compact, PII-safe view of retrieved chunks.

Long strings are truncated before they leave the process so a book-length
document cannot blow up the trace payload.
"""

from __future__ import annotations

import contextlib
import functools
import inspect
import logging
import os
from typing import Any, Callable, Iterator

from src.core.config import settings

logger = logging.getLogger(__name__)

_MAX_VALUE_CHARS = 4000
_MAX_LIST_ITEMS = 50
_MAX_DEPTH = 3

try:  # pragma: no cover - import path depends on the installed SDK
    from langsmith import traceable as _ls_traceable
    from langsmith.run_helpers import get_current_run_tree as _ls_get_current_run_tree
    from langsmith.run_helpers import trace as _ls_trace
    from langsmith.utils import tracing_is_enabled as _ls_tracing_is_enabled

    LANGSMITH_AVAILABLE = True
except Exception:  # pragma: no cover - tracing is optional
    _ls_traceable = None
    _ls_get_current_run_tree = None
    _ls_trace = None
    _ls_tracing_is_enabled = None
    LANGSMITH_AVAILABLE = False


_TRACING_ENABLED = False


def _as_bool(value: Any) -> bool | None:
    """Interpret an env-style value, returning ``None`` when it is unset."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off", ""}:
        return False
    return None


def setup_tracing() -> bool:
    """Push tracing config into the environment and report whether it is on.

    An explicit ``LANGSMITH_TRACING`` environment variable always wins, so a
    test run can force tracing off even when ``.env`` turns it on.
    """
    global _TRACING_ENABLED

    if not LANGSMITH_AVAILABLE:
        _TRACING_ENABLED = False
        os.environ["LANGSMITH_TRACING"] = "false"
        return False

    enabled = bool(settings.LANGSMITH_TRACING)
    override = _as_bool(os.environ.get("LANGSMITH_TRACING"))
    if override is not None:
        enabled = override

    api_key = (settings.LANGSMITH_API_KEY or "").strip()
    if enabled and not api_key:
        logger.warning(
            "LANGSMITH_TRACING is enabled but LANGSMITH_API_KEY is empty; "
            "tracing stays off."
        )
        enabled = False

    os.environ["LANGSMITH_TRACING"] = "true" if enabled else "false"
    if api_key:
        os.environ["LANGSMITH_API_KEY"] = api_key
    if settings.LANGSMITH_PROJECT:
        os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT
    if settings.LANGSMITH_ENDPOINT:
        os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT

    _TRACING_ENABLED = enabled
    if enabled:
        logger.info(
            "LangSmith tracing enabled (project=%s)", settings.LANGSMITH_PROJECT
        )
    return enabled


def tracing_enabled() -> bool:
    """True only when the SDK is present and tracing is switched on."""
    if not _TRACING_ENABLED or _ls_tracing_is_enabled is None:
        return False
    try:
        return bool(_ls_tracing_is_enabled())
    except Exception:  # pragma: no cover - defensive
        return False


# ---------------------------------------------------------------------------
# Safe serialisation
# ---------------------------------------------------------------------------
def _truncate(value: str) -> str:
    if len(value) <= _MAX_VALUE_CHARS:
        return value
    dropped = len(value) - _MAX_VALUE_CHARS
    return f"{value[:_MAX_VALUE_CHARS]}… [{dropped} chars truncated]"


def _safe_value(value: Any, depth: int = 0) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return _truncate(value)
    if depth >= _MAX_DEPTH:
        return repr(value)[:200]
    if isinstance(value, dict):
        return {
            str(key): _safe_value(item, depth + 1)
            for key, item in list(value.items())[:_MAX_LIST_ITEMS]
        }
    if isinstance(value, (list, tuple, set)):
        return [_safe_value(item, depth + 1) for item in list(value)[:_MAX_LIST_ITEMS]]
    return repr(value)[:500]


def process_inputs(inputs: dict[str, Any]) -> dict[str, Any]:
    """Drop ``self`` and truncate the remaining arguments for a run payload."""
    return {key: _safe_value(value) for key, value in inputs.items() if key != "self"}


def process_outputs(outputs: Any) -> Any:
    return _safe_value(outputs)


def summarize_chunks(chunks: Any, preview_chars: int = 240) -> list[dict[str, Any]]:
    """Return a compact, serialisable view of retrieved/stored chunks."""
    summary: list[dict[str, Any]] = []
    for index, chunk in enumerate(list(chunks)[:_MAX_LIST_ITEMS], start=1):
        text = str(getattr(chunk, "chunk_text", "") or "")
        summary.append(
            {
                "index": index,
                "document_id": str(getattr(chunk, "document_id", "") or ""),
                "chunk_index": getattr(chunk, "chunk_index", None),
                "page_number": getattr(chunk, "page_number", None),
                "chars": len(text),
                "preview": text[:preview_chars],
            }
        )
    return summary


def chunks_output(outputs: Any) -> Any:
    """``process_outputs`` variant for functions that return chunk lists."""
    if isinstance(outputs, list):
        return {"chunk_count": len(outputs), "chunks": summarize_chunks(outputs)}
    return _safe_value(outputs)


# ---------------------------------------------------------------------------
# Decorator / spans
# ---------------------------------------------------------------------------
def _noop_traceable(*args: Any, **kwargs: Any) -> Any:
    """Stand-in for ``langsmith.traceable`` when the SDK is unavailable."""

    def decorator(func: Callable) -> Callable:
        if inspect.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*f_args: Any, **f_kwargs: Any) -> Any:
                return await func(*f_args, **f_kwargs)

            return async_wrapper

        @functools.wraps(func)
        def wrapper(*f_args: Any, **f_kwargs: Any) -> Any:
            return func(*f_args, **f_kwargs)

        return wrapper

    if len(args) == 1 and callable(args[0]) and not kwargs:
        return decorator(args[0])
    return decorator


def traceable(*args: Any, **kwargs: Any) -> Any:
    """``langsmith.traceable`` with safe defaults, or a transparent no-op."""
    if not LANGSMITH_AVAILABLE:
        return _noop_traceable(*args, **kwargs)
    kwargs.setdefault("process_inputs", process_inputs)
    kwargs.setdefault("process_outputs", process_outputs)
    return _ls_traceable(*args, **kwargs)


@contextlib.contextmanager
def trace_span(
    name: str,
    run_type: str = "chain",
    inputs: dict[str, Any] | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Iterator[Any]:
    """Open a child run for a block of work; yields ``None`` when disabled."""
    if not tracing_enabled():
        yield None
        return

    with _ls_trace(
        name=name,
        run_type=run_type,
        inputs=process_inputs(inputs or {}),
        tags=tags,
        metadata=_safe_value(metadata) if metadata else None,
    ) as run:
        yield run


def current_run() -> Any:
    if not tracing_enabled() or _ls_get_current_run_tree is None:
        return None
    try:
        return _ls_get_current_run_tree()
    except Exception:  # pragma: no cover - defensive
        return None


def annotate_run(
    metadata: dict[str, Any] | None = None,
    outputs: Any = None,
    run: Any = None,
) -> None:
    """Attach metadata/outputs to ``run`` (or the active run) when tracing."""
    tree = run if run is not None else current_run()
    if tree is None:
        return
    try:
        if metadata:
            tree.add_metadata(_safe_value(metadata))
        if outputs is not None:
            tree.add_outputs({"result": _safe_value(outputs)})
    except Exception:  # pragma: no cover - tracing must never break a request
        logger.debug("Could not annotate LangSmith run", exc_info=True)


def record_llm_usage(
    run: Any,
    *,
    provider: str,
    model: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    usage: dict[str, Any] | None = None,
) -> None:
    """Record which provider/model answered and how many tokens it used."""
    if run is None:
        return
    metadata: dict[str, Any] = {"provider": provider}
    if model:
        metadata["model"] = model
    if prompt_tokens is not None:
        metadata["prompt_tokens"] = prompt_tokens
    if completion_tokens is not None:
        metadata["completion_tokens"] = completion_tokens
    if total_tokens is not None:
        metadata["total_tokens"] = total_tokens
    if usage:
        metadata["usage"] = _safe_value(usage)
    annotate_run(metadata=metadata, run=run)


# Configure at import so the SDK sees the right environment before its first
# run tree is created (the worker and the API both import this module).
setup_tracing()
