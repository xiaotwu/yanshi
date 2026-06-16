// Single safe entry point for opening external/native URLs from the UI. Validates the scheme
// against an allowlist and always uses noopener,noreferrer so the opened page can't reach back into
// the app via window.opener or leak a referrer. Malformed or disallowed URLs are ignored.
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function safeOpenExternal(url: string): void {
  try {
    const parsed = new URL(url, window.location.href);
    if (!SAFE_SCHEMES.has(parsed.protocol)) return;
    window.open(parsed.href, "_blank", "noopener,noreferrer");
  } catch {
    // Ignore malformed URLs rather than throwing into a click handler.
  }
}
