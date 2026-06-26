import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { homeCommand } from "../src/commands/home.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("homeCommand", () => {
  it("returns install guidance when ntn is missing", async () => {
    api.mockRejectedValue(new AxiError("nope", "NTN_NOT_INSTALLED"));
    const out: any = await homeCommand();
    expect(out.status).toContain("not installed");
    expect(out.setup.length).toBe(2);
  });

  it("returns login guidance when not authenticated", async () => {
    api.mockRejectedValue(new AxiError("nope", "AUTH_REQUIRED"));
    const out: any = await homeCommand();
    expect(out.status).toContain("not logged in");
    expect(out.setup.length).toBe(2);
  });

  it("rethrows other errors", async () => {
    api.mockRejectedValue(new AxiError("boom", "OBJECT_NOT_FOUND"));
    await expect(homeCommand()).rejects.toBeInstanceOf(AxiError);
  });

  it("lists recently edited items when authenticated", async () => {
    api.mockResolvedValue({
      results: [
        {
          id: "p1",
          object: "page",
          last_edited_time: "2026-06-20T0:0:0Z",
          properties: { N: { type: "title", title: [{ plain_text: "Pg" }] } },
        },
        {
          id: "d1",
          object: "data_source",
          last_edited_time: "2026-06-19T0:0:0Z",
          title: [{ plain_text: "DB" }],
        },
      ],
    });
    const out: any = await homeCommand();
    expect(out.recent).toEqual([
      { id: "p1", title: "Pg", type: "page", edited: "2026-06-20" },
      { id: "d1", title: "DB", type: "database", edited: "2026-06-19" },
    ]);
    expect(out.count).toBe(2);
  });

  it("gives a definitive empty state when the workspace is empty", async () => {
    api.mockResolvedValue({});
    const out: any = await homeCommand();
    expect(out.recent).toEqual([]);
    expect(out.result).toContain("Nothing in this workspace");
  });
});
