import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { main } from "../src/cli.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";

const api = vi.mocked(ntnApi);

function capture() {
  let out = "";
  return {
    stdout: { write: (c: string) => ((out += c), true) },
    read: () => out,
  };
}

describe("main", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    api.mockReset();
  });
  afterEach(() => {
    process.exitCode = undefined;
  });

  it("prints the version", async () => {
    const c = capture();
    await main({ argv: ["--version"], stdout: c.stdout });
    expect(c.read().trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows a content-first setup home view when not logged in", async () => {
    api.mockRejectedValue(new AxiError("nope", "AUTH_REQUIRED"));
    const c = capture();
    await main({ argv: [], stdout: c.stdout });
    const out = c.read();
    expect(out).toContain("bin:");
    expect(out).toContain("not logged in to Notion");
  });

  it("returns a structured auth error for data commands when not logged in", async () => {
    api.mockRejectedValue(new AxiError("nope", "AUTH_REQUIRED"));
    const c = capture();
    await main({ argv: ["search", "roadmap"], stdout: c.stdout });
    const out = c.read();
    expect(out).toContain("AUTH_REQUIRED");
    expect(process.exitCode).toBe(1);
  });

  it("reports unknown commands as usage errors", async () => {
    const c = capture();
    await main({ argv: ["frobnicate"], stdout: c.stdout });
    expect(c.read()).toContain("Unknown command");
    expect(process.exitCode).toBe(2);
  });

  it("serves per-command help", async () => {
    const c = capture();
    await main({ argv: ["page", "--help"], stdout: c.stdout });
    expect(c.read()).toContain(
      "notion-axi page <view|create|update|archive|move>",
    );
  });
});
