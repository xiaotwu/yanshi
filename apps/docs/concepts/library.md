# Library and Files

The **Library** is the user-facing home for files and generated outputs across every chat and
project. It replaces the old technical "Runs" page.

## What it shows

- **Real file names and paths** — e.g. `latest-file-scan.json`, not a generic "File scan" label.
  An output's artifact title appears only as secondary context, never as the primary name.
- **Grouping** by Project → chat, plus a Standalone section. Groups collapse, and the collapsed
  state persists across sessions.
- **Web sources** — outputs that came from the web show a "Web" chip linking to the source URL.
- **Sorting** by newest, oldest, name, size, or type; plus a search filter.

## Actions

- **Open / Reveal in Finder** (desktop) and **Copy path**.
- **Show source chat** — jump from a file back to the chat that produced it.

Deletion is not offered because the runtime has no artifact/file delete API — Yanshi does not show
actions it cannot actually perform.

## Right Progress panel

During a chat, the right panel's **Files** section lists generated outputs with their real names
and a path line, plus a Web-source link when available. The same honest naming is used everywhere.

## Where files live

Each project has a sandboxed workspace folder; uploads are copied in with a traversal-safe path and
become scannable by the File agent. See [Tools and Permissions](/concepts/tools-permissions).
