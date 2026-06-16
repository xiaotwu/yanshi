import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// Browser dev flow only: the packaged app gets the runtime token from the Tauri shell, but a plain
// `vite dev` page in a browser can't call Tauri commands. So read the token the locally-running
// sidecar wrote to <data_dir>/runtime.token (or YANSHI_API_TOKEN) and expose it as
// VITE_RUNTIME_TOKEN. If the runtime isn't up yet, this resolves empty — restart vite after it is.
function resolveDevRuntimeToken(): string {
  if (process.env.VITE_RUNTIME_TOKEN) return process.env.VITE_RUNTIME_TOKEN;
  if (process.env.YANSHI_API_TOKEN) return process.env.YANSHI_API_TOKEN;
  const dataDir = process.env.YANSHI_DATA_DIR || join(homedir(), ".yanshi");
  try {
    return readFileSync(join(dataDir, "runtime.token"), "utf-8").trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  define: {
    "import.meta.env.VITE_RUNTIME_TOKEN": JSON.stringify(resolveDevRuntimeToken()),
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
