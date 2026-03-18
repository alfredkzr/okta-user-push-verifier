import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from auth import require_authenticated
from db import get_verification_log, write_verification_log
from models import UserInfo, VerifyRequest
from rate_limit import limiter
from services.okta import OktaService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["verify"])


@router.post("/verify")
@limiter.limit("5/minute")
async def verify_user(
    request: Request,
    body: VerifyRequest,
    user: Annotated[UserInfo, Depends(require_authenticated)],
):
    service = OktaService()

    async def event_stream():
        final_status = "error"
        devices = 0

        try:
            async for event in service.verify_user(body.username):
                if event.get("devices"):
                    devices = event["devices"]
                if event.get("result"):
                    final_status = event["result"]

                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.exception("SSE stream error for %s", body.username)
            error_event = {"stage": "error", "message": f"Stream error: {e}", "result": "error"}
            yield f"data: {json.dumps(error_event)}\n\n"

        try:
            write_verification_log(
                operator=user.email or user.sub,
                target=body.username,
                status=final_status,
                devices_challenged=devices,
            )
        except Exception:
            logger.exception("Failed to write verification log")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/verification-log")
async def list_verification_log(
    _user: Annotated[UserInfo, Depends(require_authenticated)],
    limit: int = Query(default=20, le=100),
):
    return get_verification_log(limit)
