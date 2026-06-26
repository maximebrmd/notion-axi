import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { pageCommand } from "../src/commands/page.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";
import { apiCall, routeNtn } from "./support.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("page routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    await expect(pageCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(pageCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("page view", () => {
  it("requires an id", async () => {
    await expect(pageCommand(["view"])).rejects.toBeInstanceOf(AxiError);
  });

  it("shows properties (dropping empties) and truncates a long body", async () => {
    const long = "x".repeat(2000);
    routeNtn(api, [
      {
        path: /\/markdown$/,
        res: { markdown: long, truncated: false },
      },
      {
        path: /^v1\/pages\//,
        res: {
          id: "p1",
          url: "https://n/p1",
          last_edited_time: "2026-06-20T0:0:0Z",
          properties: {
            Title: { type: "title", title: [{ plain_text: "Hi" }] },
            Status: { type: "select", select: { name: "Active" } },
            Empty: { type: "rich_text", rich_text: [] },
          },
        },
      },
    ]);
    const out: any = await pageCommand(["view", "p1"]);
    expect(out.page).toEqual({
      id: "p1",
      title: "Hi",
      url: "https://n/p1",
      edited: "2026-06-20",
    });
    expect(out.properties.map((p: any) => p.name)).toEqual(["Title", "Status"]);
    expect(out.body_truncated).toBe(true);
    expect(out.body_chars_shown).toBe(1500);
    expect(out.body_chars_total).toBe(2000);
    expect(out.help[0]).toContain("--full");
  });

  it("returns the whole body with --full and no help", async () => {
    routeNtn(api, [
      { path: /\/markdown$/, res: { markdown: "short", truncated: false } },
      { path: /^v1\/pages\//, res: { id: "p1", properties: {} } },
    ]);
    const out: any = await pageCommand(["view", "p1", "--full"]);
    expect(out.body).toBe("short");
    expect(out.body_truncated).toBeUndefined();
    expect(out.help).toBeUndefined();
  });

  it("handles an empty body and an API-truncated flag", async () => {
    routeNtn(api, [
      { path: /\/markdown$/, res: { markdown: "", truncated: true } },
      { path: /^v1\/pages\//, res: { id: "p1", properties: {} } },
    ]);
    const out: any = await pageCommand(["view", "p1"]);
    expect(out.body).toBe("(no text content)");
    expect(out.body_truncated).toBe(true);
  });
});

describe("page create", () => {
  it("requires --parent and --title", async () => {
    await expect(
      pageCommand(["create", "--title", "t"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      pageCommand(["create", "--parent", "p"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("creates under a page parent and appends content", async () => {
    routeNtn(api, [
      {
        path: "v1/pages",
        method: "POST",
        res: { id: "new1", url: "https://n/new1" },
      },
      { path: /\/markdown$/, method: "PATCH", res: {} },
    ]);
    const out: any = await pageCommand([
      "create",
      "--parent",
      "par1",
      "--title",
      "Notes",
      "--content",
      "# Agenda",
    ]);
    const body: any = apiCall(api, "v1/pages", "POST")?.[1].body;
    expect(body.parent).toEqual({ page_id: "par1" });
    expect(body.properties.title.title[0].text.content).toBe("Notes");
    expect(apiCall(api, /\/markdown$/, "PATCH")).toBeDefined();
    expect(out.created).toBe("new1");
  });

  it("creates a row in a database using its title property", async () => {
    routeNtn(api, [
      {
        path: /^v1\/data_sources\//,
        res: {
          properties: { Task: { type: "title" }, Done: { type: "checkbox" } },
        },
      },
      { path: "v1/pages", method: "POST", res: { id: "row1", url: "u" } },
    ]);
    await pageCommand(["create", "--parent", "ds1", "--title", "Ship", "--db"]);
    const body: any = apiCall(api, "v1/pages", "POST")?.[1].body;
    expect(body.parent).toEqual({ data_source_id: "ds1" });
    expect(body.properties.Task.title[0].text.content).toBe("Ship");
  });

  it("falls back to a 'Name' title property when the schema has none", async () => {
    routeNtn(api, [
      { path: /^v1\/data_sources\//, res: { properties: {} } },
      { path: "v1/pages", method: "POST", res: { id: "row2", url: "u" } },
    ]);
    await pageCommand(["create", "--parent", "ds2", "--title", "X", "--db"]);
    const body: any = apiCall(api, "v1/pages", "POST")?.[1].body;
    expect(body.properties.Name).toBeDefined();
  });
});

describe("page update", () => {
  it("requires an id and an action", async () => {
    await expect(pageCommand(["update"])).rejects.toBeInstanceOf(AxiError);
    await expect(pageCommand(["update", "p1"])).rejects.toBeInstanceOf(
      AxiError,
    );
  });

  it("appends markdown", async () => {
    routeNtn(api, [{ path: /\/markdown$/, method: "PATCH", res: {} }]);
    const out: any = await pageCommand(["update", "p1", "--append", "more"]);
    expect(apiCall(api, /\/markdown$/, "PATCH")?.[1].body).toMatchObject({
      type: "insert_content",
    });
    expect(out.body).toBe("appended");
  });

  it("replaces content", async () => {
    routeNtn(api, [{ path: /\/markdown$/, method: "PATCH", res: {} }]);
    const out: any = await pageCommand(["update", "p1", "--replace", "fresh"]);
    expect(apiCall(api, /\/markdown$/, "PATCH")?.[1].body).toMatchObject({
      type: "replace_content",
    });
    expect(out.body).toBe("replaced");
  });
});

describe("page update/create --set", () => {
  const schema = { Name: { type: "title" }, Stage: { type: "status" } };

  it("create --db --set merges properties from the data-source schema", async () => {
    routeNtn(api, [
      { path: /^v1\/data_sources\//, res: { properties: schema } },
      { path: "v1/pages", method: "POST", res: { id: "n", url: "u" } },
    ]);
    await pageCommand([
      "create",
      "--parent",
      "ds",
      "--title",
      "T",
      "--db",
      "--set",
      "Stage=Open",
    ]);
    const body: any = apiCall(api, "v1/pages", "POST")?.[1].body;
    expect(body.properties.Stage).toEqual({ status: { name: "Open" } });
  });

  it("rejects --set without --db on create", async () => {
    await expect(
      pageCommand([
        "create",
        "--parent",
        "p",
        "--title",
        "T",
        "--set",
        "Stage=Open",
      ]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("update --set retrieves types and patches properties", async () => {
    routeNtn(api, [
      { path: /^v1\/pages\//, method: "GET", res: { properties: schema } },
      { path: /^v1\/pages\//, method: "PATCH", res: {} },
    ]);
    const out: any = await pageCommand(["update", "p1", "--set", "Stage=Done"]);
    expect(apiCall(api, /^v1\/pages\//, "PATCH")?.[1].body).toMatchObject({
      properties: { Stage: { status: { name: "Done" } } },
    });
    expect(out.properties_set).toEqual(["Stage"]);
  });

  it("rejects an unknown property and a malformed --set", async () => {
    routeNtn(api, [
      { path: /^v1\/pages\//, method: "GET", res: { properties: schema } },
    ]);
    await expect(
      pageCommand(["update", "p1", "--set", "Nope=1"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      pageCommand(["update", "p1", "--set", "noequals"]),
    ).rejects.toBeInstanceOf(AxiError);
    routeNtn(api, [{ path: /^v1\/pages\//, method: "GET", res: {} }]);
    await expect(
      pageCommand(["update", "p1", "--set", "Stage=Done"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});

describe("page archive", () => {
  it("archives an active page, then no-ops", async () => {
    routeNtn(api, [
      { path: /^v1\/pages\//, method: "GET", res: {} },
      { path: /^v1\/pages\//, method: "PATCH", res: {} },
    ]);
    const out: any = await pageCommand(["archive", "p1"]);
    expect(apiCall(api, /^v1\/pages\//, "PATCH")?.[1].body).toMatchObject({
      in_trash: true,
    });
    expect(out.result).toBe("archived");

    routeNtn(api, [
      { path: /^v1\/pages\//, method: "GET", res: { in_trash: true } },
    ]);
    expect((await pageCommand(["archive", "p1"])).result).toContain(
      "already archived",
    );
  });

  it("restores a trashed page, then no-ops", async () => {
    routeNtn(api, [
      { path: /^v1\/pages\//, method: "GET", res: { archived: true } },
      { path: /^v1\/pages\//, method: "PATCH", res: {} },
    ]);
    const out: any = await pageCommand(["archive", "p1", "--restore"]);
    expect(apiCall(api, /^v1\/pages\//, "PATCH")?.[1].body).toMatchObject({
      in_trash: false,
    });
    expect(out.result).toBe("restored");

    routeNtn(api, [
      { path: /^v1\/pages\//, method: "GET", res: { in_trash: false } },
    ]);
    expect(
      (await pageCommand(["archive", "p1", "--restore"])).result,
    ).toContain("already active");
  });

  it("requires an id", async () => {
    await expect(pageCommand(["archive"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("page move", () => {
  it("moves under a page parent, or a database with --db", async () => {
    routeNtn(api, [{ path: /\/move$/, method: "POST", res: {} }]);
    await pageCommand(["move", "p1", "--to", "par"]);
    expect(apiCall(api, /\/move$/, "POST")?.[1].body).toEqual({
      parent: { page_id: "par" },
    });

    vi.clearAllMocks();
    routeNtn(api, [{ path: /\/move$/, method: "POST", res: {} }]);
    await pageCommand(["move", "p1", "--to", "ds", "--db"]);
    expect(apiCall(api, /\/move$/, "POST")?.[1].body).toEqual({
      parent: { data_source_id: "ds" },
    });
  });

  it("requires an id and a --to parent", async () => {
    await expect(pageCommand(["move"])).rejects.toBeInstanceOf(AxiError);
    await expect(pageCommand(["move", "p1"])).rejects.toBeInstanceOf(AxiError);
  });
});
