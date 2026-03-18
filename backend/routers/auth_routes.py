from typing import Annotated

from fastapi import APIRouter, Depends

from auth import require_authenticated
from config import settings
from models import AuthConfig, UserInfo

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/auth/config")
async def get_auth_config() -> AuthConfig:
    return AuthConfig(issuer=settings.oidc_issuer, clientId=settings.oidc_client_id)


@router.get("/me")
async def get_me(user: Annotated[UserInfo, Depends(require_authenticated)]) -> UserInfo:
    return user
