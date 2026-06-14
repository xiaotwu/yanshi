import { Component } from "react";
import type { ReactNode } from "react";

/**
 * Render-error containment. Without a boundary a single render throw unmounts the whole React
 * root — the packaged app turns into a blank white window with no way back (the Atelier
 * white-screen bug). `fallback` receives a retry callback that re-attempts the subtree.
 */
export class ErrorBoundary extends Component<
  { fallback: (retry: () => void, error: Error) => ReactNode; children: ReactNode; onError?: (error: Error) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[yanshi] render error contained by boundary:", error);
    this.props.onError?.(error);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.retry, this.state.error);
    return this.props.children;
  }
}

/** Explicitly release a probe context. WKWebView caps live WebGL contexts and frees them only on
 *  GC — a leaked probe context per call was enough to exhaust the cap and make the Atelier
 *  unopenable until the app was force-quit. */
export function releaseWebglContext(gl: WebGLRenderingContext | null): void {
  try {
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Releasing is best-effort; a failed release just falls back to GC.
  }
}

let webglProbe: boolean | null = null;

/**
 * Real WebGL availability probe — used to show the Atelier fallback instead of crashing.
 * Probed once per session and the probe context is released immediately: creating (and leaking)
 * a context on every call was the root cause of the "Atelier cannot reopen" bug.
 */
export function webglAvailable(): boolean {
  if (webglProbe !== null) return webglProbe;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    releaseWebglContext(gl);
    webglProbe = Boolean(gl);
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}
