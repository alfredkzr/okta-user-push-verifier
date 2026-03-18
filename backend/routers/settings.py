from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import require_admin
from db import add_protected_user, get_audit_log, get_protected_users, remove_protected_user
from models import UserInfo, ProtectedUserCreate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/protected-users")
async def list_protected_users(_user: Annotated[UserInfo, Depends(require_admin)]):
    return get_protected_users()


@router.post("/protected-users", status_code=201)
async def create_protected_user(
    body: ProtectedUserCreate,
    user: Annotated[UserInfo, Depends(require_admin)],
):
    added = add_protected_user(body.email, user.email or user.sub)
    if not added:
        raise HTTPException(status_code=409, detail="User already in protected list")
    return {"email": body.email, "status": "added"}


@router.delete("/protected-users/{email}")
async def delete_protected_user(
    email: str,
    user: Annotated[UserInfo, Depends(require_admin)],
):
    removed = remove_protected_user(email, user.email or user.sub)
    if not removed:
        raise HTTPException(status_code=404, detail="User not found in protected list")
    return {"email": email, "status": "removed"}


@router.get("/audit-log")
async def list_audit_log(
    _user: Annotated[UserInfo, Depends(require_admin)],
    limit: int = Query(default=50, le=200),
):
    return get_audit_log(limit)
