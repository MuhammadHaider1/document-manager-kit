import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.auth import User
from src.models.organization import Invitation, Membership, Organization
from src.models.rbac import Role
from src.schemas.member import (
    AcceptInvitationResponse,
    InvitationCreate,
    InvitationPreview,
    InvitationResponse,
    MemberResponse,
)

DEFAULT_MEMBER_ROLE_NAME = "Member"
# Invitations may only grant day-to-day roles. Ownership changes stay in the
# dedicated, permission-checked role-assignment endpoint.
ALLOWED_INVITE_ROLES = {"Member", "Viewer", "Contributor", "Reviewer"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _invite_url(token: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/invite/{token}"


class MemberService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Members
    # ------------------------------------------------------------------
    async def list_members(self, org_id: uuid.UUID) -> list[MemberResponse]:
        stmt = (
            select(Membership, User, Role)
            .join(User, Membership.user_id == User.id)
            .outerjoin(Role, Membership.role_id == Role.id)
            .where(Membership.organization_id == org_id)
            .order_by(func.lower(User.full_name).nulls_last(), func.lower(User.email))
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            MemberResponse(
                membership_id=membership.id,
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                role_id=role.id if role else None,
                role_name=role.name if role else None,
                joined_at=membership.created_at,
                is_active=user.is_active,
            )
            for membership, user, role in rows
        ]

    async def remove_member(
        self,
        org_id: uuid.UUID,
        target_user_id: uuid.UUID,
        actor_user_id: uuid.UUID,
    ) -> dict:
        stmt = (
            select(Membership, Role)
            .outerjoin(Role, Membership.role_id == Role.id)
            .where(
                Membership.organization_id == org_id,
                Membership.user_id == target_user_id,
            )
        )
        row = (await self.db.execute(stmt)).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this organization.",
            )

        membership, role = row
        if membership.user_id == actor_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "You cannot remove yourself. Ask another organization "
                    "administrator to make the change."
                ),
            )

        if role and role.name == "Organization Owner":
            owner_count = await self.db.scalar(
                select(func.count())
                .select_from(Membership)
                .join(Role, Membership.role_id == Role.id)
                .where(
                    Membership.organization_id == org_id,
                    Role.name == "Organization Owner",
                )
            )
            if (owner_count or 0) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last organization owner.",
                )

        await self.db.delete(membership)
        await self.db.commit()
        return {
            "message": "Member removed from the organization.",
            "user_id": str(target_user_id),
            "organization_id": str(org_id),
        }

    # ------------------------------------------------------------------
    # Invitations
    # ------------------------------------------------------------------
    async def _get_role(
        self, org_id: uuid.UUID, role_id: uuid.UUID | None, require_invitable: bool
    ) -> Role:
        if role_id:
            role = await self.db.get(Role, role_id)
            if not role or role.organization_id not in (None, org_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role not found in this organization.",
                )
        else:
            result = await self.db.execute(
                select(Role).where(Role.name == DEFAULT_MEMBER_ROLE_NAME)
            )
            role = result.scalars().first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        f"Default role '{DEFAULT_MEMBER_ROLE_NAME}' is missing. "
                        "Run the RBAC seeder."
                    ),
                )

        if require_invitable and role.name not in ALLOWED_INVITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Invitations can only grant Member, Viewer, Contributor or "
                    "Reviewer roles. Use role assignment after the person joins "
                    "to grant administrative access."
                ),
            )
        return role

    async def invite_member(
        self,
        org_id: uuid.UUID,
        payload: InvitationCreate,
        invited_by: User,
    ) -> InvitationResponse:
        email = str(payload.email).strip().lower()
        organization = await self.db.get(Organization, org_id)
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found.",
            )

        role = await self._get_role(org_id, payload.role_id, require_invitable=True)

        existing_user = await self.db.scalar(
            select(User).where(func.lower(User.email) == email)
        )
        if existing_user:
            membership = await self.db.scalar(
                select(Membership).where(
                    Membership.organization_id == org_id,
                    Membership.user_id == existing_user.id,
                )
            )
            if membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This person is already a member of the organization.",
                )

        pending = await self.db.scalar(
            select(Invitation)
            .where(
                Invitation.organization_id == org_id,
                func.lower(Invitation.email) == email,
                Invitation.status == "pending",
            )
            .order_by(Invitation.created_at.desc())
            .limit(1)
        )
        if pending:
            if pending.expires_at <= _now():
                pending.status = "expired"
                await self.db.commit()
            else:
                # Idempotent resend: return the existing live invitation.
                return self._invitation_response(
                    pending, organization, role, invited_by
                )

        invitation = Invitation(
            organization_id=org_id,
            email=email,
            role_id=role.id,
            token=secrets.token_urlsafe(32),
            status="pending",
            invited_by=invited_by.id,
            expires_at=_now() + timedelta(days=settings.INVITATION_EXPIRE_DAYS),
        )
        self.db.add(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)

        return self._invitation_response(invitation, organization, role, invited_by)

    async def list_invitations(self, org_id: uuid.UUID) -> list[InvitationResponse]:
        stmt = (
            select(Invitation, Organization, Role, User)
            .join(Organization, Invitation.organization_id == Organization.id)
            .join(Role, Invitation.role_id == Role.id)
            .outerjoin(User, Invitation.invited_by == User.id)
            .where(
                Invitation.organization_id == org_id,
                Invitation.status == "pending",
            )
            .order_by(Invitation.created_at.desc())
        )
        rows = (await self.db.execute(stmt)).all()

        responses: list[InvitationResponse] = []
        expired_any = False
        for invitation, organization, role, inviter in rows:
            if invitation.expires_at <= _now():
                invitation.status = "expired"
                expired_any = True
                continue
            responses.append(
                self._invitation_response(invitation, organization, role, inviter)
            )

        if expired_any:
            await self.db.commit()
        return responses

    async def revoke_invitation(
        self, org_id: uuid.UUID, invitation_id: uuid.UUID
    ) -> dict:
        invitation = await self.db.scalar(
            select(Invitation).where(
                Invitation.id == invitation_id,
                Invitation.organization_id == org_id,
            )
        )
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found.",
            )
        if invitation.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending invitations can be revoked.",
            )

        invitation.status = "revoked"
        await self.db.commit()
        return {"message": "Invitation revoked.", "id": str(invitation_id)}

    async def preview_invitation(self, token: str) -> InvitationPreview:
        invitation = await self.db.scalar(
            select(Invitation).where(Invitation.token == token)
        )
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found. Ask your administrator for a new link.",
            )

        if invitation.status == "pending" and invitation.expires_at <= _now():
            invitation.status = "expired"
            await self.db.commit()

        if invitation.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail=f"This invitation is {invitation.status} and can no longer be used.",
            )

        organization = await self.db.get(Organization, invitation.organization_id)
        role = await self.db.get(Role, invitation.role_id)
        inviter = (
            await self.db.get(User, invitation.invited_by)
            if invitation.invited_by
            else None
        )

        return InvitationPreview(
            organization_id=invitation.organization_id,
            organization_name=organization.name
            if organization
            else "Unknown organization",
            email=invitation.email,
            role_name=role.name if role else "Member",
            status=invitation.status,
            invited_by_name=inviter.full_name if inviter else None,
            expires_at=invitation.expires_at,
        )

    async def accept_invitation(
        self, token: str, user: User
    ) -> AcceptInvitationResponse:
        invitation = await self.db.scalar(
            select(Invitation).where(Invitation.token == token).with_for_update()
        )
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found. Ask your administrator for a new link.",
            )

        if invitation.status == "pending" and invitation.expires_at <= _now():
            invitation.status = "expired"
            await self.db.commit()

        if invitation.status == "accepted":
            if invitation.accepted_by == user.id:
                # Idempotent: a double-click should not look like a failure.
                organization = await self.db.get(
                    Organization, invitation.organization_id
                )
                role = await self.db.get(Role, invitation.role_id)
                return AcceptInvitationResponse(
                    organization_id=invitation.organization_id,
                    organization_name=(
                        organization.name if organization else "Organization"
                    ),
                    role_id=invitation.role_id,
                    role_name=role.name if role else "Member",
                    message="You already accepted this invitation.",
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This invitation has already been used.",
            )

        if invitation.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail=f"This invitation is {invitation.status} and can no longer be used.",
            )

        if invitation.email.lower() != user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This invitation was sent to {invitation.email}. "
                    "Sign in with that email address to accept it."
                ),
            )

        role = await self.db.get(Role, invitation.role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="The invited role no longer exists. Ask for a new invitation.",
            )

        # Lock the organization before checking for an existing membership. An
        # absent membership row cannot be locked, so this serializes concurrent
        # acceptances (including distinct invites for the same organization).
        organization = await self.db.scalar(
            select(Organization)
            .where(Organization.id == invitation.organization_id)
            .with_for_update()
        )
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The organization no longer exists.",
            )

        existing = await self.db.scalar(
            select(Membership).where(
                Membership.organization_id == invitation.organization_id,
                Membership.user_id == user.id,
            )
        )
        if not existing:
            self.db.add(
                Membership(
                    organization_id=invitation.organization_id,
                    user_id=user.id,
                    role_id=invitation.role_id,
                )
            )

        invitation.status = "accepted"
        invitation.accepted_at = _now()
        invitation.accepted_by = user.id
        await self.db.commit()

        return AcceptInvitationResponse(
            organization_id=organization.id,
            organization_name=organization.name,
            role_id=role.id,
            role_name=role.name,
            message=f"You joined {organization.name} as {role.name}.",
        )

    @staticmethod
    def _invitation_response(
        invitation: Invitation,
        organization: Organization,
        role: Role,
        inviter: User | None,
    ) -> InvitationResponse:
        return InvitationResponse(
            id=invitation.id,
            organization_id=organization.id,
            organization_name=organization.name,
            email=invitation.email,
            role_id=role.id,
            role_name=role.name,
            status=invitation.status,
            invited_by_name=inviter.full_name if inviter else None,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            invite_url=_invite_url(invitation.token),
        )
