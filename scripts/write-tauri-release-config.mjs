#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const outRelative = "apps/desktop/src-tauri/tauri.generated-release.conf.json";
const outPath = join(root, outRelative);

function env(name) {
  return (process.env[name] || "").trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const signingIdentity = env("APPLE_SIGNING_IDENTITY");
if (!signingIdentity) {
  fail("APPLE_SIGNING_IDENTITY is required to generate a signed release Tauri config.");
}

const updaterPublicKey = env("YANSHI_UPDATER_PUBLIC_KEY") || env("TAURI_UPDATER_PUBLIC_KEY");
const updaterEndpoint = env("YANSHI_UPDATER_ENDPOINT") || env("TAURI_UPDATER_ENDPOINT");
const updaterPrivateKey = env("TAURI_SIGNING_PRIVATE_KEY");
const updaterPrivateKeyPassword = env("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
const hasUpdaterConfig = Boolean(updaterPublicKey || updaterEndpoint || updaterPrivateKey || updaterPrivateKeyPassword);

const config = {
  bundle: {
    resources: ["resources/yanshi-runtime-sidecar"],
    macOS: {
      signingIdentity,
    },
  },
};

let updaterEnabled = false;
if (hasUpdaterConfig) {
  const missing = [];
  if (!updaterPublicKey) missing.push("YANSHI_UPDATER_PUBLIC_KEY");
  if (!updaterEndpoint) missing.push("YANSHI_UPDATER_ENDPOINT");
  if (!updaterPrivateKey) missing.push("TAURI_SIGNING_PRIVATE_KEY");
  if (missing.length > 0) {
    fail(`Updater release config is incomplete. Missing: ${missing.join(", ")}.`);
  }
  const endpoints = updaterEndpoint
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (endpoints.length === 0) fail("YANSHI_UPDATER_ENDPOINT must contain at least one update feed URL.");
  config.bundle.createUpdaterArtifacts = true;
  config.plugins = {
    updater: {
      pubkey: updaterPublicKey,
      endpoints,
    },
  };
  updaterEnabled = true;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

if (process.env.GITHUB_ENV) {
  writeFileSync(
    process.env.GITHUB_ENV,
    [
      `YANSHI_RELEASE_TAURI_CONFIG=src-tauri/tauri.generated-release.conf.json`,
      `YANSHI_UPDATER_ENABLED=${updaterEnabled ? "true" : "false"}`,
      `VITE_YANSHI_UPDATER_ENABLED=${updaterEnabled ? "true" : "false"}`,
      "",
    ].join("\n"),
    { flag: "a" },
  );
}

console.log(`Wrote ${outRelative}`);
console.log(updaterEnabled ? "Updater artifacts enabled." : "Updater artifacts disabled: no updater feed/key env configured.");
