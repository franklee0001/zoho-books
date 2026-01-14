import json
import os
import time
from typing import Dict, Generator, Iterable, Optional, Tuple

import requests
from dotenv import load_dotenv

from zoho_auth import refresh_access_token

load_dotenv()

class ZohoClient:
    def __init__(
        self,
        api_domain: Optional[str] = None,
        org_id: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 5,
        backoff_base: float = 1.0,
        backoff_max: float = 60.0,
    ) -> None:
        self.api_domain = (api_domain or os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com")).rstrip("/")
        self.org_id = org_id or os.getenv("ZOHO_ORG_ID")
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.backoff_max = backoff_max
        self.session = requests.Session()
        self.access_token = refresh_access_token()

        if not self.org_id:
            raise RuntimeError("Missing env var: ZOHO_ORG_ID")

    def _auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Zoho-oauthtoken {self.access_token}",
            "X-com-zoho-invoice-organizationid": str(self.org_id),
        }

    def _sleep_with_backoff(self, attempt: int, retry_after: Optional[str] = None) -> None:
        if retry_after:
            try:
                delay = max(1, int(retry_after))
            except ValueError:
                delay = None
        else:
            delay = None

        if delay is None:
            delay = min(self.backoff_max, self.backoff_base * (2 ** attempt))

        time.sleep(delay)

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, object]] = None,
        json_body: Optional[Dict[str, object]] = None,
        max_retries: Optional[int] = None,
    ) -> Dict[str, object]:
        url = f"{self.api_domain}{path}"
        headers = self._auth_headers()

        retry_on_token = True
        retries = self.max_retries if max_retries is None else max_retries
        for attempt in range(retries + 1):
            try:
                resp = self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_body,
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                if attempt >= retries:
                    raise RuntimeError(f"Request failed after retries: {exc}") from exc
                self._sleep_with_backoff(attempt)
                continue

            if resp.status_code == 401 or (
                resp.status_code == 400 and "invalid_token" in resp.text.lower()
            ):
                if retry_on_token:
                    self.access_token = refresh_access_token()
                    headers = self._auth_headers()
                    retry_on_token = False
                    continue
                raise RuntimeError(f"Unauthorized after token refresh: {resp.text}")

            if resp.status_code == 429:
                if attempt >= retries:
                    raise RuntimeError(f"Rate limited after retries: {resp.text}")
                self._sleep_with_backoff(attempt, resp.headers.get("Retry-After"))
                continue

            if 500 <= resp.status_code <= 599:
                if attempt >= retries:
                    raise RuntimeError(f"Server error after retries: {resp.text}")
                self._sleep_with_backoff(attempt)
                continue

            if resp.status_code < 200 or resp.status_code >= 300:
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")

            try:
                return resp.json()
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"Non-JSON response: {resp.text}") from exc

        raise RuntimeError("Request failed after retries.")

    def get_paginated(
        self,
        path: str,
        params: Optional[Dict[str, object]],
        list_key: str,
        page_context_key: str = "page_context",
        per_page: int = 200,
    ) -> Generator[Tuple[int, Iterable[Dict[str, object]]], None, None]:
        page = 1
        base_params = dict(params or {})
        base_params.setdefault("per_page", per_page)

        while True:
            page_params = dict(base_params)
            page_params["page"] = page
            payload = self.request("GET", path, params=page_params)

            items = payload.get(list_key, [])
            page_context = payload.get(page_context_key, {})
            has_more = bool(page_context.get("has_more_page"))

            yield page, items

            if not has_more:
                break
            page += 1
