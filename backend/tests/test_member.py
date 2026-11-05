from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
import uuid

import pytest

from src.services.member import MemberService


@pytest.mark.asyncio
async def test_accept_invitation_locks_invitation_and_organization():
    user_id = uuid.uuid4()
    organization_id = uuid.uuid4()
    role_id = uuid.uuid4()
    invitation = SimpleNamespace(
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        email="invitee@example.com",
        role_id=role_id,
        organization_id=organization_id,
        accepted_at=None,
        accepted_by=None,
    )
    role = SimpleNamespace(id=role_id, name="Member")
    organization = SimpleNamespace(id=organization_id, name="Example")
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[invitation, organization, None])
    db.get = AsyncMock(return_value=role)
    db.commit = AsyncMock()
    db.add = MagicMock()
    user = SimpleNamespace(id=user_id, email="invitee@example.com")

    await MemberService(db).accept_invitation("single-use-token", user)

    statements = [item.args[0] for item in db.scalar.await_args_list]
    assert statements[0]._for_update_arg is not None
    assert statements[1]._for_update_arg is not None
    assert statements[2]._for_update_arg is None
    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    assert invitation.status == "accepted"
    assert invitation.accepted_by == user_id
