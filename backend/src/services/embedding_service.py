import math
import os
from pathlib import Path
from typing import List

from src.core.config import settings


def _resolve_model_source() -> tuple[str, bool]:
    """Return (source, use_local_files_only) for the sentence-transformer model."""
    local_path = Path(settings.EMBEDDING_MODEL_PATH)
    if local_path.is_dir():
        return str(local_path), True
    return settings.EMBEDDING_MODEL_ID, False


def _apply_offline_flags(local_only: bool) -> None:
    if local_only:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"


class EmbeddingService:
    _instance = None
    _model = None

    def __new__(cls):
        # Only memoise after the model has actually loaded, otherwise a failed
        # load leaves a half-initialised singleton behind and every later call
        # silently reuses it instead of retrying.
        if cls._instance is not None:
            return cls._instance

        from sentence_transformers import SentenceTransformer

        source, local_only = _resolve_model_source()
        _apply_offline_flags(local_only)
        model = SentenceTransformer(source, local_files_only=local_only)

        instance = super().__new__(cls)
        instance._model = model
        cls._instance = instance
        return instance

    @property
    def max_seq_length(self) -> int:
        """The model's input ceiling; chunks longer than this get truncated."""
        value = getattr(self._model, "max_seq_length", None)
        if isinstance(value, int) and value > 0:
            return value
        return settings.EMBEDDING_MAX_SEQ_LENGTH

    def count_tokens(self, text: str) -> int:
        """Token count via the model tokenizer, with a cheap fallback.

        The chunker uses this so it never hands the model a chunk that would be
        silently truncated at ``max_seq_length``.
        """
        if not text:
            return 0
        tokenizer = getattr(self._model, "tokenizer", None)
        if tokenizer is None:
            return max(1, math.ceil(len(text.strip()) / 4))
        try:
            encoded = tokenizer.encode(text, add_special_tokens=True)
        except TypeError:
            encoded = tokenizer.encode(text)
        return len(encoded)

    def get_embeddings(self, text: str) -> List[float]:
        vector = self._model.encode(text, convert_to_numpy=True)
        return vector.tolist()

    def get_embeddings_batch(
        self,
        texts: List[str],
        batch_size: int | None = None,
        show_progress_bar: bool = False,
    ) -> List[List[float]]:
        if not texts:
            return []

        vectors = self._model.encode(
            texts,
            batch_size=batch_size or settings.EMBEDDING_BATCH_SIZE,
            show_progress_bar=show_progress_bar,
            convert_to_numpy=True,
        )
        return vectors.tolist()
