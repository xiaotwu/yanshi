import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { initCrashReporter } from "./lib/crash-reporter";
import { reportError } from "./lib/errors";
import "./styles.css";

initCrashReporter();

// Root safety net: any uncaught render error shows a recoverable screen instead of a blank
// white window (locale-independent English here — the i18n store may be the thing that broke).
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary
      onError={(error) => reportError("YANSHI_UI_001", error)}
      fallback={(retry) => (
        <div className="app-crash">
          <h2>Something went wrong</h2>
          <p>Yanshi hit an unexpected error. Your chats and data are safe.</p>
          <button onClick={retry}>Reload interface</button>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
