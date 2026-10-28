import { checkFlags, limitFlag, parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import { ntnApi, ntnJson, ntnText } from "../ntn.js";
import type { Obj } from "../format.js";
import { textInput } from "../input.js";
import { boundedOutput } from "../output.js";

export const API_HELP = `usage: notion-axi api <path> [flags]
       notion-axi api <method> <path> [flags]
       notion-axi api endpoints [query] [--method <method>] [--limit <1..100>] [--full]
       notion-axi api <docs|schema> <path> [--method <method>] [--full]

Call any Notion REST endpoint directly — an escape hatch for things the
dedicated commands don't cover (file uploads, complex filters, raw queries).

flags:
  --method <get|post|patch|delete>   HTTP method (default: get; or pass it as the first arg)
  --body <json> | --body-file <path>  JSON request body; pass - as path for stdin
  --query <json>                     JSON query parameters
  --notion-version <version>         Override the version used by ntn

Discovery uses ntn's current official endpoint catalog, Markdown docs, and
OpenAPI fragments without making the selected API request. Output is bounded
by default; --full returns all fields or the complete docs/schema.

examples:
  notion-axi api users/me
  notion-axi api post search --body '{"query":"roadmap"}'
  notion-axi api patch pages/<id> --body '{"archived":true}'
  notion-axi api comments --query '{"block_id":"<id>"}'
  notion-axi api endpoints pages
  notion-axi api schema v1/pages --method post
  notion-axi api docs v1/pages/<id>/markdown --method patch
`;

const METHODS = new Set(["get", "post", "patch", "delete"]);

export async function apiCommand(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  if (["endpoints", "ls", "docs", "schema"].includes(positionals[0])) {
    return apiDiscovery(positionals, flags);
  }
  checkFlags(flags, ["method", "body", "body-file", "query", "notion-version"]);
  if (flags.method === true) throw usage("Missing value for --method");

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

  const body = parseJson(textInput(flags, "body"), "--body");
  const query = parseJson(strFlag(flags.query), "--query");
  if (flags.query === true) throw usage("Missing value for --query");
  if (
    query !== undefined &&
    (query === null || Array.isArray(query) || typeof query !== "object")
  ) {
    throw usage("--query must be a JSON object");
  }
  const notionVersion = versionFlag(flags);

  const result: Obj = await ntnApi(path, {
    method,
    ...(body !== undefined ? { body } : {}),
    ...(query !== undefined ? { query: scalarize(query) } : {}),
    ...(notionVersion ? { notionVersion } : {}),
  });
  return { result };
}

function versionFlag(
  flags: Record<string, string | boolean>,
): string | undefined {
  if (flags["notion-version"] === true)
    throw usage("Missing value for --notion-version");
  return strFlag(flags["notion-version"]);
}

async function apiDiscovery(
  positionals: string[],
  flags: Record<string, string | boolean>,
) {
  const [sub, path] = positionals;
  checkFlags(
    flags,
    sub === "endpoints" || sub === "ls"
      ? ["method", "limit", "full", "notion-version"]
      : ["method", "full", "notion-version"],
  );
  const method = strFlag(flags.method)?.toLowerCase();
  if (flags.method !== undefined && !METHODS.has(method!))
    throw usage("Use --method get, post, patch, or delete");
  const version = versionFlag(flags);
  const versionArgs = version ? ["--notion-version", version] : [];
  if (sub === "endpoints" || sub === "ls") {
    const limit = limitFlag(flags.limit, 25);
    const endpoints = await ntnJson<Obj[]>([
      "api",
      ...versionArgs,
      "ls",
      "--json",
    ]);
    const query = (path ?? "").toLowerCase();
    const matches = endpoints.filter(
      (e) =>
        (!method || e.method.toLowerCase() === method) &&
        `${e.path} ${e.summary} ${(e.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(query),
    );
    return {
      total: matches.length,
      shown: Math.min(matches.length, limit),
      endpoints: matches
        .slice(0, limit)
        .map((e) =>
          flags.full === true
            ? e
            : { method: e.method, path: e.path, summary: e.summary },
        ),
      help: [
        "Run `notion-axi api docs <path> --method <method>` or `notion-axi api schema <path> --method <method>` to inspect an endpoint",
      ],
    };
  }
  if (!path) throw usage(`Missing path for api ${sub}`);
  const native = [
    "api",
    path.replace(/^\//, ""),
    sub === "docs" ? "--docs" : "--spec",
  ];
  if (method) native.push("-X", method.toUpperCase());
  native.push(...versionArgs);
  const value = sub === "docs" ? await ntnText(native) : await ntnJson(native);
  // Native fragments put shared components first. Lead previews with the
  // selected operation so request/response details remain visible.
  const preview =
    sub === "schema" && flags.full !== true
      ? { paths: (value as Obj).paths, ...(value as Obj) }
      : value;
  return {
    path,
    ...boundedOutput(
      sub,
      preview,
      flags.full === true,
      `Run \`notion-axi api ${sub} ${path}${method ? ` --method ${method}` : ""}${version ? ` --notion-version ${version}` : ""} --full\` for the complete response`,
    ),
  };
}

/** Coerce a query JSON object into the scalar map `ntn`'s inline syntax wants. */
function scalarize(query: Obj): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(query)) {
    out[k] =
      typeof v === "object" && v !== null ? JSON.stringify(v) : (v as never);
  }
  return out;
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
