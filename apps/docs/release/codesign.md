# Codesign and Notarization

::: danger Status — Blocked by external requirement <Badge type="danger" text="Requires Apple Developer ID" />
The current build is **not codesigned or notarized**. It is functionally self-contained (the
runtime launches with no external Python), but a second machine will show a Gatekeeper warning
until signing and notarization are completed. This is the only thing blocking a public release.
:::

## Why it's pending

No Apple Developer ID Application certificate is available in the build environment, so the
distributable is unsigned/un-notarized.

## What's needed for public distribution

1. An **Apple Developer ID Application** certificate.
2. **Codesign** the `.app` (and the bundled sidecar binary) with hardened runtime.
3. **Notarize** the build with Apple and **staple** the ticket.
4. **Gatekeeper verification** on a second Mac (clean machine, no developer tools).

## Running the unsigned build locally

Until then, open the unsigned build by right-clicking → **Open**, or clear quarantine:

```bash
xattr -dr com.apple.quarantine Yanshi.app
```

See [Installation](/getting-started/installation) and the repository's `docs/BUILD_AND_RELEASE.md`
for the authoritative steps.
