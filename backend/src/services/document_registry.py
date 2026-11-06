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
        *,
        status_filter: str | None = None,
        archived: bool = False,
    ) -> dict[str, Any]:
        organization_id = uuid.UUID(str(org_id))
        conditions = [
            Document.organization_id == organization_id,
            Document.is_archived.is_(archived),
        ]
        if status_filter:
            conditions.append(Document.processing_status == status_filter)

        query = (
            select(Document)
            .where(*conditions)
            .options(selectinload(Document.folder))
            .order_by(Document.updated_at.desc())
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

        scope = "archived" if archived else "active"
        noun = "document" if len(documents) == 1 else "documents"
        filter_note = f" with status **{status_filter}**" if status_filter else ""
        return {
            "summary": (
                f"Found **{len(documents)}** {scope} {noun}{filter_note} "
                f"in your workspace ({statuses.count('completed')} completed, "
                f"{statuses.count('processing')} processing, "
                f"{statuses.count('failed')} failed):"
            ),
            "documents": formatted_documents,
        }

    @staticmethod
    def render_markdown_table(registry_data: dict[str, Any]) -> str:
        documents = registry_data["documents"]
        if not documents:
            return registry_data["summary"].removesuffix(":") + "."

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
