from typing import Annotated

from fastapi import APIRouter, Depends

from auth import get_current_user
from config import settings
from models import AuthConfig, UserInfo

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/auth/config")
async def get_auth_config() -> AuthConfig:
    return AuthConfig(issuer=settings.oidc_issuer, clientId=settings.oidc_client_id)


@router.get("/me")
async def get_me(user: Annotated[UserInfo, Depends(get_current_user)]) -> UserInfo:
    """Return user info including role, even if role is 'none'.
    This lets the frontend show the proper access-denied message with the email."""
    return user
