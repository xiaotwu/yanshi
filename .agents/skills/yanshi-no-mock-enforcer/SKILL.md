---
name: yanshi-no-mock-enforcer
description: Use this skill whenever implementing or reviewing features to prevent mock, fake, placeholder, demo-only, or scaffold-only behavior.
---

# Yanshi No-Mock Enforcer

No user-facing mock features are allowed.

Allowed:
- Test fixtures inside tests
- Static assets for default visual packs
- Clear not-configured states
- Permission-required states
- External dependency missing states

Not allowed:
- Fake successful agent runs
- Fake browser results
- Fake computer control
- Fake file edits
- Fake terminal output
- Fake provider health
- Fake Workshop install success
- Fake event streaming
- Coming soon buttons in core flows

If a real feature cannot complete because of missing permission, Docker, API key, or OS entitlement:
- implement the real path
- detect the missing requirement
- show exact required action
- do not pretend it succeeded
