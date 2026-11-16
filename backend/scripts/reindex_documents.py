"""Re-chunk and re-embed documents that already have extracted text.

Run from the ``backend/`` directory with the virtualenv active::

    .venv/bin/python -m scripts.reindex_documents
    .venv/bin/python -m scripts.reindex_documents --org <organization-uuid>
    .venv/bin/python -m scripts.reindex_documents --document <document-uuid>

Use this after changing the chunker or embedding settings. It is idempotent:
``process_and_store_document`` replaces each document's chunks atomically, so a
re-run never leaves duplicates behind.

Note: the stored ``extracted_content`` has no page boundaries, so re-indexed
chunks get ``page_number = NULL``. Re-upload the file if you need page
citations.
"""

import argparse
import asyncio
import re
import uuid

from sqlalchemy import select

from src.core.database import SessionLocal, engine
from src.core.tracing import setup_tracing
from src.models.document import Document
from src.services.rag_service import RAGService

# Stored text written before extraction sanitised NUL bytes may still contain
# them; PostgreSQL rejects NUL in text columns, so scrub before re-embedding.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


async def reindex(
    org_id: uuid.UUID | None = None,
    document_id: uuid.UUID | None = None,
) -> int:
    setup_tracing()

    async with SessionLocal() as session:
        statement = select(Document).where(Document.extracted_content.isnot(None))
        if org_id is not None:
            statement = statement.where(Document.organization_id == org_id)
        if document_id is not None:
            statement = statement.where(Document.id == document_id)

        result = await session.execute(statement)
        documents = list(result.scalars().all())
        print(f"Re-indexing {len(documents)} document(s)...")

        service = RAGService(db_session=session)
        total_chunks = 0
        failures = 0
        for document in documents:
            text = _CONTROL_CHARS_RE.sub("", document.extracted_content or "").strip()
            if not text:
                continue
            try:
                chunks = await service.process_and_store_document(document.id, text)
            except Exception as exc:  # keep going; one bad file must not stop the run
                failures += 1
                print(f"  [fail] {document.id} ({document.title}): {exc}")
                continue
            total_chunks += len(chunks)
            print(f"  [ok]   {document.id} ({document.title}): {len(chunks)} chunks")

        processed = len(documents) - failures
        print(
            f"Done. {total_chunks} chunks across {processed} document(s); "
            f"{failures} failure(s)."
        )

    await engine.dispose()
    return failures


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--org",
        help="Only re-index documents in this organization (UUID).",
    )
    parser.add_argument(
        "--document",
        help="Only re-index this single document (UUID).",
    )
    args = parser.parse_args()

    org_id = uuid.UUID(args.org) if args.org else None
    document_id = uuid.UUID(args.document) if args.document else None
    asyncio.run(reindex(org_id, document_id))


if __name__ == "__main__":
    main()
