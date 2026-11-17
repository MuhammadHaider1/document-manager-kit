# syntax=docker/dockerfile:1
#
# Production image for the DocuFlow API and Celery worker.
#
#   docker build --target api    -t docuflow-api    .
#   docker build --target worker -t docuflow-worker .
#
# Both targets share the same base layers, so building the second one reuses the
# dependency install and the baked embedding model instead of repeating them.

# ---------------------------------------------------------------------------
# Builder: installs the full Python stack and downloads the embedding model.
# The build tooling stays in this stage and never reaches the runtime image.
# ---------------------------------------------------------------------------
FROM python:3.14-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt requirements-rag.txt ./

# CPU-only PyTorch: the default PyPI wheel bundles the ~2 GB CUDA runtime, which
# a CPU host can never use. Installing the +cpu build first means the
# requirements install below finds the pin already satisfied and leaves it
# untouched.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.13.0 \
    && pip install -r requirements.txt -r requirements-rag.txt

# Bake the embedding model into the image so a cold start needs no HuggingFace
# access. EMBEDDING_MODEL_PATH points at this copy at runtime.
ARG EMBEDDING_MODEL_ID=all-MiniLM-L6-v2
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('${EMBEDDING_MODEL_ID}').save('/opt/models/all-MiniLM-L6-v2')"

# ---------------------------------------------------------------------------
# Runtime base shared by the API and the worker.
# ---------------------------------------------------------------------------
FROM python:3.14-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/opt/venv/bin:$PATH" \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    TOKENIZERS_PARALLELISM=false

# libgomp1 is the OpenMP runtime torch's CPU kernels link against; curl backs
# the container health check.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /opt/models /app/models
COPY . .

RUN chown -R appuser:appuser /app
USER appuser

# ---------------------------------------------------------------------------
# API target
# ---------------------------------------------------------------------------
FROM base AS api

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# The API is only reachable through the reverse proxy on the private network, so
# trusting X-Forwarded-* from that network lets the audit log record the real
# client IP instead of the proxy's.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", "--proxy-headers", "--forwarded-allow-ips=*"]

# ---------------------------------------------------------------------------
# Celery worker target
# ---------------------------------------------------------------------------
FROM base AS worker

HEALTHCHECK --interval=60s --timeout=15s --start-period=60s --retries=3 \
    CMD celery -A src.tasks.celery_app.app inspect ping -d "celery@$$HOSTNAME" || exit 1

CMD ["celery", "-A", "src.tasks.celery_app.app", "worker", "--loglevel=INFO", "--concurrency=1"]
