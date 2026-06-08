from __future__ import annotations

DEFAULT_AGENT_PROFILES = [
    {
        "id": "agent_manager",
        "name": "Manager Agent",
        "role": "manager",
        "defaultTools": ["plan", "review"],
        "station": "manager",
    },
    {
        "id": "agent_browser",
        "name": "Browser Agent",
        "role": "browser",
        "defaultTools": ["browser", "search"],
        "station": "browser",
    },
    {
        "id": "agent_computer",
        "name": "Computer Agent",
        "role": "computer",
        "defaultTools": ["computer"],
        "station": "computer",
    },
    {
        "id": "agent_file",
        "name": "File Agent",
        "role": "file",
        "defaultTools": ["file"],
        "station": "file",
    },
    {
        "id": "agent_reviewer",
        "name": "Reviewer Agent",
        "role": "reviewer",
        "defaultTools": ["review"],
        "station": "reviewer",
    },
    {
        "id": "agent_terminal",
        "name": "Terminal Agent",
        "role": "terminal",
        "defaultTools": ["terminal", "docker"],
        "station": "terminal",
    },
]
