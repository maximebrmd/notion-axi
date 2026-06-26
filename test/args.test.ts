import { describe, expect, it } from "vitest";
import { collectFlag, intFlag, parseArgs, strFlag } from "../src/args.js";

describe("parseArgs", () => {
  it("splits positionals and value flags", () => {
    const { positionals, flags } = parseArgs([
      "roadmap",
      "notes",
      "--limit",
      "5",
    ]);
    expect(positionals).toEqual(["roadmap", "notes"]);
    expect(flags.limit).toBe("5");
  });

  it("supports --flag=value", () => {
    const { flags } = parseArgs(["x", "--type=page"]);
    expect(flags.type).toBe("page");
  });

  it("treats declared booleans as flags that consume nothing", () => {
    const { positionals, flags } = parseArgs(["--full", "page-id"], ["full"]);
    expect(flags.full).toBe(true);
    expect(positionals).toEqual(["page-id"]);
  });

  it("treats a trailing bare flag as boolean", () => {
    const { flags } = parseArgs(["--full"]);
    expect(flags.full).toBe(true);
  });
});

describe("intFlag / strFlag", () => {
  it("parses integers and falls back", () => {
    expect(intFlag("42", 10)).toBe(42);
    expect(intFlag(undefined, 10)).toBe(10);
    expect(intFlag(true, 10)).toBe(10);
    expect(intFlag("nope", 10)).toBe(10);
  });

  it("returns string flags or undefined", () => {
    expect(strFlag("hi")).toBe("hi");
    expect(strFlag(true)).toBeUndefined();
    expect(strFlag(undefined)).toBeUndefined();
  });
});

describe("collectFlag", () => {
  it("collects every occurrence of a repeatable flag", () => {
    expect(
      collectFlag(["--set", "a=1", "--set=b=2", "x", "--set", "c=3"], "set"),
    ).toEqual(["a=1", "b=2", "c=3"]);
    expect(collectFlag(["--other", "z"], "set")).toEqual([]);
  });
});
