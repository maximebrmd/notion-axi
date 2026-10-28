import { limitFlag, listFlag } from "../args.js";
import { usage } from "../errors.js";
import type { Obj } from "../format.js";
import { textInput } from "../input.js";
import { ntnJson, ntnText } from "../ntn.js";
import { boundedOutput } from "../output.js";

export const WORKERS_HELP = `usage: notion-axi workers [subcommand] [args] [flags]

commands (native ntn Workers syntax):
  list                                  List workers (default; alias ls)
  view|get [worker-id]                   Inspect a worker
  create --name <name>                   Create without deploying
  rename <name> [--worker-id <id>]        Rename a worker
  delete [worker-id] --yes               Delete a worker (alias rm)
  new [directory]                       Scaffold a local worker project
  deploy [--name <name>] [--local-build] [--no-git]
  exec <key> [--data <json> | --data-file <path|->] [--local]
  capabilities list                     Inspect deployed capabilities
  runs list [worker-id]                  Recent runs
  runs logs <run-id> [--worker-id <id>]   Inspect run logs
  usage [worker-id] [--all]              Current credit usage
  sync status [key]                      Print once and exit
  sync trigger <key> [--preview] [--context <json>] [--local]
  sync pause|resume <key>
  sync state get|reset <key>
  env list|set <KEY=VALUE>...|unset <key>
  env pull|push [--file <path>] --yes
  databases list [worker-id]
  databases attach <key> <database> --yes
  databases detach [key] [--data-source <id>] --yes
  webhooks list [worker-id]
  webhooks verification enable|disable <key>
  oauth start|token <key>
  oauth show-redirect-url

flags:
  --workers-config-file <path>   Select a project/workspace through ntn
  --worker-id <id>               Where supported by the native command
  --full                        Complete fields/text (list size still bounded)
  --fields <a,b>                 Select list item fields
  --limit <1..100>               Local list preview size (default 10)

Other native flags are forwarded to ntn, which validates them. Commands run
without interactive stdin. Delete, database attach/detach and env pull/push
require an explicit --yes; it is never added automatically. Streaming and TUI
are not supported. Keep ntn updated for the latest Workers subcommands.

examples:
  notion-axi workers
  notion-axi workers runs logs <run-id> --worker-id <worker-id>
  notion-axi workers exec summarize --data-file input.json
  notion-axi workers sync trigger contacts --preview
`;

const COMMANDS = [
  "list",
  "get",
  "create",
  "rename",
  "delete",
  "new",
  "deploy",
  "exec",
  "usage",
  "capabilities list",
  "runs list",
  "runs logs",
  "sync status",
  "sync trigger",
  "sync pause",
  "sync resume",
  "sync state get",
  "sync state reset",
  "env list",
  "env set",
  "env unset",
  "env pull",
  "env push",
  "databases list",
  "databases attach",
  "databases detach",
  "webhooks list",
  "webhooks verification enable",
  "webhooks verification disable",
  "oauth start",
  "oauth token",
  "oauth show-redirect-url",
];
const TEXT_COMMANDS = new Set([
  "new",
  "env pull",
  "env push",
  "env set",
  "env unset",
  "sync state reset",
  "oauth show-redirect-url",
  "exec",
]);
const CONFIRM_COMMANDS = new Set([
  "delete",
  "databases attach",
  "databases detach",
  "env pull",
  "env push",
]);

/** Strip wrapper output/input flags while preserving native argument ordering. */
function workerArgs(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  const forward: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const eq = token.indexOf("=");
    const name = (eq < 0 ? token : token.slice(0, eq)).slice(2);
    if (token === "--full") {
      flags.full = true;
      continue;
    }
    if (token.startsWith("--full=")) throw usage("Use --full without a value");
    if (
      token.startsWith("--") &&
      ["limit", "fields", "data-file"].includes(name)
    ) {
      const value = eq < 0 ? args[++i] : token.slice(eq + 1);
      if (!value || value.startsWith("--"))
        throw usage(`Missing value for --${name}`);
      flags[name] = value;
    } else {
      forward.push(token);
    }
  }
  return { flags, forward };
}

