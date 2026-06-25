import { describe, expect, it } from "vitest";
import {
  objectTitle,
  propertyValue,
  richTextToPlain,
  shortDate,
  truncate,
} from "../src/format.js";

describe("richTextToPlain", () => {
  it("joins rich text segments", () => {
    expect(
      richTextToPlain([{ plain_text: "Hi" }, { plain_text: " there" }]),
    ).toBe("Hi there");
  });
  it("falls back to text.content and handles non-arrays", () => {
    expect(richTextToPlain([{ text: { content: "x" } }])).toBe("x");
    expect(richTextToPlain(undefined)).toBe("");
  });
});

describe("objectTitle", () => {
  it("reads a data_source title", () => {
    expect(
      objectTitle({ object: "data_source", title: [{ plain_text: "Tasks" }] }),
    ).toBe("Tasks");
  });
  it("reads a page's title property regardless of name", () => {
    const page = {
      object: "page",
      properties: {
        Name: { type: "title", title: [{ plain_text: "Roadmap" }] },
      },
    };
    expect(objectTitle(page)).toBe("Roadmap");
  });
  it("returns (untitled) when empty", () => {
    expect(objectTitle({ object: "page", properties: {} })).toBe("(untitled)");
  });
});

describe("shortDate", () => {
  it("keeps the date portion", () => {
    expect(shortDate("2026-06-25T10:30:00.000Z")).toBe("2026-06-25");
    expect(shortDate(undefined)).toBe("");
  });
});

describe("truncate", () => {
  it("leaves short text untouched", () => {
    expect(truncate("hello", 10)).toEqual({ text: "hello", truncated: false });
  });
  it("truncates and reports the total length", () => {
    const r = truncate("abcdef", 3);
    expect(r.text).toBe("abc");
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(6);
  });
});

describe("propertyValue", () => {
  it("reduces common property types to scalars", () => {
    expect(propertyValue({ type: "select", select: { name: "Active" } })).toBe(
      "Active",
    );
    expect(propertyValue({ type: "number", number: 7 })).toBe(7);
    expect(propertyValue({ type: "checkbox", checkbox: true })).toBe(true);
    expect(
      propertyValue({
        type: "multi_select",
        multi_select: [{ name: "a" }, { name: "b" }],
      }),
    ).toBe("a, b");
    expect(propertyValue({ type: "title", title: [{ plain_text: "T" }] })).toBe(
      "T",
    );
  });
  it("handles missing values", () => {
    expect(propertyValue({ type: "select", select: null })).toBeNull();
    expect(propertyValue(undefined as never)).toBeNull();
  });
});
