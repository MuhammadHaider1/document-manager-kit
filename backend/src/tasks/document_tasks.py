import asyncio
import io
import re
import uuid

from docx import Document as DocxDocument
from pypdf import PdfReader
from sqlalchemy import update

from src.core.config import settings
from src.core.database import SessionLocal, engine
from src.core.minio import client as minio_client
from src.core.tracing import annotate_run, trace_span
from src.models import Document
from src.services.rag_service import RAGService
from src.tasks import celery_app
from src.utils.pdf_repair import repair_pdf

try:  # pypdfium2 is fast and permissive; pypdf stays as a fallback.
    import pypdfium2 as _pdfium
except Exception:  # pragma: no cover - optional accelerator
    _pdfium = None

SUPPORTED_TEXT_SUFFIXES = {"txt", "md", "markdown", "csv", "json", "log"}
UNSUPPORTED_IMAGE_SUFFIXES = {
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "tif",
    "tiff",
}


class UnsupportedDocumentError(Exception):
    """Raised when no text extractor exists for the uploaded file type."""


# NUL is the one character PostgreSQL's text/varchar columns cannot store, and
# PDF extractors emit it for unmapped glyphs (ligatures such as "fi"/"fl").
# Other C0 control characters are stripped too because they are extraction
# artefacts; tab/newline/carriage-return are preserved as real whitespace.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _sanitize_text(text: str) -> str:
    """Remove characters a Postgres text column rejects or that are junk."""
    if not text:
        return text
    return _CONTROL_CHARS_RE.sub("", text)


async def _run_and_dispose(coro):
    """Await a coroutine, then release loop-bound pooled connections.

    Celery invokes ``asyncio.run`` once per task, which creates a fresh event
    loop in the same worker process. asyncpg connections in SQLAlchemy's pool
    stay bound to the loop that opened them, so reusing one from the next loop
    raises ``attached to a different loop`` — and that also breaks the failure
    path that is supposed to mark a document ``failed``. Disposing the pool
    before the loop closes keeps every task (and every retry) isolated.
    """
    try:
        return await coro
    finally:
        await engine.dispose()


def run_async(coro):
    """Safely execute async DB operations inside a synchronous Celery worker thread."""
    return asyncio.run(_run_and_dispose(coro))


