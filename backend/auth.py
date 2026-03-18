import logging
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Request
from jwt import PyJWKClient

from config import settings
from models import UserInfo

logger = logging.getLogger(__name__)

_jwk_client: PyJWKClient | None = None


def _get_jwks_uri() -> str:
    issuer = settings.oidc_issuer.rstrip("/")
    if "/oauth2/" in issuer:
        return f"{issuer}/v1/keys"
    return f"{issuer}/oauth2/v1/keys"


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(
            _get_jwks_uri(),
            cache_keys=True,
            ssl_context=None,
            headers={"User-Agent": "push-verifier/1.0"},
        )
    return _jwk_client


def _decode_token(token: str, verify_aud: bool = True) -> dict:
    client = _get_jwk_client()
    signing_key = client.get_signing_key_from_jwt(token)

    valid_audiences = [
        settings.oidc_client_id,
        settings.oidc_issuer.rstrip("/"),
        "api://default",
    ]

    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=valid_audiences if verify_aud else None,
        options={"verify_aud": verify_aud},
    )


def _extract_groups(
    access_claims: dict, id_token: str | None = None
) -> list[str]:
    groups = access_claims.get("groups", [])
    if groups:
        logger.info("Groups from access token: %s", groups)
        return groups

    logger.info("No groups in access token, trying ID token fallback")

    if id_token:
        try:
            id_claims = _decode_token(id_token, verify_aud=False)
            groups = id_claims.get("groups", [])
            logger.info("Groups from ID token: %s", groups)
            return groups
        except Exception as e:
            logger.warning("Failed to decode ID token for group extraction: %s", e)

    logger.warning(
        "No groups found in either token. Ensure 'groups' claim is configured "
        "in your Okta authorization server (Security > API > Claims)"
    )
    return []


def _resolve_role(groups: list[str]) -> str:
    if settings.admin_group in groups:
        return "admin"
    if settings.user_group in groups:
        return "user"
    logger.warning(
        "No matching role for groups %s. Expected admin_group='%s' or user_group='%s'",
        groups, settings.admin_group, settings.user_group,
    )
    return "none"


async def get_current_user(
    request: Request,
    x_id_token: Annotated[str | None, Header()] = None,
) -> UserInfo:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header[7:]

    try:
        claims = _decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning("Token validation failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")

    groups = _extract_groups(claims, x_id_token)
    role = _resolve_role(groups)
    sub = claims.get("sub", "")
    email = claims.get("email") or claims.get("sub")

    return UserInfo(sub=sub, email=email, role=role)


async def require_authenticated(
    user: Annotated[UserInfo, Depends(get_current_user)],
) -> UserInfo:
    if user.role == "none":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


async def require_admin(
    user: Annotated[UserInfo, Depends(get_current_user)],
) -> UserInfo:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
