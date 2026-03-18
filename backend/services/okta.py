import asyncio
import base64
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import jwt

from config import settings
from db import is_protected_user

logger = logging.getLogger(__name__)

for _name in ("httpx", "httpcore"):
    logging.getLogger(_name).setLevel(logging.WARNING)


class OktaService:
    def __init__(self):
        self._access_token: str | None = None
        self._token_expiry: float = 0

    def _build_client_assertion(self) -> str:
        private_key_pem = base64.b64decode(settings.okta_private_key_b64)
        now = int(time.time())

        headers: dict[str, Any] = {"alg": "RS256"}
        if settings.okta_key_id:
            headers["kid"] = settings.okta_key_id

        payload = {
            "iss": settings.okta_client_id,
            "sub": settings.okta_client_id,
            "aud": f"{settings.okta_domain}/oauth2/v1/token",
            "iat": now,
            "exp": now + 300,
        }

        return jwt.encode(payload, private_key_pem, algorithm="RS256", headers=headers)

    async def _ensure_token(self, client: httpx.AsyncClient):
        if self._access_token and time.time() < self._token_expiry:
            return

        logger.info("Fetching Okta service access token...")
        assertion = self._build_client_assertion()
        response = await client.post(
            f"{settings.okta_domain}/oauth2/v1/token",
            data={
                "grant_type": "client_credentials",
                "scope": settings.okta_scopes,
                "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                "client_assertion": assertion,
            },
        )

        if response.status_code != 200:
            body = response.text
            logger.error("Token request failed (%d): %s", response.status_code, body)
            raise RuntimeError(f"Okta token request failed: {response.status_code} — {body}")

        data = response.json()
        self._access_token = data["access_token"]
        self._token_expiry = time.time() + data.get("expires_in", 3600) - 60
        logger.info("Okta service token acquired")

    async def _api_get(self, client: httpx.AsyncClient, path: str) -> httpx.Response:
        await self._ensure_token(client)
        url = f"{settings.okta_domain}{path}"
        logger.info("GET %s", url)
        response = await client.get(
            url,
            headers={"Authorization": f"Bearer {self._access_token}"},
        )
        logger.info("GET %s -> %d", url, response.status_code)
        return response

    async def _api_post(self, client: httpx.AsyncClient, path: str, json: dict | None = None) -> httpx.Response:
        await self._ensure_token(client)
        url = f"{settings.okta_domain}{path}"
        logger.info("POST %s", url)
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {self._access_token}"},
            json=json or {},
        )
        logger.info("POST %s -> %d", url, response.status_code)
        return response

    async def lookup_user(self, client: httpx.AsyncClient, login: str) -> dict | None:
        response = await self._api_get(client, f"/api/v1/users/{login}")
        if response.status_code == 404:
            return None
        if response.status_code == 403:
            raise RuntimeError(
                "Okta API returned 403 Forbidden. Grant the 'okta.users.manage' scope "
                "to your service app: Okta Admin > Applications > [your app] > Okta API Scopes"
            )
        response.raise_for_status()
        return response.json()

    async def get_push_factors(self, client: httpx.AsyncClient, user_id: str) -> list[dict]:
        response = await self._api_get(client, f"/api/v1/users/{user_id}/factors")
        response.raise_for_status()
        factors = response.json()
        logger.info(
            "Factors for user %s: %s",
            user_id,
            [(f.get("factorType"), f.get("provider"), f.get("status")) for f in factors],
        )
        push_factors = [
            f for f in factors
            if f.get("factorType") == "push" and f.get("status") == "ACTIVE"
        ]
        if not push_factors:
            logger.warning(
                "No active push factors. Available factor types: %s. "
                "The user needs Okta Verify Push enrolled and activated.",
                [f.get("factorType") for f in factors],
            )
        return push_factors

    async def _send_push(self, client: httpx.AsyncClient, user_id: str, factor_id: str) -> dict | None:
        response = await self._api_post(
            client, f"/api/v1/users/{user_id}/factors/{factor_id}/verify"
        )
        logger.info("Push verify for factor %s: status=%d body=%s", factor_id, response.status_code, response.text[:500])
        if response.status_code not in (200, 201):
            logger.warning("Push verify failed for factor %s: %s", factor_id, response.status_code)
            return None
        return response.json()

    async def _poll_transaction(
        self, client: httpx.AsyncClient, poll_url: str, timeout: int = 30
    ) -> str:
        deadline = time.time() + timeout
        while time.time() < deadline:
            await self._ensure_token(client)
            response = await client.get(
                poll_url,
                headers={"Authorization": f"Bearer {self._access_token}"},
            )
            if response.status_code != 200:
                return "error"

            data = response.json()
            result = data.get("factorResult", "").upper()

            if result == "SUCCESS":
                return "success"
            if result == "REJECTED":
                return "rejected"
            if result not in ("WAITING", "CHALLENGE"):
                return "error"

            await asyncio.sleep(1)

        return "timeout"

    async def verify_user(self, login: str) -> AsyncGenerator[dict, None]:
        yield {"stage": "locating", "message": f"Looking up user {login}..."}

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                user = await self.lookup_user(client, login)
                if not user:
                    yield {"stage": "error", "message": f"User '{login}' not found", "result": "error"}
                    return

                user_id = user["id"]
                user_email = user.get("profile", {}).get("email", login)

                yield {"stage": "protected_check", "message": "Checking protected status..."}

                if is_protected_user(user_email) or is_protected_user(login):
                    yield {
                        "stage": "error",
                        "message": "This user is protected and cannot be verified via push",
                        "result": "protected",
                    }
                    return

                factors = await self.get_push_factors(client, user_id)
                if not factors:
                    yield {"stage": "error", "message": "No active push factors found", "result": "error"}
                    return

                yield {
                    "stage": "pushing",
                    "message": f"Sending push to {len(factors)} device(s)...",
                    "devices": len(factors),
                }

                transactions = []
                for factor in factors:
                    tx = await self._send_push(client, user_id, factor["id"])
                    if tx:
                        poll_link = tx.get("_links", {}).get("poll", {}).get("href")
                        if poll_link:
                            transactions.append(poll_link)

                if not transactions:
                    yield {"stage": "error", "message": "Failed to send push challenges", "result": "error"}
                    return

                yield {"stage": "polling", "message": "Waiting for response..."}

                poll_tasks = [self._poll_transaction(client, url) for url in transactions]
                results = await asyncio.gather(*poll_tasks)

                if "success" in results:
                    yield {"stage": "success", "message": "User verified successfully", "result": "approved"}
                elif "rejected" in results:
                    yield {"stage": "error", "message": "Push verification was rejected", "result": "rejected"}
                elif "timeout" in results:
                    yield {"stage": "error", "message": "Push verification timed out", "result": "timeout"}
                else:
                    yield {"stage": "error", "message": "Verification failed", "result": "error"}

        except Exception as e:
            logger.exception("Verification failed for %s", login)
            yield {"stage": "error", "message": f"Verification error: {e}", "result": "error"}