def _decode_text(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _pdf_pages_with_pypdfium(raw: bytes) -> list[str]:
    """Extract each page's text with pypdfium2 (fast C++ backend)."""
    pdf = _pdfium.PdfDocument(raw)
    try:
        pages: list[str] = []
        for index in range(len(pdf)):
            page = pdf[index]
            textpage = page.get_textpage()
            try:
                # PDFium returns a line-end hyphen as U+FFFE, mirroring Adobe.
                # The ligature repair above removed every other source of it,
                # so mapping it back to "-" restores the original character.
                pages.append(textpage.get_text_range().replace("\ufffe", "-"))
            finally:
                textpage.close()
                page.close()
        return pages
    finally:
        pdf.close()


def _pdf_pages_with_pypdf(raw: bytes) -> list[str]:
    reader = PdfReader(io.BytesIO(raw))
    return [page.extract_text() or "" for page in reader.pages]


def _extract_pdf_pages(raw: bytes) -> list[str]:
    # Subset fonts with broken /ToUnicode maps make both backends drop
    # ligatures ("flames" -> "ames"); repairing once fixes both paths.
    raw = repair_pdf(raw)
    if _pdfium is not None:
        try:
            return _pdf_pages_with_pypdfium(raw)
        except Exception as exc:  # pragma: no cover - depends on the file
            print(f"pypdfium2 extraction failed ({exc}); falling back to pypdf.")
    return _pdf_pages_with_pypdf(raw)


def _extract_docx(raw: bytes) -> str:
    document = DocxDocument(io.BytesIO(raw))
    parts = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def extract_text(
    storage_key: str, raw: bytes
) -> tuple[str, list[tuple[int, str]] | None]:
    """Return ``(text, pages)`` where ``pages`` is set only for PDFs.

    ``pages`` is a list of ``(1-based page number, page text)``. The returned
    text is exactly ``"\\n".join(page_text for _, page_text in pages)`` so the
    chunker can map a chunk's character offset back to its source page.
    """
    suffix = storage_key.lower().rsplit(".", 1)[-1] if "." in storage_key else ""

    if suffix == "pdf":
        page_texts = [_sanitize_text(text) for text in _extract_pdf_pages(raw)]
        pages = [(number, text) for number, text in enumerate(page_texts, start=1)]
        return "\n".join(page_texts), pages
    if suffix == "docx":
        return _sanitize_text(_extract_docx(raw)), None
    if suffix in SUPPORTED_TEXT_SUFFIXES:
        return _sanitize_text(_decode_text(raw)), None
    if suffix in UNSUPPORTED_IMAGE_SUFFIXES:
        raise UnsupportedDocumentError(
            "Image OCR is not configured. Upload a text-based PDF, DOCX or TXT file."
        )
    if suffix == "doc":
        raise UnsupportedDocumentError(
            "Legacy .doc files are not supported. Save the file as .docx or PDF."
        )
    raise UnsupportedDocumentError(
        f"Text extraction is not supported for .{suffix or 'unknown'} files."
    )


async def _process_rag_and_update_status(
    document_id: str,
    status: str,
    extracted_text: str | None = None,
    pages: list[tuple[int, str]] | None = None,
):
    """Save RAG chunks/embeddings and update document status."""
    doc_id = uuid.UUID(document_id)

    async with SessionLocal() as session:
        # 1. Generate & Store RAG embeddings if text exists & status is completed
        if status == "completed" and extracted_text and extracted_text.strip():
            rag_service = RAGService(db_session=session)
            chunks = await rag_service.process_and_store_document(
                document_id=doc_id, text=extracted_text, pages=pages
            )
            if not chunks:
                # Let Celery retry: a completed document with no chunks is
                # invisible to Ask AI, which is worse than a visible failure.
                raise RuntimeError(
                    f"No searchable chunks were produced for document {document_id}"
                )

        # 2. Update document status and extracted content
        values_to_update = {"processing_status": status}
        if extracted_text is not None:
            values_to_update["extracted_content"] = extracted_text

        query = update(Document).where(Document.id == doc_id).values(**values_to_update)
        await session.execute(query)
        await session.commit()


def _process_document(
    self, document_id: str, organization_id: str, storage_key: str, run
):
    try:
        print(f"Processing document {document_id} from MinIO...")

        # 1. Real MinIO Object Verification
        file_stat = minio_client.stat_object(
            bucket_name=settings.MINIO_BUCKET_NAME, object_name=storage_key
        )
        print(f"File verified in MinIO! Size: {file_stat.size} bytes")

        # 2. Fetch once and extract based on the stored file extension.
        response = minio_client.get_object(
            bucket_name=settings.MINIO_BUCKET_NAME, object_name=storage_key
        )
        try:
            raw = response.read()
        finally:
            response.close()
            response.release_conn()

        with trace_span(
            "ingest.extract",
            run_type="tool",
            inputs={"storage_key": storage_key, "bytes": len(raw)},
        ) as extract_run:
            extracted_text, pages = extract_text(storage_key, raw)
            annotate_run(
                metadata={
                    "chars": len(extracted_text),
                    "pages": len(pages) if pages else 0,
                },
                run=extract_run,
            )
        print(f"Extracted {len(extracted_text)} characters from {storage_key}.")

        # Success path: save embeddings & set status completed
        run_async(
            _process_rag_and_update_status(
                document_id, "completed", extracted_text, pages
            )
        )

        annotate_run(metadata={"status": "COMPLETED"}, run=run)
        return {
            "status": "COMPLETED",
            "document_id": document_id,
            "organization_id": organization_id,
        }

    except UnsupportedDocumentError as exc:
        print(f"Unsupported document {document_id}: {exc}")
        run_async(_process_rag_and_update_status(document_id, "failed", None))
        annotate_run(metadata={"status": "FAILED", "reason": str(exc)}, run=run)
        return {
            "status": "FAILED",
            "document_id": document_id,
            "organization_id": organization_id,
            "reason": str(exc),
        }

    except Exception as exc:
        print(f"Processing document error for {document_id}: {str(exc)}")

        if self.request.retries >= self.max_retries - 1:
            print(f"Max retries reached for document {document_id}")
            # Failure path: set status failed
            run_async(_process_rag_and_update_status(document_id, "failed", None))
            annotate_run(metadata={"status": "FAILED", "reason": str(exc)}, run=run)
            raise exc

        annotate_run(metadata={"status": "RETRY", "reason": str(exc)}, run=run)
        raise self.retry(exc=exc, countdown=5)


@celery_app.app.task(
    name="process_document_task", bind=True, max_retries=3, default_retry_delay=5
)
def process_document_task(
    self, document_id: str, organization_id: str, storage_key: str
):
    # A Celery task must keep its exact signature (Celery introspects it to bind
    # arguments), so the root run is opened manually rather than with the
    # ``traceable`` decorator, which would append a ``config`` keyword.
    with trace_span(
        "celery.process_document_task",
        run_type="chain",
        inputs={
            "document_id": document_id,
            "organization_id": organization_id,
            "storage_key": storage_key,
        },
        metadata={
            "task_id": getattr(self.request, "id", None),
            "retries": getattr(self.request, "retries", 0),
        },
    ) as run:
        return _process_document(self, document_id, organization_id, storage_key, run)