function listPreview(
  rows: unknown[],
  flags: Record<string, string | boolean>,
  limit: number,
) {
  const requested = listFlag(flags.fields);
  const items = rows.slice(0, limit).map((row) => {
    if (flags.full === true || row === null || typeof row !== "object")
      return row;
    const item = row as Obj;
    const preferred = [
      "id",
      "workerId",
      "worker_id",
      "name",
      "key",
      "status",
      "type",
      "createdAt",
      "message",
    ];
    const defaults = preferred.filter((k) => k in row);
    const fields = requested.length
      ? requested
      : (defaults.length ? defaults : Object.keys(row)).slice(0, 4);
    return Object.fromEntries(fields.map((k) => [k, item[k]]));
  });
  return { total: rows.length, shown: items.length, items };
}

function compactLists(
  result: unknown,
  flags: Record<string, string | boolean>,
  limit: number,
): unknown {
  if (Array.isArray(result)) return listPreview(result, flags, limit);
  if (result === null || typeof result !== "object") return result;
  const out: Obj = { ...result };
  for (const [key, rows] of Object.entries(result)) {
    if (!Array.isArray(rows)) continue;
    const view = listPreview(rows, flags, limit);
    out[key] = view.items;
    out[`${key}_total`] = view.total;
    out[`${key}_shown`] = view.shown;
  }
  return out;
}

export async function workersCommand(input: string[]) {
  const args = [...input];
  const leadingConfig: string[] = [];
  while (
    args[0] === "--workers-config-file" ||
    args[0]?.startsWith("--workers-config-file=")
  ) {
    const flag = args.shift()!;
    if (flag === "--workers-config-file") {
      const value = args.shift();
      if (!value || value.startsWith("--"))
        throw usage("Missing value for --workers-config-file");
      leadingConfig.push(flag, value);
    } else {
      if (flag.length === "--workers-config-file=".length)
        throw usage("Missing value for --workers-config-file");
      leadingConfig.push(flag);
    }
  }
  if (!args.length) args.push("list");
  args.push(...leadingConfig);
  if (args[0] === "view") args[0] = "get";
  if (args[0] === "ls") args[0] = "list";
  if (args[0] === "rm") args[0] = "delete";
  if (
    ["capabilities", "runs", "env", "databases", "webhooks"].includes(
      args[0],
    ) &&
    args[1] === "ls"
  )
    args[1] = "list";
  const command = COMMANDS.find((c) =>
    c.split(" ").every((part, i) => args[i] === part),
  );
  if (!command)
    throw usage("Unknown Workers command", "Run `notion-axi workers --help`");
  const { flags, forward } = workerArgs(args.slice(command.split(" ").length));
  const limit = limitFlag(flags.limit);
  if (forward.some((a) => /^--(json|plain|stream)(=|$)/.test(a))) {
    throw usage(
      "Workers output is TOON; use --full, --fields, and --limit to control it",
    );
  }
  if (CONFIRM_COMMANDS.has(command) && !forward.includes("--yes")) {
    throw usage(
      `workers ${command} requires explicit --yes`,
      "Review the target and rerun with --yes to confirm",
    );
  }
  if (flags["data-file"] !== undefined) {
    if (command !== "exec")
      throw usage("--data-file is supported by workers exec");
    if (
      forward.some(
        (a) => a === "-d" || a === "--data" || a.startsWith("--data="),
      )
    ) {
      throw usage("Pass only one of --data or --data-file");
    }
    const data = textInput(flags, "data")!;
    try {
      JSON.parse(data);
    } catch {
      throw usage("Invalid JSON in --data-file");
    }
    forward.push("--data", data);
  }
  if (command === "sync status" && !forward.includes("--no-watch"))
    forward.push("--no-watch");
  const native = ["workers", ...command.split(" "), ...forward];
  let result: unknown;
  if (TEXT_COMMANDS.has(command)) {
    const text = await ntnText(native);
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  } else {
    result = await ntnJson([...native, "--json"]);
  }
  const value =
    command === "list" || command.endsWith(" list")
      ? compactLists(result, flags, limit)
      : result;
  return {
    command: `workers ${command}`,
    help: [
      "Run the same command with --full for complete fields/text; --limit controls list size",
    ],
    ...boundedOutput(
      "result",
      value,
      flags.full === true,
      "Run the same command with --full for the complete response",
    ),
  };
}
