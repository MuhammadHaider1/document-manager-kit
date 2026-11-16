import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID

from src.models.base import Base


class DocumentChunk(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_text = Column(Text, nullable=False)
    # Position of the chunk inside its document, and the source page for PDFs.
    # Both are nullable so older rows (and non-paged formats) stay valid.
    chunk_index = Column(Integer, nullable=True)
    page_number = Column(Integer, nullable=True)
    embedding = Column(
        Vector(384), nullable=True
    )  # Changed from 1536 to 384 dimensions
