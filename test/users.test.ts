import { afterEach, describe, expect, it, vi } from "vitest";
import { usersCommand } from "../src/commands/users.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

describe("usersCommand", () => {
  it("maps users with name/email fallbacks", async () => {
    vi.mocked(notion.getClient).mockReturnValue({
      users: {
        list: vi.fn().mockResolvedValue({
          results: [
            {
              id: "u1",
              name: "Ann",
              type: "person",
              person: { email: "ann@x.co" },
            },
            { id: "u2", type: "bot" },
          ],
          has_more: false,
        }),
      },
    } as never);
    const out: any = await usersCommand([]);
    expect(out.users).toEqual([
      { id: "u1", name: "Ann", type: "person", email: "ann@x.co" },
      { id: "u2", name: "(unnamed)", type: "bot", email: "" },
    ]);
    expect(out.count).toBe(2);
  });

  it("gives a definitive empty state", async () => {
    vi.mocked(notion.getClient).mockReturnValue({
      users: { list: vi.fn().mockResolvedValue({ results: [] }) },
    } as never);
    const out: any = await usersCommand(["--limit", "5"]);
    expect(out.users).toEqual([]);
    expect(out.result).toContain("0 users");
  });
});

describe("users get", () => {
  it("retrieves a single user", async () => {
    vi.mocked(notion.getClient).mockReturnValue({
      users: {
        retrieve: vi.fn().mockResolvedValue({
          id: "u1",
          name: "Ann",
          type: "person",
          person: { email: "a@b.c" },
        }),
      },
    } as never);
    const out: any = await usersCommand(["get", "u1"]);
    expect(out.user).toEqual({
      id: "u1",
      name: "Ann",
      type: "person",
      email: "a@b.c",
    });
  });

  it("requires a user id", async () => {
    vi.mocked(notion.getClient).mockReturnValue({} as never);
    await expect(usersCommand(["get"])).rejects.toBeInstanceOf(AxiError);
  });
});
