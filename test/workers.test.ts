import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/ntn.js", () => ({ ntnJson: vi.fn(), ntnText: vi.fn() }));
vi.mock("../src/input.js", () => ({ textInput: vi.fn() }));
import { ntnJson, ntnText } from "../src/ntn.js";
import { textInput } from "../src/input.js";
import { workersCommand } from "../src/commands/workers.js";
afterEach(() => vi.resetAllMocks());

describe("Workers inspection and bounded output", () => {
  it("defaults to listing workers with minimal fields and local preview bounds", async () => {
    vi.mocked(ntnJson).mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        id: `w${i}`,
        name: "Worker",
        status: "active",
        type: "code",
        description: "details",
        capabilities: [],
      })),
    );
    const out: any = await workersCommand([]);
    expect(ntnJson).toHaveBeenCalledWith(["workers", "list", "--json"]);
    expect(out.result).toMatchObject({ total: 12, shown: 10 });
    expect(out.result.items[0]).toEqual({
      id: "w0",
      name: "Worker",
      status: "active",
      type: "code",
    });
    const full: any = await workersCommand(["ls", "--limit=1", "--full"]);
    expect(full.result.items).toHaveLength(1);
    expect(full.result.items[0].description).toBe("details");
    const fields: any = await workersCommand([
      "list",
      "--fields",
      "id,description",
      "--limit",
      "2",
    ]);
    expect(fields.result.items[0]).toEqual({
      id: "w0",
      description: "details",
    });
    expect(ntnJson).toHaveBeenLastCalledWith(["workers", "list", "--json"]);
  });

  it("preserves native envelopes, metadata, primitive lists and unfamiliar field names", async () => {
    vi.mocked(ntnJson).mockResolvedValue({
      runs: [{ custom: "value", another: "x" }],
      next_cursor: "cursor",
    });
    expect((await workersCommand(["runs", "ls"])).result).toEqual({
      runs: [{ custom: "value", another: "x" }],
      next_cursor: "cursor",
      runs_total: 1,
      runs_shown: 1,
    });
    vi.mocked(ntnJson).mockResolvedValue(["KEY", null, 3]);
    expect((await workersCommand(["env", "list"])).result.items).toEqual([
      "KEY",
      null,
      3,
    ]);
    vi.mocked(ntnJson).mockResolvedValue(null);
    expect((await workersCommand(["list"])).result).toBeNull();
    vi.mocked(ntnJson).mockResolvedValue("native text");
    expect((await workersCommand(["list"])).result).toBe("native text");
    vi.mocked(ntnJson).mockResolvedValue([]);
    expect((await workersCommand(["list"])).result).toEqual({
      total: 0,
      shown: 0,
      items: [],
    });
  });

  it("forwards worker/config selection and bounds large run logs", async () => {
    vi.mocked(ntnJson).mockResolvedValue({ logs: "x".repeat(7000) });
    const args = [
      "runs",
      "logs",
      "r1",
      "--worker-id",
      "w1",
      "--workers-config-file",
      "prod.workers.json",
    ];
    expect(await workersCommand(args)).toMatchObject({
      command: "workers runs logs",
      truncated: true,
    });
    expect(ntnJson).toHaveBeenCalledWith(["workers", ...args, "--json"]);
    const full: any = await workersCommand([...args, "--full"]);
    expect(full.result.logs).toHaveLength(7000);
    await workersCommand(["view", "w1"]);
    expect(ntnJson).toHaveBeenLastCalledWith([
      "workers",
      "get",
      "w1",
      "--json",
    ]);
  });

  it("disables watch mode without duplicating an explicit no-watch", async () => {
    vi.mocked(ntnJson).mockResolvedValue({});
    await workersCommand(["sync", "status", "contacts"]);
    expect(ntnJson).toHaveBeenLastCalledWith([
      "workers",
      "sync",
      "status",
      "contacts",
      "--no-watch",
      "--json",
    ]);
    await workersCommand(["sync", "status", "--no-watch"]);
    expect(ntnJson).toHaveBeenLastCalledWith([
      "workers",
      "sync",
      "status",
      "--no-watch",
      "--json",
    ]);
  });
});

