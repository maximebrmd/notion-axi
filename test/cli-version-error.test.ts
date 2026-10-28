import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ""),
}));

import { main } from "../src/cli.js";

describe("readPackageVersion", () => {
  it("throws a clear error when package.json cannot be found", async () => {
    await expect(
      main({ argv: ["--version"], stdout: { write: () => true } }),
    ).rejects.toThrow(/Could not determine notion-axi package version/);
  });

  it("rejects invalid versions and falls back to a valid package manifest", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    for (const version of [42, ""]) {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version }));
      await expect(
        main({ argv: ["--version"], stdout: { write: () => true } }),
      ).rejects.toThrow(/Could not determine/);
    }
    vi.mocked(readFileSync)
      .mockReturnValueOnce("{}")
      .mockReturnValueOnce('{"version":"9.9.9"}');
    let output = "";
    await main({
      argv: ["--version"],
      stdout: {
        write: (text) => {
          output += text;
        },
      },
    });
    expect(output.trim()).toBe("9.9.9");
  });
});
