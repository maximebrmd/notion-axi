import { afterEach, describe, expect, it, vi } from "vitest";
import { commentsCommand } from "../src/commands/comments.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

function setClient(client: Record<string, unknown>) {
  vi.mocked(notion.getClient).mockReturnValue(client as never);
}

afterEach(() => vi.clearAllMocks());

describe("comments routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    setClient({});
    await expect(commentsCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(commentsCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("comments list", () => {
  it("lists comments with author fallbacks", async () => {
    setClient({
      comments: {
        list: vi.fn().mockResolvedValue({
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
        }),
      },
    });
    const out: any = await commentsCommand(["list", "p1"]);
    expect(out.comments[0]).toEqual({
      id: "c1",
      author: "Ann",
      created: "2026-06-20",
      text: "hi",
    });
    expect(out.comments[1].author).toBe("u2"); // name absent → id
    expect(out.comments[2].author).toBe(""); // no created_by → ""
  });

  it("gives a definitive empty state", async () => {
    setClient({ comments: { list: vi.fn().mockResolvedValue({}) } });
    expect((await commentsCommand(["list", "p1"])).result).toContain(
      "0 comments",
    );
  });

  it("requires an id", async () => {
    setClient({});
    await expect(commentsCommand(["list"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("comments add", () => {
  it("adds a comment to a page", async () => {
    const create = vi.fn().mockResolvedValue({ id: "c9" });
    setClient({ comments: { create } });
    const out: any = await commentsCommand(["add", "p1", "looks", "good"]);
    expect(create.mock.calls[0][0].parent).toEqual({ page_id: "p1" });
    expect(create.mock.calls[0][0].rich_text[0].text.content).toBe(
      "looks good",
    );
    expect(out.added).toBe("c9");
  });

  it("requires an id and text", async () => {
    setClient({});
    await expect(commentsCommand(["add", "p1"])).rejects.toBeInstanceOf(
      AxiError,
    );
    await expect(commentsCommand(["add"])).rejects.toBeInstanceOf(AxiError);
  });
});
