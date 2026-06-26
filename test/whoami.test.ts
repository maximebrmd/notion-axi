import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { whoamiCommand } from "../src/commands/whoami.js";
import { ntnApi } from "../src/ntn.js";

const api = vi.mocked(ntnApi);
function setMe(me: unknown) {
  api.mockResolvedValue(me as never);
}
afterEach(() => vi.clearAllMocks());

describe("whoamiCommand", () => {
  it("reports a bot (workspace) identity", async () => {
    setMe({
      id: "b1",
      name: "Notion CLI",
      type: "bot",
      bot: { workspace_name: "WS" },
    });
    expect(await whoamiCommand()).toMatchObject({
      id: "b1",
      type: "bot",
      workspace: "WS",
    });
  });

  it("falls back to an empty workspace when the bot has none", async () => {
    setMe({ id: "b2", name: "x", type: "bot" });
    expect((await whoamiCommand()).workspace).toBe("");
  });

  it("reports a person (PAT) identity", async () => {
    setMe({ id: "u1", type: "person", person: { email: "a@b.c" } });
    expect(await whoamiCommand()).toMatchObject({
      id: "u1",
      type: "person",
      email: "a@b.c",
      token: "personal access token",
    });
  });

  it("falls back to an empty email when the person has none", async () => {
    setMe({ id: "u2", type: "person" });
    expect((await whoamiCommand()).email).toBe("");
  });
});
