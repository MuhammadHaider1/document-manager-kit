import uuid

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import PermissionChecker
from src.core.database import get_db
from src.core.limiter import limiter
from src.core.security import is_authenticated
from src.models.auth import User
from src.schemas.member import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    InvitationCreate,
    InvitationPreview,
    InvitationResponse,
    MemberResponse,
)
from src.services.member import MemberService

router = APIRouter(prefix="/members", tags=["Members"])


# ---------------------------------------------------------------------------
# Organization member directory
# ---------------------------------------------------------------------------
@router.get("", response_model=list[MemberResponse], status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def list_members(
    request: Request,
    x_organization_id: uuid.UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
    _: bool = Depends(PermissionChecker("organization:read")),
):
    service = MemberService(db)
    return await service.list_members(org_id=x_organization_id)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
@limiter.limit("20/minute")
async def remove_member(
    request: Request,
    user_id: uuid.UUID,
    x_organization_id: uuid.UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
    _: bool = Depends(PermissionChecker("members:remove")),
):
    service = MemberService(db)
    return await service.remove_member(
        org_id=x_organization_id,
        target_user_id=user_id,
        actor_user_id=current_user.id,
    )


# ---------------------------------------------------------------------------
# Invitation lifecycle
# ---------------------------------------------------------------------------
@router.get(
    "/invitations/preview/{token}",
    response_model=InvitationPreview,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("30/minute")
async def preview_invitation(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
):
    """Show the invitation to a signed-in invitee before they accept it."""
    service = MemberService(db)
    return await service.preview_invitation(token=token)


@router.post(
    "/invitations/accept",
    response_model=AcceptInvitationResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/minute")
async def accept_invitation(
    request: Request,
    payload: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
):
    """Join the inviting organization with the role chosen by the inviter."""
    service = MemberService(db)
    return await service.accept_invitation(token=payload.token, user=current_user)


@router.get(
    "/invitations",
    response_model=list[InvitationResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("60/minute")
async def list_invitations(
    request: Request,
    x_organization_id: uuid.UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
    _: bool = Depends(PermissionChecker("members:invite")),
):
    service = MemberService(db)
    return await service.list_invitations(org_id=x_organization_id)


@router.post(
    "/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
async def create_invitation(
    request: Request,
    payload: InvitationCreate,
    x_organization_id: uuid.UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
    _: bool = Depends(PermissionChecker("members:invite")),
):
    service = MemberService(db)
    return await service.invite_member(
        org_id=x_organization_id, payload=payload, invited_by=current_user
    )


@router.post(
    "/invitations/{invitation_id}/revoke",
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/minute")
async def revoke_invitation(
    request: Request,
    invitation_id: uuid.UUID,
    x_organization_id: uuid.UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_authenticated),
    _: bool = Depends(PermissionChecker("members:invite")),
):
    service = MemberService(db)
    return await service.revoke_invitation(
        org_id=x_organization_id, invitation_id=invitation_id
    )
