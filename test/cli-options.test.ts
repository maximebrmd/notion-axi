import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

describe("main option branches", () => {
  let argv: string[];
  let token: string | undefined;
  let apiKey: string | undefined;

  beforeEach(() => {
    argv = process.argv;
    token = process.env.NOTION_TOKEN;
    apiKey = process.env.NOTION_API_KEY;
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_API_KEY;
  });
  afterEach(() => {
    process.argv = argv;
    if (token !== undefined) process.env.NOTION_TOKEN = token;
    if (apiKey !== undefined) process.env.NOTION_API_KEY = apiKey;
    vi.restoreAllMocks();
  });

  it("reads argv from process.argv when none is passed", async () => {
    process.argv = ["node", "notion-axi", "--version"];
    let out = "";
    await main({ stdout: { write: (c: string) => ((out += c), true) } });
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("writes to process.stdout when no stdout is passed", async () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    await main({ argv: ["--version"] });
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0]![0]).trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
