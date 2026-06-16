from __future__ import annotations

import importlib.util
import re
from pathlib import Path
from typing import Any, Callable

from yanshi_runtime.models import ToolResult
from yanshi_runtime.net_guard import BlockedHostError, validate_outbound_url


URL_RE = re.compile(r"https?://[^\s)>\]}\"']+", re.IGNORECASE)


class BrowserTool:
    def __init__(self, playwright_loader: Callable[[], tuple[Any, type[Exception], type[Exception]]] | None = None) -> None:
        self._playwright_loader = playwright_loader or self._load_playwright

    def status(self) -> ToolResult:
        if importlib.util.find_spec("playwright") is None:
            return ToolResult(
                ok=False,
                summary="Browser Use needs Playwright installed.",
                missingRequirement="playwright_python",
                structuredOutput={
                    "install": [
                        "uv sync --project runtime/python --extra browser",
                        "uv run --project runtime/python playwright install chromium",
                    ]
                },
            )
        return ToolResult(ok=True, summary="Browser Use is installed.", structuredOutput={"provider": "playwright"})

    def open_from_task(self, task: str, *, output_dir: Path | None = None, timeout_ms: int = 12_000) -> ToolResult:
        url = self.extract_url(task)
        if url is None:
            return ToolResult(
                ok=False,
                summary="Browser Agent needs an http(s) URL to navigate.",
                missingRequirement="browser_url",
                structuredOutput={"acceptedSchemes": ["http", "https"]},
            )
        return self.open_url(url, output_dir=output_dir, timeout_ms=timeout_ms)

    def open_url(self, url: str, *, output_dir: Path | None = None, timeout_ms: int = 12_000) -> ToolResult:
        if not url.lower().startswith(("http://", "https://")):
            return ToolResult(
                ok=False,
                summary="Browser Agent only navigates http(s) URLs.",
                missingRequirement="browser_url",
                structuredOutput={"url": url, "acceptedSchemes": ["http", "https"]},
            )
        # SSRF guard: refuse to navigate to internal/loopback/metadata targets. The browser tool
        # has no local-browsing requirement, so private space is blocked outright.
        try:
            validate_outbound_url(url, block_private=True)
        except BlockedHostError as exc:
            return ToolResult(
                ok=False,
                summary=f"Browser Agent refused an internal or unsafe URL: {exc}",
                missingRequirement="browser_url_blocked",
                structuredOutput={"url": url},
            )

        try:
            sync_playwright, playwright_error, playwright_timeout_error = self._playwright_loader()
        except ModuleNotFoundError:
            return self.status()

        screenshot_path: Path | None = None
        browser = None
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                context = browser.new_context()
                page = context.new_page()
                response = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                title = page.title()
                try:
                    body_text = page.locator("body").inner_text(timeout=3_000)
                except playwright_error:
                    body_text = ""
                if output_dir is not None:
                    output_dir.mkdir(parents=True, exist_ok=True)
                    screenshot_path = output_dir / "browser-snapshot.png"
                    page.screenshot(path=str(screenshot_path), full_page=True)
                final_url = page.url
                browser.close()
                browser = None
        except playwright_timeout_error:
            return ToolResult(
                ok=False,
                summary=f"Browser Agent timed out navigating {url}.",
                missingRequirement="browser_navigation_timeout",
                structuredOutput={"url": url, "timeoutMs": timeout_ms},
            )
        except playwright_error as exc:
            message = str(exc)
            missing = "playwright_browser_binaries" if self._looks_like_missing_browser(message) else "browser_navigation_failed"
            summary = (
                "Browser Use needs Chromium browser binaries installed."
                if missing == "playwright_browser_binaries"
                else f"Browser Agent could not navigate {url}."
            )
            return ToolResult(
                ok=False,
                summary=summary,
                missingRequirement=missing,
                structuredOutput={
                    "url": url,
                    "error": message[-1200:],
                    "install": "uv run --project runtime/python playwright install chromium",
                },
            )
        finally:
            if browser is not None:
                browser.close()

        status = response.status if response is not None else None
        text_snippet = body_text.strip().replace("\u0000", "")[:4000]
        return ToolResult(
            ok=True,
            summary=f"Browser Agent loaded {title or final_url}.",
            structuredOutput={
                "requestedUrl": url,
                "url": final_url,
                "title": title,
                "status": status,
                "textSnippet": text_snippet,
                "screenshotPath": str(screenshot_path) if screenshot_path else None,
            },
        )

    def extract_url(self, task: str) -> str | None:
        match = URL_RE.search(task)
        if match is None:
            return None
        return match.group(0).rstrip(".,;:")

    def _load_playwright(self) -> tuple[Any, type[Exception], type[Exception]]:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright

        return sync_playwright, PlaywrightError, PlaywrightTimeoutError

    def _looks_like_missing_browser(self, message: str) -> bool:
        lowered = message.lower()
        return "playwright install" in lowered or "executable doesn't exist" in lowered or "browserType.launch" in message
