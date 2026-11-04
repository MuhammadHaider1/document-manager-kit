import asyncio
import io
import uuid

from docx import Document as DocxDocument
from pypdf import PdfReader
from sqlalchemy import update

from src.core.config import settings
from src.core.database import SessionLocal, engine
from src.core.minio import client as minio_client
from src.models import Document
from src.services.rag_service import RAGService
from src.tasks import celery_app

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


def _extract_pdf(raw: bytes) -> str:
    reader = PdfReader(io.BytesIO(raw))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text)
    return "\n".join(pages_text)


def _extract_docx(raw: bytes) -> str:
    document = DocxDocument(io.BytesIO(raw))
    parts = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def extract_text(storage_key: str, raw: bytes) -> str:
    suffix = storage_key.lower().rsplit(".", 1)[-1] if "." in storage_key else ""

    if suffix == "pdf":
        return _extract_pdf(raw)
    if suffix == "docx":
        return _extract_docx(raw)
    if suffix in SUPPORTED_TEXT_SUFFIXES:
        return _decode_text(raw)
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
    document_id: str, status: str, extracted_text: str | None = None
):
    """Save RAG chunks/embeddings and update document status."""
    doc_id = uuid.UUID(document_id)

    async with SessionLocal() as session:
        # 1. Generate & Store RAG embeddings if text exists & status is completed
        if status == "completed" and extracted_text and extracted_text.strip():
            rag_service = RAGService(db_session=session)
            chunks = await rag_service.process_and_store_document(
                document_id=doc_id, text=extracted_text
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


@celery_app.app.task(
    name="process_document_task", bind=True, max_retries=3, default_retry_delay=5
)
def process_document_task(
    self, document_id: str, organization_id: str, storage_key: str
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

        extracted_text = extract_text(storage_key, raw)
        print(f"Extracted {len(extracted_text)} characters from {storage_key}.")

        # Success path: save embeddings & set status completed
        run_async(
            _process_rag_and_update_status(document_id, "completed", extracted_text)
        )

        return {
            "status": "COMPLETED",
            "document_id": document_id,
            "organization_id": organization_id,
        }

    except UnsupportedDocumentError as exc:
        print(f"Unsupported document {document_id}: {exc}")
        run_async(_process_rag_and_update_status(document_id, "failed", None))
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
            raise exc

        raise self.retry(exc=exc, countdown=5)
