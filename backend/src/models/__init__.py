# src/models/__init__.py
# ``Base`` must be the declarative base the model modules below actually use,
# otherwise ``Base.metadata`` is empty and ``create_all`` silently creates
# nothing. Importing it here also pulls every model module in, which registers
# the tables on that same metadata.
from src.models.base import Base
from src.models.audit import AuditLog
from src.models.auth import RefreshToken, User
from src.models.chunks import DocumentChunk
from src.models.comment import Comment
from src.models.document import Document, DocumentVersion, Folder
from src.models.notification import Notification
from src.models.organization import Invitation, Membership, Organization
from src.models.rbac import Permission, Role, RolePermission

__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "Document",
    "DocumentVersion",
    "Folder",
    "Organization",
    "Membership",
    "Invitation",
    "Role",
    "Permission",
    "RolePermission",
    "AuditLog",
    "Notification",
    "Comment",
    "DocumentChunk",
]
