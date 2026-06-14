from __future__ import annotations

import json
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path("/Users/xiaotwu/Code/yanshi")
REG_DIR = ROOT / "qa/codex-final-product-audit/regression-2026-06-09_21-57-56_PDT"
LOGS = REG_DIR / "LOGS"
FIXTURES = REG_DIR / "workshop-fixtures"
BASE = "http://127.0.0.1:8765"

LOGS.mkdir(parents=True, exist_ok=True)
FIXTURES.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True), encoding="utf-8")


def run_curl(args: list[str], *, output: Path | None = None) -> tuple[int, str, str]:
    cmd = ["curl", "-sS", *args]
    if output is not None:
      cmd.extend(["-o", str(output)])
    proc = subprocess.run(cmd, text=True, capture_output=True, check=False)
    return proc.returncode, proc.stdout, proc.stderr


def create_fixtures() -> dict[str, Path]:
    valid = FIXTURES / "valid-pack.zip"
    traversal = FIXTURES / "traversal-pack.zip"
    executable = FIXTURES / "executable-pack.zip"
    symlink = FIXTURES / "symlink-pack.zip"

    manifest = {
        "name": "Regression Pack",
        "version": "1.0.0",
        "author": "Codex QA",
        "contentTypes": ["agents", "themes"],
        "suggestedPermissions": [],
    }
    with zipfile.ZipFile(valid, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("agents/manager.json", json.dumps({"id": "manager", "name": "Manager"}))
        archive.writestr("themes/office.json", json.dumps({"name": "QA Theme"}))

    with zipfile.ZipFile(traversal, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest | {"name": "Traversal Pack"}))
        archive.writestr("../evil.txt", "nope")

    with zipfile.ZipFile(executable, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest | {"name": "Executable Pack"}))
        archive.writestr("agents/setup.sh", "#!/bin/sh\necho nope\n")

    symlink_info = zipfile.ZipInfo("agents/link")
    symlink_info.create_system = 3
    symlink_info.external_attr = (stat.S_IFLNK | 0o777) << 16
    with zipfile.ZipFile(symlink, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest | {"name": "Symlink Pack"}))
        archive.writestr(symlink_info, "target")

    return {
        "valid": valid,
        "traversal": traversal,
        "executable": executable,
        "symlink": symlink,
    }


def request_json(name: str, args: list[str], *, expect_ok: bool) -> dict:
    rc, stdout, stderr = run_curl(args)
    (LOGS / f"{name}.stdout").write_text(stdout, encoding="utf-8")
    (LOGS / f"{name}.stderr").write_text(stderr, encoding="utf-8")
    result = {"returncode": rc, "stdout": stdout, "stderr": stderr}
    write_json(LOGS / f"{name}.json", result)
    if expect_ok and rc != 0:
        raise AssertionError(f"{name} failed: {stderr or stdout}")
    return result


def main() -> int:
    fixtures = create_fixtures()

    valid_validate = request_json(
        "20-workshop-valid-validate",
        ["-F", f"pack=@{fixtures['valid']}", f"{BASE}/workshop/validate"],
        expect_ok=True,
    )
    valid_payload = json.loads(valid_validate["stdout"])
    if valid_payload.get("ok") is not True:
        raise AssertionError(f"valid pack did not validate: {valid_payload}")

    valid_import = request_json(
        "21-workshop-valid-import",
        ["-F", f"pack=@{fixtures['valid']}", f"{BASE}/workshop/import"],
        expect_ok=True,
    )
    pack = json.loads(valid_import["stdout"])
    pack_id = pack["id"]

    disabled = request_json(
        "22-workshop-disable-pack",
        ["-X", "PUT", "-H", "Content-Type: application/json", "-d", '{"enabled":false}', f"{BASE}/workshop/packs/{pack_id}/enabled"],
        expect_ok=True,
    )
    if json.loads(disabled["stdout"]).get("enabled") is not False:
        raise AssertionError("pack did not disable")

    enabled = request_json(
        "23-workshop-enable-pack",
        ["-X", "PUT", "-H", "Content-Type: application/json", "-d", '{"enabled":true}', f"{BASE}/workshop/packs/{pack_id}/enabled"],
        expect_ok=True,
    )
    if json.loads(enabled["stdout"]).get("enabled") is not True:
        raise AssertionError("pack did not enable")

    export_zip = FIXTURES / "exported-pack.zip"
    rc, stdout, stderr = run_curl(["-X", "POST", f"{BASE}/workshop/export"], output=export_zip)
    write_json(LOGS / "24-workshop-export.json", {"returncode": rc, "stdout": stdout, "stderr": stderr, "bytes": export_zip.stat().st_size if export_zip.exists() else 0})
    if rc != 0 or not export_zip.exists() or export_zip.stat().st_size == 0:
        raise AssertionError(f"export failed: {stderr or stdout}")

    export_validate = request_json(
        "25-workshop-export-validate",
        ["-F", f"pack=@{export_zip}", f"{BASE}/workshop/validate"],
        expect_ok=True,
    )
    if json.loads(export_validate["stdout"]).get("ok") is not True:
        raise AssertionError("exported pack did not validate")

    export_import = request_json(
        "26-workshop-export-reimport",
        ["-F", f"pack=@{export_zip}", f"{BASE}/workshop/import"],
        expect_ok=True,
    )
    json.loads(export_import["stdout"])

    unsafe_summary: dict[str, object] = {}
    for label in ("traversal", "executable", "symlink"):
        validate = request_json(
            f"27-workshop-{label}-validate",
            ["-F", f"pack=@{fixtures[label]}", f"{BASE}/workshop/validate"],
            expect_ok=True,
        )
        payload = json.loads(validate["stdout"])
        unsafe_summary[label] = payload
        if payload.get("ok") is not False or not payload.get("errors"):
            raise AssertionError(f"{label} pack was not rejected by validate: {payload}")

        rc, stdout, stderr = run_curl(["-F", f"pack=@{fixtures[label]}", f"{BASE}/workshop/import"])
        body = json.loads(stdout)
        write_json(LOGS / f"28-workshop-{label}-import-reject.json", {"returncode": rc, "stdout": stdout, "stderr": stderr, "body": body})
        if "detail" not in body:
            raise AssertionError(f"{label} pack import unexpectedly succeeded: {body}")

    write_json(LOGS / "29-workshop-regression-summary.json", {"status": "PASS", "unsafe": unsafe_summary, "validPackId": pack_id})
    print("PASS workshop regression")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
