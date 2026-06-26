import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

function capture() {
  let out = "";
  return {
    stdout: { write: (c: string) => ((out += c), true) },
    read: () => out,
  };
}

describe("main", () => {
  let token: string | undefined;
  let apiKey: string | undefined;

  beforeEach(() => {
    token = process.env.NOTION_TOKEN;
    apiKey = process.env.NOTION_API_KEY;
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_API_KEY;
    process.exitCode = undefined;
  });
  afterEach(() => {
    if (token !== undefined) process.env.NOTION_TOKEN = token;
    if (apiKey !== undefined) process.env.NOTION_API_KEY = apiKey;
    process.exitCode = undefined;
  });

  it("prints the version", async () => {
    const c = capture();
    await main({ argv: ["--version"], stdout: c.stdout });
    expect(c.read().trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows a content-first setup home view when NOTION_TOKEN is missing", async () => {
    const c = capture();
    await main({ argv: [], stdout: c.stdout });
    const out = c.read();
    expect(out).toContain("bin:");
    expect(out).toContain("NOTION_TOKEN is not set");
  });

  it("returns a structured auth error for data commands without a token", async () => {
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
