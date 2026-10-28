import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { textInput } from "../src/input.js";
import { checkFlags, limitFlag } from "../src/args.js";
import { boundedOutput } from "../src/output.js";

vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
const originalTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
afterEach(() => {
  vi.clearAllMocks();
  if (originalTTY) Object.defineProperty(process.stdin, "isTTY", originalTTY);
  else delete (process.stdin as any).isTTY;
});

describe("explicit text input", () => {
  it("returns absent/inline/empty content without reading stdin", () => {
    expect(textInput({}, "content")).toBeUndefined();
    expect(textInput({ content: "hello" }, "content")).toBe("hello");
    expect(textInput({ content: "" }, "content")).toBe("");
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("reads files and explicitly requested stdin", () => {
    vi.mocked(readFileSync).mockReturnValue("# Markdown");
    expect(textInput({ "replace-file": "body.md" }, "replace")).toBe(
      "# Markdown",
    );
    expect(readFileSync).toHaveBeenCalledWith("body.md", "utf8");
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    expect(textInput({ "content-file": "-" }, "content")).toBe("# Markdown");
    expect(readFileSync).toHaveBeenCalledWith(0, "utf8");
  });

  it("rejects missing values, conflicts, unreadable files, and an interactive stdin", () => {
    expect(() => textInput({ content: true }, "content")).toThrow(
      /Missing value/,
    );
    expect(() => textInput({ "content-file": true }, "content")).toThrow(
      /Missing value/,
    );
    expect(() =>
      textInput({ content: "", "content-file": "a" }, "content"),
    ).toThrow(/only one/);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(() => textInput({ "content-file": "missing" }, "content")).toThrow(
      /Cannot read file/,
    );
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    expect(() => textInput({ "content-file": "-" }, "content")).toThrow(
      /No piped input/,
    );
  });
});

describe("bounded output and argument validation", () => {
  it("validates limits and unknown flags", () => {
    expect(limitFlag(undefined)).toBe(10);
    expect(limitFlag("25")).toBe(25);
    for (const value of [true, "no", "0", "101", "1.5"]) {
      expect(() => limitFlag(value)).toThrow(/1 to 100/);
    }
    checkFlags({ full: true }, ["full"]);
    expect(() => checkFlags({ typo: true }, ["full"])).toThrow(
      /Unknown flag --typo/,
    );
  });

  it("keeps small objects/text intact and discloses truncation", () => {
    expect(boundedOutput("schema", { a: 1 }, false, "hint")).toEqual({
      schema: { a: 1 },
    });
    expect(boundedOutput("docs", "hello", false, "hint")).toEqual({
      docs: "hello",
    });
    const value = "x".repeat(7000);
    expect(boundedOutput("docs", value, false, "hint")).toMatchObject({
      truncated: true,
      chars_total: 7000,
      help: ["hint"],
    });
    expect(boundedOutput("docs", value, true, "hint")).toEqual({ docs: value });
  });
});
