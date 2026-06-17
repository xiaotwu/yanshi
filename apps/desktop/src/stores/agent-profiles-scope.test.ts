/**
 * Task 5: verify that agentProfiles() and createAgentProfile() thread projectId.
 *
 * Strategy: spy on globalThis.fetch and assert the URL it receives contains the
 * expected query param.  Token resolution in the test environment reads env vars
 * only (no Tauri), so it never hits the network — the spy captures exactly the
 * /agent-profiles call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runtimeApi } from "../api/client";

const BASE = "http://127.0.0.1:8765";

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("runtimeApi.agentProfiles — projectId scoping", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /agent-profiles with no query param when projectId is absent", async () => {
    await runtimeApi.agentProfiles();
    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toBe(`${BASE}/agent-profiles`);
  });

  it("calls /agent-profiles?projectId=proj_x when projectId is provided", async () => {
    await runtimeApi.agentProfiles("proj_x");
    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toContain("/agent-profiles");
    expect(url).toContain("projectId=proj_x");
  });

  it("calls /agent-profiles with no query param when projectId is null", async () => {
    await runtimeApi.agentProfiles(null);
    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toBe(`${BASE}/agent-profiles`);
  });
});

describe("runtimeApi.createAgentProfile — projectId scoping", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse({ id: "p1" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /agent-profiles with no query param when projectId is absent", async () => {
    await runtimeApi.createAgentProfile({ name: "Test" });
    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toBe(`${BASE}/agent-profiles`);
  });

  it("POSTs to /agent-profiles?projectId=proj_x when projectId is provided", async () => {
    await runtimeApi.createAgentProfile({ name: "Test" }, "proj_x");
    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toContain("/agent-profiles");
    expect(url).toContain("projectId=proj_x");
  });
});
