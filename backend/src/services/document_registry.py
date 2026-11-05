from html import escape
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.document import Document


class DocumentRegistryService:
    @staticmethod
    async def list_documents(
        db: AsyncSession,
        org_id: uuid.UUID | str,
    ) -> dict[str, Any]:
        organization_id = uuid.UUID(str(org_id))
        query = (
            select(Document)
            .where(
                Document.organization_id == organization_id,
                Document.is_archived.is_(False),
            )
            .options(selectinload(Document.folder))
            .order_by(Document.created_at.desc())
        )
        result = await db.execute(query)
        documents = result.scalars().all()

        statuses = [document.processing_status for document in documents]
        formatted_documents = [
            {
                "title": document.title,
                "status": document.processing_status,
                "folder": document.folder.name if document.folder else "/",
                "created_at": (
                    document.created_at.strftime("%Y-%m-%d %H:%M")
                    if document.created_at
                    else "N/A"
                ),
            }
            for document in documents
        ]

        return {
            "summary": (
                f"Found **{len(documents)}** documents in your workspace "
                f"({statuses.count('completed')} completed, "
                f"{statuses.count('processing')} processing, "
                f"{statuses.count('failed')} failed):"
            ),
            "documents": formatted_documents,
        }

    @staticmethod
    def render_markdown_table(registry_data: dict[str, Any]) -> str:
        documents = registry_data["documents"]
        if not documents:
            return "No documents found in your organization."

        rows = [
            registry_data["summary"],
            "",
            "| Title | Folder | Status | Created Date |",
            "| :--- | :--- | :--- | :--- |",
        ]
        for document in documents:
            cells = [
                escape(str(document[key])).replace("|", r"\|").replace("\n", " ")
                for key in ("title", "folder", "status", "created_at")
            ]
            rows.append(f"| {' | '.join(cells)} |")
        return "\n".join(rows)
