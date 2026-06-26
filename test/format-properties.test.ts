import { describe, expect, it } from "vitest";
import {
  buildPropertySchema,
  buildPropertyValue,
  objectTitle,
  propertyValue,
  richTextToPlain,
} from "../src/format.js";
import { AxiError } from "../src/errors.js";

describe("propertyValue — every property type", () => {
  it("text-like types", () => {
    expect(propertyValue({ type: "title", title: [{ plain_text: "T" }] })).toBe(
      "T",
    );
    expect(
      propertyValue({ type: "rich_text", rich_text: [{ plain_text: "rt" }] }),
    ).toBe("rt");
  });

  it("number", () => {
    expect(propertyValue({ type: "number", number: 7 })).toBe(7);
    expect(propertyValue({ type: "number", number: null })).toBeNull();
  });

  it("select / status / multi_select", () => {
    expect(propertyValue({ type: "select", select: { name: "A" } })).toBe("A");
    expect(propertyValue({ type: "select", select: null })).toBeNull();
    expect(propertyValue({ type: "status", status: { name: "Open" } })).toBe(
      "Open",
    );
    expect(propertyValue({ type: "status", status: null })).toBeNull();
    expect(
      propertyValue({
        type: "multi_select",
        multi_select: [{ name: "x" }, { name: "y" }],
      }),
    ).toBe("x, y");
  });

  it("people", () => {
    expect(
      propertyValue({
        type: "people",
        people: [{ name: "Ann" }, { id: "u2" }],
      }),
    ).toBe("Ann, u2");
  });

  it("date — range, single, and empty", () => {
    expect(
      propertyValue({
        type: "date",
        date: { start: "2026-01-01", end: "2026-02-01" },
      }),
    ).toBe("2026-01-01 → 2026-02-01");
    expect(
      propertyValue({ type: "date", date: { start: "2026-01-01", end: null } }),
    ).toBe("2026-01-01");
    expect(propertyValue({ type: "date", date: null })).toBeNull();
  });

  it("checkbox — true, false, and missing", () => {
    expect(propertyValue({ type: "checkbox", checkbox: true })).toBe(true);
    expect(propertyValue({ type: "checkbox", checkbox: false })).toBe(false);
    expect(propertyValue({ type: "checkbox" })).toBe(false);
  });

  it("url / email / phone_number", () => {
    expect(propertyValue({ type: "url", url: "https://x" })).toBe("https://x");
    expect(propertyValue({ type: "url", url: null })).toBeNull();
    expect(propertyValue({ type: "email", email: "a@b.c" })).toBe("a@b.c");
    expect(propertyValue({ type: "email", email: null })).toBeNull();
    expect(propertyValue({ type: "phone_number", phone_number: "123" })).toBe(
      "123",
    );
    expect(
      propertyValue({ type: "phone_number", phone_number: null }),
    ).toBeNull();
  });

  it("formula", () => {
    expect(
      propertyValue({
        type: "formula",
        formula: { type: "number", number: 42 },
      }),
    ).toBe(42);
    expect(
      propertyValue({
        type: "formula",
        formula: { type: "string", string: null },
      }),
    ).toBeNull();
  });

  it("relation — counts items", () => {
    expect(
      propertyValue({ type: "relation", relation: [{ id: "a" }, { id: "b" }] }),
    ).toBe(2);
    expect(propertyValue({ type: "relation" })).toBe(0);
  });

  it("rollup — number then type fallback", () => {
    expect(
      propertyValue({ type: "rollup", rollup: { type: "number", number: 5 } }),
    ).toBe(5);
    expect(propertyValue({ type: "rollup", rollup: { type: "array" } })).toBe(
      "array",
    );
  });

  it("time and user metadata", () => {
    expect(
      propertyValue({
        type: "created_time",
        created_time: "2026-06-25T10:00:00Z",
      }),
    ).toBe("2026-06-25");
    expect(
      propertyValue({
        type: "last_edited_time",
        last_edited_time: "2026-06-24T10:00:00Z",
      }),
    ).toBe("2026-06-24");
    expect(
      propertyValue({ type: "created_by", created_by: { name: "Bo" } }),
    ).toBe("Bo");
    expect(
      propertyValue({ type: "created_by", created_by: { id: "u1" } }),
    ).toBe("u1");
    expect(
      propertyValue({ type: "last_edited_by", last_edited_by: { name: "Ed" } }),
    ).toBe("Ed");
    expect(
      propertyValue({ type: "last_edited_by", last_edited_by: { id: "u9" } }),
    ).toBe("u9");
  });

  it("files — counts", () => {
    expect(propertyValue({ type: "files", files: [{}, {}, {}] })).toBe(3);
    expect(propertyValue({ type: "files" })).toBe(0);
  });

  it("unknown type and null prop", () => {
    expect(propertyValue({ type: "mystery" })).toBe("mystery");
    expect(propertyValue(undefined as never)).toBeNull();
    expect(propertyValue({} as never)).toBeNull();
  });
});

