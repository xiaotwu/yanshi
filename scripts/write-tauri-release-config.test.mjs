import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./write-tauri-release-config.mjs", import.meta.url));

function runConfigWriter(env = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "yanshi-release-config-"));
  const outPath = join(tmp, "tauri.generated-release.conf.json");
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      PATH: process.env.PATH ?? "",
      ...env,
      YANSHI_RELEASE_CONFIG_OUT: outPath,
    },
    encoding: "utf8",
  });
  return {
    result,
    outPath,
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

test("dry-run release config writes an unsigned sidecar-only config", () => {
  const { result, outPath, cleanup } = runConfigWriter({ YANSHI_RELEASE_DRY_RUN: "true" });
  try {
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(readFileSync(outPath, "utf8"));
    assert.deepEqual(config, {
      bundle: {
        resources: ["resources/yanshi-runtime-sidecar"],
      },
    });
    assert.match(result.stdout, /Updater artifacts disabled/);
  } finally {
    cleanup();
  }
});

test("signed release config requires an Apple signing identity", () => {
  const { result, cleanup } = runConfigWriter();
  try {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /APPLE_SIGNING_IDENTITY is required/);
  } finally {
    cleanup();
  }
});

test("complete updater config reads public feed config from env without writing the private key", () => {
  const { result, outPath, cleanup } = runConfigWriter({
    APPLE_SIGNING_IDENTITY: "Developer ID Application: Example Owner (TEAMID12345)",
    YANSHI_UPDATER_PUBLIC_KEY: "public-key-placeholder",
    YANSHI_UPDATER_ENDPOINT: "https://example.test/latest.json https://backup.example.test/latest.json",
    TAURI_SIGNING_PRIVATE_KEY: "private-key-placeholder",
  });
  try {
    assert.equal(result.status, 0, result.stderr);
    const raw = readFileSync(outPath, "utf8");
    assert.doesNotMatch(raw, /private-key-placeholder/);
    const config = JSON.parse(raw);
    assert.equal(config.bundle.macOS.signingIdentity, "Developer ID Application: Example Owner (TEAMID12345)");
    assert.equal(config.bundle.createUpdaterArtifacts, true);
    assert.deepEqual(config.plugins.updater, {
      pubkey: "public-key-placeholder",
      endpoints: ["https://example.test/latest.json", "https://backup.example.test/latest.json"],
    });
  } finally {
    cleanup();
  }
});

test("partial updater config fails loudly", () => {
  const { result, cleanup } = runConfigWriter({
    APPLE_SIGNING_IDENTITY: "Developer ID Application: Example Owner (TEAMID12345)",
    YANSHI_UPDATER_PUBLIC_KEY: "public-key-placeholder",
  });
  try {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Updater release config is incomplete/);
    assert.match(result.stderr, /YANSHI_UPDATER_ENDPOINT/);
    assert.match(result.stderr, /TAURI_SIGNING_PRIVATE_KEY/);
  } finally {
    cleanup();
  }
});
