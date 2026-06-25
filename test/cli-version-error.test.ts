import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: () => false,
  readFileSync: () => "",
}));

import { main } from "../src/cli.js";

describe("readPackageVersion", () => {
  it("throws a clear error when package.json cannot be found", async () => {
    await expect(
      main({ argv: ["--version"], stdout: { write: () => true } }),
    ).rejects.toThrow(/Could not determine notion-axi package version/);
  });
});
