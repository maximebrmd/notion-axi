import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { commentsCommand } from "../src/commands/comments.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";
import { apiCall } from "./support.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("comments routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    await expect(commentsCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(commentsCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("comments list", () => {
  it("lists comments with author fallbacks", async () => {
    api.mockResolvedValue({
      results: [
        {
          id: "c1",
          created_by: { name: "Ann" },
          created_time: "2026-06-20T0:0:0Z",
          rich_text: [{ plain_text: "hi" }],
        },
        {
          id: "c2",
          created_by: { id: "u2" },
          created_time: "2026-06-19T0:0:0Z",
          rich_text: [],
        },
        { id: "c3", created_time: "2026-06-18T0:0:0Z", rich_text: [] },
      ],
    });
    const out: any = await commentsCommand(["list", "p1"]);
    expect(out.comments[0]).toEqual({
      id: "c1",
      author: "Ann",
      created: "2026-06-20",
      text: "hi",
    });
    expect(out.comments[1].author).toBe("u2");
    expect(out.comments[2].author).toBe("");
  });

  it("surfaces has_more and suggests raising the cap", async () => {
    api.mockResolvedValue({
      results: [{ id: "c1", created_time: "2026-06-20T0:0:0Z", rich_text: [] }],
      has_more: true,
    });
    const out: any = await commentsCommand(["list", "p1", "--limit", "1"]);
    expect(apiCall(api, "v1/comments", "GET")?.[1].query).toMatchObject({
      block_id: "p1",
      page_size: 1,
    });
    expect(out.has_more).toBe(true);
    expect(out.help).toContain("Raise the cap with `--limit <n>` for more");
  });

  it("gives a definitive empty state", async () => {
    api.mockResolvedValue({});
    expect((await commentsCommand(["list", "p1"])).result).toContain(
      "0 comments",
    );
  });

  it("requires an id", async () => {
    await expect(commentsCommand(["list"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("comments add", () => {
  it("adds a comment to a page", async () => {
    api.mockResolvedValue({ id: "c9" });
    const out: any = await commentsCommand(["add", "p1", "looks", "good"]);
    const body: any = apiCall(api, "v1/comments", "POST")?.[1].body;
    expect(body.parent).toEqual({ page_id: "p1" });
    expect(body.rich_text[0].text.content).toBe("looks good");
    expect(out.added).toBe("c9");
  });

  it("requires an id and text", async () => {
    await expect(commentsCommand(["add", "p1"])).rejects.toBeInstanceOf(
      AxiError,
    );
    await expect(commentsCommand(["add"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("comments delete", () => {
  it("deletes a comment", async () => {
    api.mockResolvedValue({});
    const out: any = await commentsCommand(["delete", "c1"]);
    expect(apiCall(api, "v1/comments/c1", "DELETE")).toBeDefined();
    expect(out.deleted).toBe("c1");
  });

  it("requires a comment id", async () => {
    await expect(commentsCommand(["delete"])).rejects.toBeInstanceOf(AxiError);
  });
});
