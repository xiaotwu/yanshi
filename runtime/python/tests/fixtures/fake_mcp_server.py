"""Minimal stdio MCP server for tests: speaks line-delimited JSON-RPC.

initialize -> protocolVersion + serverInfo; notifications/initialized -> (no reply);
tools/list -> two tools. Run via `python fake_mcp_server.py`; reads stdin lines.
An optional arg "crash" makes it exit immediately (to exercise the failure path).
"""
import json
import sys


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "crash":
        return  # exit immediately: the client sees a closed pipe
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        method = msg.get("method")
        if method == "notifications/initialized":
            continue  # notification: no response
        if method == "initialize":
            reply = {"protocolVersion": "2024-11-05", "serverInfo": {"name": "fake", "version": "0"}, "capabilities": {"tools": {}}}
        elif method == "tools/list":
            reply = {"tools": [{"name": "echo", "description": "Echo text"}, {"name": "add", "description": "Add numbers"}]}
        else:
            reply = {}
        sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg.get("id"), "result": reply}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
