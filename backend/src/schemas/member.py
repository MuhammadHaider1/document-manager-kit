import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class MemberResponse(BaseModel):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    email: EmailStr
    full_name: Optional[str] = None
    role_id: Optional[uuid.UUID] = None
    role_name: Optional[str] = None
    joined_at: datetime
    is_active: bool


class InvitationCreate(BaseModel):
    email: EmailStr
    role_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Role to grant on acceptance. Defaults to the Member role.",
    )


class InvitationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    email: EmailStr
    role_id: uuid.UUID
    role_name: str
    status: str
    invited_by_name: Optional[str] = None
    expires_at: datetime
    created_at: datetime
    invite_url: str


class InvitationPreview(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    email: EmailStr
    role_name: str
    status: str
    invited_by_name: Optional[str] = None
    expires_at: datetime


class AcceptInvitationRequest(BaseModel):
    token: str = Field(..., min_length=8, max_length=128)


class AcceptInvitationResponse(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    role_id: uuid.UUID
    role_name: str
    message: str
