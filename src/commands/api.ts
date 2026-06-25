import { parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import { call, getClient } from "../notion.js";
import type { Obj } from "../format.js";

export const API_HELP = `usage: notion-axi api <path> [flags]
       notion-axi api <method> <path> [flags]

Call any Notion REST endpoint directly — an escape hatch for things the
dedicated commands don't cover (comments, file uploads, complex filters).

flags:
  --method <get|post|patch|delete>   HTTP method (default: get; or pass it as the first arg)
  --body <json>                      JSON request body (for post/patch)
  --query <json>                     JSON query parameters

examples:
  notion-axi api users/me
  notion-axi api post search --body '{"query":"roadmap"}'
  notion-axi api patch pages/<id> --body '{"archived":true}'
  notion-axi api comments --query '{"block_id":"<id>"}'
`;

const METHODS = new Set(["get", "post", "patch", "delete"]);

export async function apiCommand(args: string[]) {
  const { positionals, flags } = parseArgs(args);

  // Accept `api <method> <path>`, `api <path>` (GET), or `api <path> --method ...`.
  let method = strFlag(flags.method)?.toLowerCase();
  let path: string;
  if (positionals.length >= 2 && METHODS.has(positionals[0].toLowerCase())) {
    method = positionals[0].toLowerCase();
    path = positionals[1];
  } else {
    path = positionals[0];
  }
  method = method ?? "get";

  if (!path) {
    throw usage(
      "Missing path",
      "Run `notion-axi api <path>` (e.g. `users/me`)",
    );
  }
  if (!METHODS.has(method)) {
    throw usage(
      `Unknown method "${method}"`,
      "Use one of: get, post, patch, delete",
    );
  }

  const body = parseJson(strFlag(flags.body), "--body");
  const query = parseJson(strFlag(flags.query), "--query");

  const notion = getClient();
  const result: Obj = await call(() =>
    notion.request({
      path: path.replace(/^\//, ""),
      method: method as "get" | "post" | "patch" | "delete",
      body,
      query,
    }),
  );
  return { result };
}

function parseJson(raw: string | undefined, flag: string): Obj | undefined {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw usage(
      `Invalid JSON in ${flag}`,
      `Pass valid JSON, e.g. ${flag} '{"key":"value"}'`,
    );
  }
}
