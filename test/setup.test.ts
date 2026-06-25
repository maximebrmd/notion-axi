import { afterEach, describe, expect, it, vi } from "vitest";
import * as sdk from "axi-sdk-js";
import { setupCommand } from "../src/commands/setup.js";
import { AxiError } from "../src/errors.js";

vi.mock("axi-sdk-js", async (orig) => {
  const actual = await orig<typeof import("axi-sdk-js")>();
  return { ...actual, installSessionStartHooks: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

describe("setupCommand", () => {
  it("installs hooks for the notion-axi marker", async () => {
    const out: any = await setupCommand(["hooks"]);
    expect(sdk.installSessionStartHooks).toHaveBeenCalledWith({
      marker: "notion-axi",
      binaryNames: ["notion-axi"],
    });
    expect(out.setup).toContain("installed");
  });

  it("rejects an unknown setup subcommand", async () => {
    await expect(setupCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(setupCommand(["nope"])).rejects.toBeInstanceOf(AxiError);
  });
});
