"""Polite HTTP client for AI Tutor textbook downloading and link discovery.

Enforces:
- robots.txt compliance via urllib.robotparser
- Descriptive User-Agent with project identity and contact info
- Rate limiting (minimum 2.0s between requests, strictly sequential)
- Exponential backoff and Retry-After handling on 429 and 5xx errors
- Terms of service and copyright compliance notice
"""

import os
import time
import email.utils
from urllib.parse import urlparse, urljoin
import urllib.robotparser
from typing import Optional, Dict, Any, Tuple
import httpx


DEFAULT_USER_AGENT = (
    "AI-Tutor-Bot/1.0 (+https://github.com/SivaranjaniSenthil2005/AI_TUTOR; "
    "contact: aitutor-bot@example.com)"
)

DEFAULT_MIN_INTERVAL = 2.0  # seconds between requests (at most 1 req / 2s)
DEFAULT_MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30.0  # seconds


class RobotsDisallowedError(Exception):
    """Raised when robots.txt disallows fetching a URL."""
    pass


class PoliteClient:
    """Sequential, rate-limited HTTP client with robots.txt validation and backoff."""

    def __init__(
        self,
        user_agent: Optional[str] = None,
        min_interval: float = DEFAULT_MIN_INTERVAL,
        max_retries: int = DEFAULT_MAX_RETRIES,
        timeout: float = DEFAULT_TIMEOUT,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        contact = os.environ.get("AI_TUTOR_CONTACT", "aitutor-bot@example.com")
        env_ua = os.environ.get("AI_TUTOR_USER_AGENT")
        if user_agent:
            self.user_agent = user_agent
        elif env_ua:
            self.user_agent = env_ua
        else:
            self.user_agent = f"AI-Tutor-Bot/1.0 (+https://github.com/SivaranjaniSenthil2005/AI_TUTOR; contact: {contact})"

        self.min_interval = min_interval
        self.max_retries = max_retries
        self.timeout = timeout
        self._last_request_time: float = 0.0
        self._robots_cache: Dict[str, Optional[urllib.robotparser.RobotFileParser]] = {}
        self.client = httpx.Client(
            headers={"User-Agent": self.user_agent},
            timeout=self.timeout,
            follow_redirects=True,
            transport=transport,
        )

    @staticmethod
    def print_compliance_notice() -> None:
        """Print standard terms of service compliance notice."""
        notice = (
            "\n"
            "========================================================================\n"
            " AI TUTOR POLITE SCRAPER & DOWNLOADER NOTICE\n"
            " Please verify the target website's Terms of Service and Copyright\n"
            " policies before proceeding. Textbooks are copyrighted by their\n"
            " respective publishers (e.g. NCERT / TN SCERT). You are solely\n"
            " responsible for ensuring legal, fair-use, and educational compliance.\n"
            "========================================================================\n"
        )
        print(notice)

    def is_allowed_by_robots(self, url: str) -> Tuple[bool, str]:
        """Check if URL path is allowed by host robots.txt.
        
        Returns (is_allowed, reason_or_message).
        """
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return True, "Local or relative URL"

        base_host = f"{parsed.scheme}://{parsed.netloc}"

        if base_host not in self._robots_cache:
            robots_url = urljoin(base_host, "/robots.txt")
            rp = urllib.robotparser.RobotFileParser()
            try:
                self._rate_limit()
                resp = self.client.get(robots_url)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
                    self._robots_cache[base_host] = rp
                elif resp.status_code in (404, 410):
                    # No robots.txt means everything is allowed
                    rp.allow_all = True
                    self._robots_cache[base_host] = rp
                else:
                    # Inconclusive or error, default to allow unless 403/401
                    rp.allow_all = True
                    self._robots_cache[base_host] = rp
            except Exception as e:
                # If robots.txt cannot be reached, log warning and allow with fallback
                rp.allow_all = True
                self._robots_cache[base_host] = rp

        rp = self._robots_cache.get(base_host)
        if rp is None:
            return True, "No robots parser available"

        allowed = rp.can_fetch(self.user_agent, url)
        if not allowed:
            return False, (
                f"URL '{url}' is DISALLOWED by {base_host}/robots.txt.\n"
                f"Please download this textbook manually or use the offline HTML fallback mode: "
                f"`discover_links.py --html-file saved_page.html --base-url {base_host}`"
            )
        return True, "Allowed"

    def _rate_limit(self) -> None:
        """Enforce strict sequential rate limit."""
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < self.min_interval:
            sleep_duration = self.min_interval - elapsed
            time.sleep(sleep_duration)
        self._last_request_time = time.time()

    def _calculate_backoff(self, attempt: int, response: Optional[httpx.Response]) -> float:
        """Calculate wait time considering Retry-After header or exponential backoff."""
        if response is not None and "Retry-After" in response.headers:
            retry_header = response.headers["Retry-After"]
            try:
                # Direct integer seconds
                return max(1.0, float(retry_header))
            except ValueError:
                # Date format
                try:
                    date_tuple = email.utils.parsedate_tz(retry_header)
                    if date_tuple:
                        target_ts = email.utils.mktime_tz(date_tuple)
                        delay = target_ts - time.time()
                        return max(1.0, min(delay, 60.0))
                except Exception:
                    pass

        # Exponential backoff: 2.0 * (2 ** attempt)
        return self.min_interval * (2 ** attempt)

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        """Perform a polite GET request respecting robots.txt, rate limits, and retries."""
        allowed, msg = self.is_allowed_by_robots(url)
        if not allowed:
            raise RobotsDisallowedError(msg)

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries):
            self._rate_limit()
            try:
                resp = self.client.get(url, **kwargs)
                if resp.status_code in (429, 500, 502, 503, 504):
                    if attempt < self.max_retries - 1:
                        backoff = self._calculate_backoff(attempt, resp)
                        print(f"[POLITE RETRY] HTTP {resp.status_code} for {url}. Waiting {backoff:.1f}s before retry {attempt + 1}/{self.max_retries}...")
                        time.sleep(backoff)
                        continue
                return resp
            except (httpx.RequestError, httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt < self.max_retries - 1:
                    backoff = self._calculate_backoff(attempt, None)
                    print(f"[POLITE RETRY] Request error '{exc}' for {url}. Waiting {backoff:.1f}s before retry {attempt + 1}/{self.max_retries}...")
                    time.sleep(backoff)
                else:
                    raise last_exc or exc

        return resp

    def stream_download(
        self,
        url: str,
        target_path: str,
        chunk_size: int = 65536,
    ) -> Tuple[int, str, int]:
        """Politely download a file in chunks to target_path (.part temporary file).
        
        Returns (http_status, sha256_hex, bytes_downloaded).
        """
        import hashlib
        from pathlib import Path

        allowed, msg = self.is_allowed_by_robots(url)
        if not allowed:
            raise RobotsDisallowedError(msg)

        out_path = Path(target_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        part_path = out_path.with_suffix(out_path.suffix + ".part")

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries):
            self._rate_limit()
            hasher = hashlib.sha256()
            bytes_downloaded = 0
            try:
                with self.client.stream("GET", url) as response:
                    if response.status_code in (429, 500, 502, 503, 504):
                        if attempt < self.max_retries - 1:
                            backoff = self._calculate_backoff(attempt, response)
                            print(f"[POLITE RETRY] HTTP {response.status_code} for {url}. Waiting {backoff:.1f}s...")
                            time.sleep(backoff)
                            continue
                        response.raise_for_status()

                    response.raise_for_status()
                    with open(part_path, "wb") as f:
                        for chunk in response.iter_bytes(chunk_size=chunk_size):
                            if chunk:
                                f.write(chunk)
                                hasher.update(chunk)
                                bytes_downloaded += len(chunk)

                # Rename .part to target_path on complete success
                if part_path.exists():
                    if out_path.exists():
                        out_path.unlink()
                    part_path.rename(out_path)

                return response.status_code, hasher.hexdigest(), bytes_downloaded

            except Exception as exc:
                last_exc = exc
                if part_path.exists():
                    try:
                        part_path.unlink()
                    except Exception:
                        pass
                if attempt < self.max_retries - 1:
                    backoff = self._calculate_backoff(attempt, None)
                    print(f"[POLITE RETRY] Download error '{exc}' for {url}. Waiting {backoff:.1f}s...")
                    time.sleep(backoff)
                else:
                    raise last_exc or exc

        return 500, "", 0

    def close(self) -> None:
        """Close the underlying httpx client."""
        self.client.close()

    def __enter__(self) -> "PoliteClient":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()
