"""
Jira sync service — fetches unresolved issues via the Jira Cloud REST API.

Supports two auth modes:
  - Basic Auth (email + API token) via manual token entry
  - OAuth 2.0 (Bearer token + cloud ID) via Atlassian OAuth popup
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models.integration import IntegrationToken
from app.services import integration_service
from app.services.ai.schemas import SourceType

logger = logging.getLogger(__name__)

JIRA_API_VERSION = "3"
DEFAULT_JIRA_SETTINGS: dict[str, Any] = {
    "jira_instance_url": "",
    "jira_email": "",
    "jira_cloud_id": "",
    "jira_project_key": "",
    "jql_filter": "assignee = currentUser() AND resolution = Unresolved",
    "property_mapping": {
        "summary": "Summary",
        "duedate": "Due Date",
        "priority": "Priority",
    },
    "sync_filters": {
        "ignore_resolved": True,
        "resolved_statuses": ["Done", "Closed", "Resolved"],
        "include_statuses": [],
        "exclude_statuses": [],
    },
    "synced_issue_ids": [],
    "last_synced_at": None,
}


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------


def get_token_entry(
    db: Session,
    user_id: int,
    provider: str = "jira",
) -> IntegrationToken | None:
    return (
        db.query(IntegrationToken)
        .filter(
            IntegrationToken.user_id == user_id,
            IntegrationToken.provider == provider,
        )
        .first()
    )


def get_decoded_token(token: IntegrationToken) -> str:
    return integration_service.decrypt_token(token.access_token_enc)


def _read_settings(token: IntegrationToken) -> dict[str, Any]:
    stored = token.settings_json or {}
    merged: dict[str, Any] = dict(DEFAULT_JIRA_SETTINGS)
    for k in DEFAULT_JIRA_SETTINGS:
        if k in stored:
            if isinstance(DEFAULT_JIRA_SETTINGS[k], dict) and isinstance(stored[k], dict):
                merged[k] = {**DEFAULT_JIRA_SETTINGS[k], **stored[k]}
            else:
                merged[k] = stored[k]
    return merged


# ---------------------------------------------------------------------------
# Jira REST API helpers
# ---------------------------------------------------------------------------


def _auth_headers(
    access_token: str,
    email: str | None = None,
    cloud_id: str | None = None,
) -> dict[str, str]:
    """Return auth headers — Bearer (OAuth) or Basic (API token).

    When ``cloud_id`` is present, OAuth mode is used.
    """
    headers = {"Accept": "application/json"}
    if cloud_id:
        headers["Authorization"] = f"Bearer {access_token}"
    else:
        raw = f"{email or ''}:{access_token}"
        encoded = base64.b64encode(raw.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"
    return headers


def _api_base(
    instance_url: str,
    cloud_id: str | None = None,
) -> str:
    """Return the Jira REST API base URL.

    OAuth mode uses the cloud ID endpoint:
      https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/

    Basic auth mode uses the instance URL directly:
      https://{instance}.atlassian.net/rest/api/3/
    """
    if cloud_id:
        return f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/{JIRA_API_VERSION}"
    return f"{instance_url.rstrip('/')}/rest/api/{JIRA_API_VERSION}"


async def validate_jira_credentials(
    instance_url: str,
    email: str,
    api_token: str,
    cloud_id: str | None = None,
) -> bool:
    """Test credentials by calling ``/rest/api/3/myself``."""
    base = _api_base(instance_url, cloud_id)
    url = f"{base}/myself"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=_auth_headers(api_token, email, cloud_id))
            return resp.status_code == 200
    except httpx.RequestError:
        return False


async def fetch_jira_issues(
    access_token: str,
    jql: str,
    instance_url: str,
    email: str | None = None,
    cloud_id: str | None = None,
    max_results: int = 100,
    last_synced_at: datetime | None = None,
) -> list[dict[str, Any]]:
    """Fetch issues matching the given JQL via ``POST /rest/api/3/search``.

    Supports incremental sync by appending an ``updated >= …`` clause.
    """
    if last_synced_at:
        ts = last_synced_at.isoformat()
        jql = f"{jql} AND updated >= '{ts}'"

    body = {
        "jql": jql,
        "maxResults": max_results,
        "fields": [
            "summary",
            "duedate",
            "priority",
            "status",
            "issuetype",
            "labels",
            "assignee",
            "updated",
            "created",
        ],
        "fieldsByKeys": False,
    }

    base = _api_base(instance_url, cloud_id)
    url = f"{base}/search"
    results: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            resp = await client.post(
                url,
                headers={
                    **_auth_headers(access_token, email, cloud_id),
                    "Content-Type": "application/json",
                },
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            issues = data.get("issues", [])
            results.extend(issues)

            if len(results) >= data.get("total", 0) or not issues:
                break

            body["startAt"] = len(results)

    return results


# ---------------------------------------------------------------------------
# Issue field extractors
# ---------------------------------------------------------------------------


def _extract_issue_data(
    issue: dict[str, Any],
    settings: dict[str, Any],
) -> dict[str, Any] | None:
    """Map a Jira issue's fields to an internal task dict.

    Returns ``None`` when the title cannot be resolved.
    """
    fields = issue.get("fields", {}) or {}
    summary = fields.get("summary", "")

    if not summary:
        logger.info("Skipping Jira issue with empty summary (id=%s)", issue.get("id"))
        return None

    # Deadline
    deadline_str = fields.get("duedate")
    deadline: datetime | None = None
    if deadline_str:
        try:
            dt = datetime.fromisoformat(deadline_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            deadline = dt
        except (ValueError, TypeError):
            pass
    if deadline is None:
        deadline = datetime.now(timezone.utc).replace(tzinfo=timezone.utc) + __import__("datetime").timedelta(days=7)

    # Priority → interest tag
    priority = fields.get("priority", {}) or {}
    priority_name = priority.get("name", "") if isinstance(priority, dict) else ""

    # Labels
    labels = fields.get("labels", []) or []
    label_str = ", ".join(labels) if labels else ""

    # Interest tag from priority or labels
    interest_tag = priority_name or label_str or (fields.get("issuetype", {}) or {}).get("name", "")

    # Status
    status = fields.get("status", {}) or {}
    status_name = status.get("name", "") if isinstance(status, dict) else ""

    return {
        "issue_id": issue.get("id"),
        "issue_key": issue.get("key"),
        "title": summary,
        "deadline": deadline,
        "interest_tag": interest_tag,
        "status": status_name,
    }


def _is_resolved(status_name: str, sync_filters: dict[str, Any]) -> bool:
    """Check if a status name counts as 'resolved'."""
    if not sync_filters.get("ignore_resolved", True):
        return False
    resolved = sync_filters.get("resolved_statuses", ["Done", "Closed", "Resolved"])
    return status_name.strip().lower() in (s.strip().lower() for s in resolved)


def _is_excluded(status_name: str, sync_filters: dict[str, Any]) -> bool:
    """Check if a status is explicitly excluded."""
    excluded = sync_filters.get("exclude_statuses", [])
    return status_name.strip().lower() in (s.strip().lower() for s in excluded)


def _is_included(status_name: str, sync_filters: dict[str, Any]) -> bool:
    """Check if a status passes the include filter (if set)."""
    included = sync_filters.get("include_statuses", [])
    if not included:
        return True
    return status_name.strip().lower() in (s.strip().lower() for s in included)


# ---------------------------------------------------------------------------
# Sync orchestration
# ---------------------------------------------------------------------------


async def sync_jira(
    db: Session,
    user_id: int,
    override_settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Full Jira sync cycle."""
    logger.info("Starting Jira sync for user %d", user_id)

    token = get_token_entry(db, user_id)
    if not token:
        return {"success": False, "error": "Jira integration not found"}

    settings = _read_settings(token)
    if override_settings:
        settings.update(override_settings)

    instance_url = settings.get("jira_instance_url", "")
    cloud_id = settings.get("jira_cloud_id")
    email = settings.get("jira_email", "")
    access_token = get_decoded_token(token)

    if not instance_url and not cloud_id:
        return {"success": False, "error": "Jira instance URL not configured"}

    jql = settings.get("jql_filter", "assignee = currentUser() AND resolution = Unresolved")
    if settings.get("jira_project_key"):
        jql = f"project = {settings['jira_project_key']} AND {jql}"

    sync_filters = settings.get("sync_filters", {})
    synced_ids: set[str] = set(settings.get("synced_issue_ids", []))

    last_synced_raw = settings.get("last_synced_at")
    last_synced_at: datetime | None = None
    if isinstance(last_synced_raw, str):
        try:
            last_synced_at = datetime.fromisoformat(last_synced_raw)
        except (ValueError, TypeError):
            pass

    # Fetch
    try:
        issues = await fetch_jira_issues(
            access_token=access_token,
            jql=jql,
            instance_url=instance_url,
            email=email if not cloud_id else None,
            cloud_id=cloud_id,
            last_synced_at=last_synced_at,
        )
    except httpx.HTTPStatusError as e:
        snippet = e.response.text[:300]
        return {
            "success": False,
            "error": f"Jira API HTTP {e.response.status_code}: {snippet}",
        }
    except httpx.RequestError as e:
        return {"success": False, "error": f"Jira API request failed: {e}"}

    logger.info("Fetched %d Jira issue(s) for user %d", len(issues), user_id)

    # Process
    new_count = 0
    skipped_duplicate = 0
    skipped_resolved = 0
    skipped_excluded = 0
    skipped_no_title = 0
    failed = 0

    for issue in issues:
        issue_id = str(issue.get("id", ""))

        if issue_id in synced_ids:
            skipped_duplicate += 1
            continue

        data = _extract_issue_data(issue, settings)
        if data is None:
            skipped_no_title += 1
            continue

        status_name = data.get("status", "")

        if _is_resolved(status_name, sync_filters):
            skipped_resolved += 1
            continue

        if _is_excluded(status_name, sync_filters):
            skipped_excluded += 1
            continue

        if not _is_included(status_name, sync_filters):
            skipped_excluded += 1
            continue

        # Build raw text
        raw_text = data["title"]
        if data["interest_tag"]:
            raw_text += f" [{data['interest_tag']}]"

        try:
            from app.services.task_service import ingest_from_raw_text

            ingest_from_raw_text(
                db=db,
                user_id=user_id,
                raw_text=raw_text,
                source_type=SourceType.JIRA.value,
                interest_tag_override=data["interest_tag"],
            )
            synced_ids.add(issue_id)
            new_count += 1
            logger.info("Synced Jira issue: %s (%s)", data["title"], data.get("issue_key"))
        except Exception as e:
            logger.warning("Failed to ingest Jira issue %s (%s): %s", issue_id, data["title"], e)
            failed += 1

    # Persist
    settings["last_synced_at"] = datetime.now(timezone.utc).isoformat()
    settings["synced_issue_ids"] = list(synced_ids)
    token.settings_json = settings
    db.commit()

    result: dict[str, Any] = {
        "success": True,
        "issues_fetched": len(issues),
        "new": new_count,
        "skipped_duplicate": skipped_duplicate,
        "skipped_resolved": skipped_resolved,
        "skipped_excluded": skipped_excluded,
        "skipped_no_title": skipped_no_title,
        "failed": failed,
        "synced_at": settings["last_synced_at"],
    }

    logger.info("Jira sync complete for user %d: %s", user_id, result)
    return result
