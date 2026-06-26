import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { usersCommand } from "../src/commands/users.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("usersCommand", () => {
  it("maps users with name/email fallbacks", async () => {
    api.mockResolvedValue({
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
    });
    const out: any = await usersCommand([]);
    expect(out.users).toEqual([
      { id: "u1", name: "Ann", type: "person", email: "ann@x.co" },
      { id: "u2", name: "(unnamed)", type: "bot", email: "" },
    ]);
    expect(out.count).toBe(2);
  });

  it("gives a definitive empty state", async () => {
    api.mockResolvedValue({ results: [] });
    const out: any = await usersCommand(["--limit", "5"]);
    expect(out.users).toEqual([]);
    expect(out.result).toContain("0 users");
  });
});

describe("users get", () => {
  it("retrieves a single user", async () => {
    api.mockResolvedValue({
      id: "u1",
      name: "Ann",
      type: "person",
      person: { email: "a@b.c" },
    });
    const out: any = await usersCommand(["get", "u1"]);
    expect(out.user).toEqual({
      id: "u1",
      name: "Ann",
      type: "person",
      email: "a@b.c",
    });
  });

  it("requires a user id", async () => {
    await expect(usersCommand(["get"])).rejects.toBeInstanceOf(AxiError);
  });
});