describe("objectTitle / richTextToPlain edges", () => {
  it("database object title and untitled fallbacks", () => {
    expect(
      objectTitle({ object: "database", title: [{ plain_text: "DB" }] }),
    ).toBe("DB");
    expect(objectTitle({ object: "data_source", title: [] })).toBe(
      "(untitled)",
    );
    expect(objectTitle(null as never)).toBe("(untitled)");
    expect(objectTitle({ object: "page" })).toBe("(untitled)");
    expect(
      objectTitle({
        object: "page",
        properties: { Name: { type: "title", title: [] } },
      }),
    ).toBe("(untitled)");
  });

  it("richTextToPlain ignores empty segments", () => {
    expect(richTextToPlain([{}, { plain_text: "x" }])).toBe("x");
    expect(richTextToPlain("nope" as never)).toBe("");
  });
});

describe("buildPropertyValue", () => {
  it("builds each settable type", () => {
    expect(buildPropertyValue("title", "T")).toEqual({
      title: [{ text: { content: "T" } }],
    });
    expect(buildPropertyValue("rich_text", "x")).toEqual({
      rich_text: [{ text: { content: "x" } }],
    });
    expect(buildPropertyValue("number", "7")).toEqual({ number: 7 });
    expect(buildPropertyValue("select", "A")).toEqual({
      select: { name: "A" },
    });
    expect(buildPropertyValue("status", "Done")).toEqual({
      status: { name: "Done" },
    });
    expect(buildPropertyValue("multi_select", "a, b ,c")).toEqual({
      multi_select: [{ name: "a" }, { name: "b" }, { name: "c" }],
    });
    expect(buildPropertyValue("date", "2026-07-01")).toEqual({
      date: { start: "2026-07-01" },
    });
    expect(buildPropertyValue("date", "2026-07-01..2026-07-05")).toEqual({
      date: { start: "2026-07-01", end: "2026-07-05" },
    });
    expect(buildPropertyValue("checkbox", "done")).toEqual({ checkbox: true });
    expect(buildPropertyValue("checkbox", "no")).toEqual({ checkbox: false });
    expect(buildPropertyValue("url", "u")).toEqual({ url: "u" });
    expect(buildPropertyValue("email", "a@b.c")).toEqual({ email: "a@b.c" });
    expect(buildPropertyValue("phone_number", "1")).toEqual({
      phone_number: "1",
    });
    expect(buildPropertyValue("people", "u1,u2")).toEqual({
      people: [{ id: "u1" }, { id: "u2" }],
    });
    expect(buildPropertyValue("relation", "p1")).toEqual({
      relation: [{ id: "p1" }],
    });
  });

  it("rejects a non-number and read-only types", () => {
    expect(() => buildPropertyValue("number", "abc")).toThrow(AxiError);
    expect(() => buildPropertyValue("formula", "x")).toThrow(AxiError);
  });
});

describe("buildPropertySchema", () => {
  it("builds settable property type configs", () => {
    expect(buildPropertySchema("status")).toEqual({ status: {} });
    expect(buildPropertySchema("select")).toEqual({ select: {} });
    expect(buildPropertySchema("title")).toEqual({ title: {} });
    expect(buildPropertySchema("date")).toEqual({ date: {} });
  });
  it("rejects computed/read-only types", () => {
    expect(() => buildPropertySchema("formula")).toThrow(AxiError);
    expect(() => buildPropertySchema("rollup")).toThrow(AxiError);
  });
});