describe("Workers lifecycle and native command families", () => {
  it("forwards deploy, capabilities, usage, sync, env, database, webhook and OAuth operations", async () => {
    vi.mocked(ntnJson).mockResolvedValue({ ok: true });
    for (const args of [
      ["create", "--name", "Example"],
      ["rename", "New name", "--worker-id", "w"],
      ["deploy", "--local-build", "--no-git"],
      ["capabilities", "list"],
      ["usage", "--all"],
      ["sync", "trigger", "contacts", "--preview", "--context", '{"cursor":1}'],
      ["sync", "pause", "contacts"],
      ["sync", "resume", "contacts"],
      ["sync", "state", "get", "contacts"],
      ["databases", "list"],
      ["webhooks", "list"],
      ["webhooks", "verification", "enable", "key"],
      ["webhooks", "verification", "disable", "key"],
      ["oauth", "start", "key"],
      ["oauth", "token", "key"],
    ]) {
      await workersCommand(args);
      expect(ntnJson).toHaveBeenLastCalledWith(["workers", ...args, "--json"]);
    }
  });

  it("uses native text for commands without JSON support", async () => {
    vi.mocked(ntnText).mockResolvedValue("Updated\n");
    for (const args of [
      ["sync", "state", "reset", "contacts"],
      ["env", "set", "KEY=value"],
      ["env", "unset", "KEY"],
    ]) {
      expect((await workersCommand(args)).result).toBe("Updated\n");
      expect(ntnText).toHaveBeenLastCalledWith(["workers", ...args]);
    }
    expect(ntnJson).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation for deletion, bindings and env transfer", async () => {
    vi.mocked(ntnJson).mockResolvedValue({ ok: true });
    vi.mocked(ntnText).mockResolvedValue("Done");
    for (const args of [
      ["delete", "w1"],
      ["databases", "attach", "key", "ds1"],
      ["databases", "detach", "key"],
      ["env", "pull"],
      ["env", "push"],
    ]) {
      await expect(workersCommand(args)).rejects.toThrow(/explicit --yes/);
      await workersCommand([...args, "--yes"]);
    }
    await expect(
      workersCommand(["delete", "w1", "--yes=false"]),
    ).rejects.toThrow(/explicit --yes/);
    await workersCommand(["rm", "w1", "--yes"]);
    expect(ntnJson).toHaveBeenLastCalledWith([
      "workers",
      "delete",
      "w1",
      "--yes",
      "--json",
    ]);
    expect(ntnText).toHaveBeenLastCalledWith([
      "workers",
      "env",
      "push",
      "--yes",
    ]);
  });

  it("wraps native text output and parses JSON capability results", async () => {
    vi.mocked(ntnText).mockResolvedValue("Created worker project\n");
    expect(
      (await workersCommand(["new", "project", "--no-install", "--no-git"]))
        .result,
    ).toBe("Created worker project\n");
    vi.mocked(ntnText).mockResolvedValue('{"summary":"Done"}');
    expect(
      (
        await workersCommand([
          "exec",
          "summarize",
          "--data",
          '{"text":"Hi"}',
          "--local",
        ])
      ).result,
    ).toEqual({ summary: "Done" });
    await workersCommand(["exec", "ls"]);
    expect(ntnText).toHaveBeenLastCalledWith(["workers", "exec", "ls"]);
    vi.mocked(ntnText).mockResolvedValue("https://example.com/oauth\n");
    expect(
      (await workersCommand(["oauth", "show-redirect-url"])).result,
    ).toContain("https://example.com/oauth");
  });

  it("reads explicit JSON file/stdin input before native execution", async () => {
    vi.mocked(textInput).mockReturnValue('{"text":"Hi"}');
    vi.mocked(ntnText).mockResolvedValue("ok");
    await workersCommand([
      "exec",
      "summarize",
      "--data-file",
      "-",
      "--worker-id",
      "w1",
    ]);
    expect(textInput).toHaveBeenCalledWith({ "data-file": "-" }, "data");
    expect(ntnText).toHaveBeenCalledWith([
      "workers",
      "exec",
      "summarize",
      "--worker-id",
      "w1",
      "--data",
      '{"text":"Hi"}',
    ]);
    vi.mocked(textInput).mockReturnValue("{bad");
    await expect(
      workersCommand(["exec", "summarize", "--data-file=x.json"]),
    ).rejects.toThrow(/Invalid JSON/);
    expect(ntnText).toHaveBeenCalledTimes(1);
  });

  it("rejects conflicting inputs, invalid wrapper flags, interactive and unknown commands", async () => {
    for (const args of [
      ["unknown"],
      ["tui"],
      ["list", "--json"],
      ["list", "--plain"],
      ["exec", "key", "--stream"],
      ["list", "--full=false"],
      ["list", "--limit"],
      ["list", "--fields", "--full"],
      ["list", "--limit", "101"],
      ["list", "--data-file", "x.json"],
      ["exec", "key", "--data-file", "x", "--data", "{}"],
      ["exec", "key", "--data-file", "x", "--data={}"],
      ["exec", "key", "--data-file", "x", "-d", "{}"],
    ])
      await expect(workersCommand(args)).rejects.toThrow();
    expect(ntnJson).not.toHaveBeenCalled();
    expect(ntnText).not.toHaveBeenCalled();
  });
});
