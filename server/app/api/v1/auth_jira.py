"""
Jira (Atlassian) OAuth 2.0 (3LO) flow.

Step 1: GET /auth/jira/url           → returns the Atlassian authorization URL.
Step 2: User authorises              → Atlassian redirects to /auth/jira/callback.
Step 3: Backend exchanges code for a token, discovers the cloud ID, saves
         the integration, and renders success.
"""

from __future__ import annotations

import logging
import secrets
import urllib.parse

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.tasks import get_or_create_default_user
from app.core.config import settings
from app.core.database import get_db
from app.services import integration_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])

ATLASSIAN_AUTH_URI = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URI = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_RESOURCES_URI = "https://api.atlassian.com/oauth/token/accessible-resources"

_oauth_states: dict[str, int] = {}


class OAuthUrlResponse(BaseModel):
    url: str


@router.get("/auth/jira/url", response_model=OAuthUrlResponse)
def get_jira_auth_url(db: Session = Depends(get_db)):
    if not settings.JIRA_CLIENT_ID:
        return OAuthUrlResponse(url="")

    user = get_or_create_default_user(db)
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = user.id

    params = {
        "audience": "api.atlassian.com",
        "client_id": settings.JIRA_CLIENT_ID,
        "scope": "read:jira-user read:jira-work offline_access",
        "redirect_uri": settings.JIRA_OAUTH_REDIRECT_URI,
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    }
    url = f"{ATLASSIAN_AUTH_URI}?{urllib.parse.urlencode(params)}"
    return OAuthUrlResponse(url=url)


@router.get("/auth/jira/callback")
async def handle_jira_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error:
        logger.error("Jira OAuth denied: %s", error)
        return _oauth_html("error", "Authorization denied", f"Atlassian returned: {error}")

    if not code or not state:
        return _oauth_html("error", "Missing parameters", "No authorization code received.")

    user_id = _oauth_states.pop(state, None)
    if user_id is None:
        return _oauth_html("error", "Session expired", "Please try connecting again.")

    if not settings.JIRA_CLIENT_ID or not settings.JIRA_CLIENT_SECRET:
        return _oauth_html("error", "Not configured", "Jira OAuth is not configured on the server.")

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Exchange code for tokens
            resp = await client.post(
                ATLASSIAN_TOKEN_URI,
                auth=(settings.JIRA_CLIENT_ID, settings.JIRA_CLIENT_SECRET),
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.JIRA_OAUTH_REDIRECT_URI,
                },
            )
            token_data = resp.json()

            if "error" in token_data:
                logger.error("Jira token exchange error: %s", token_data["error"])
                return _oauth_html("error", "Token failed", f"Atlassian rejected the code: {token_data['error']}")

            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)

            if not access_token:
                return _oauth_html("error", "No token", "No access token in Atlassian's response.")

            # Step 2: Discover cloud ID
            res_resp = await client.get(
                ATLASSIAN_RESOURCES_URI,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resources = res_resp.json()
            cloud_id = None
            instance_url = ""
            if isinstance(resources, list) and resources:
                cloud_id = resources[0].get("id")
                instance_url = resources[0].get("url", "")

            if not cloud_id:
                logger.warning("No accessible Jira resources found for user %d", user_id)

            integration_service.save_integration_config(
                db=db,
                user_id=user_id,
                provider="jira",
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in_seconds=expires_in,
                settings={
                    "jira_cloud_id": cloud_id or "",
                    "jira_instance_url": instance_url,
                    "jira_email": "",
                    "jira_project_key": "",
                    "jql_filter": "assignee = currentUser() AND resolution = Unresolved",
                    "property_mapping": {
                        "summary": "summary",
                        "duedate": "duedate",
                        "priority": "priority",
                        "status": "status",
                        "labels": "labels",
                    },
                    "sync_filters": {
                        "resolved_filter": True,
                        "exclude_resolution": [],
                        "include_statuses": [],
                        "exclude_statuses": [],
                    },
                },
            )

            logger.info("Jira OAuth connected for user %d (cloud_id=%s)", user_id, cloud_id)
            return _oauth_html("success", "Connected to Jira!", "Configure sync settings to start syncing issues.")

    except Exception as e:
        logger.error("Jira OAuth exception: %s", e)
        return _oauth_html("error", "Connection failed", str(e))


def _oauth_html(kind: str, title: str, message: str) -> HTMLResponse:
    if kind == "success":
        icon = "✅"
        title_color = "#2684ff"
        auto_close = True
    else:
        icon = "❌"
        title_color = "#ef4444"
        auto_close = False

    auto_close_script = '<script>setTimeout(function(){window.close()},1500)</script>' if auto_close else ""

    return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>dopapal-oauth-{kind}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0">
<div style="text-align:center;padding:2rem">
<div style="font-size:3rem;margin-bottom:1rem">{icon}</div>
<h1 style="color:{title_color};margin:0 0 0.5rem">{title}</h1>
<p style="color:#94a3b8">{message}</p>
</div>
{auto_close_script}
</body>
</html>""")
