/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YANSHI_UPDATER_ENABLED?: string;
  readonly VITE_YANSHI_CRASH_REPORT_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
