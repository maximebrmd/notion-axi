import { execFile, type ExecFileException } from "node:child_process";
import { AxiError } from "./errors.js";
import type { Obj } from "./format.js";

// notion-axi shells out to the official Notion CLI (`ntn`) for every API call,
// then formats its raw JSON into TOON. `ntn` owns authentication (`ntn login`
// stores a workspace token in the OS keychain), so notion-axi never handles a
// token itself. This mirrors how gh-axi wraps the `gh` binary.

const MAX_BUFFER_BYTES = 20 * 1024 * 1024; // 20 MB — large page/query payloads

interface NtnResult {
  stdout: string;
  stderr: string;
  code: number;
  enoent: boolean;
}

interface NtnApiOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  file?: string;
}

function run(args: string[]): Promise<NtnResult> {
  return new Promise((resolve) => {
    const child = execFile(
      "ntn",
      args,
      { maxBuffer: MAX_BUFFER_BYTES, encoding: "utf8" },
      (error: ExecFileException | null, stdout, stderr) => {
        if (error && error.code === "ENOENT") {
          resolve({ stdout: "", stderr: "", code: 127, enoent: true });
          return;
        }
        const code = error
          ? typeof error.code === "number"
            ? error.code
            : 1
          : 0;
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          code,
          enoent: false,
        });
      },
    );
    // `ntn api` treats stdin as a possible request-body source and blocks on EOF
    // when run non-interactively; close it immediately so calls never hang.
    child.stdin?.end();
  });
}

/** Build the argv for an `ntn api` invocation from structured options. */
export function buildApiArgs(path: string, opts: NtnApiOptions = {}): string[] {
  const args = ["api", path.replace(/^\//, "")];
  if (opts.method) args.push("-X", opts.method.toUpperCase());
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) args.push(`${k}==${v}`);
  }
  if (opts.file) args.push("--file", opts.file);
  if (opts.body !== undefined) args.push("-d", JSON.stringify(opts.body));
  return args;
}

/** Call a Notion REST endpoint through `ntn api` and return parsed JSON. */
export async function ntnApi(
  path: string,
  opts: NtnApiOptions = {},
): Promise<Obj> {
  const res = await run(buildApiArgs(path, opts));
  if (res.enoent) throw ntnNotInstalledError();
  if (res.code !== 0) throw mapNtnError(res.stderr, res.code);
  const text = res.stdout.trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Obj;
  } catch {
    throw new AxiError(
      `Unexpected ntn output: ${text.slice(0, 200)}`,
      "NTN_ERROR",
    );
  }
}

/** The structured error raised when the `ntn` binary is not on PATH. */
export function ntnNotInstalledError(): AxiError {
  return new AxiError(
    "The Notion CLI (`ntn`) is required but was not found on PATH",
    "NTN_NOT_INSTALLED",
    [
      "Install it: curl -fsSL https://ntn.dev | bash",
      "Then connect your workspace: ntn login",
      "Docs: https://developers.notion.com/cli",
    ],
  );
}

/** Translate `ntn`'s stderr into a structured AxiError with actionable hints. */
export function mapNtnError(stderr: string, code: number): AxiError {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const errLine = lines.find((l) => /^error:/i.test(l)) ?? lines[0] ?? "";
  const message =
    errLine.replace(/^error:\s*/i, "").trim() || `ntn exited with code ${code}`;
  const lower = stderr.toLowerCase();
  const suggestions: string[] = [];
  let errCode = "NTN_ERROR";

  if (/token is invalid|unauthorized|not logged in|ntn login/.test(lower)) {
    errCode = "AUTH_REQUIRED";
    suggestions.push(
      "Run `ntn login` to connect a workspace (credentials are stored in your OS keychain)",
      "Or export NOTION_API_TOKEN with a Notion token",
    );
  } else if (/restricted_resource|restricted/.test(lower)) {
    errCode = "RESTRICTED_RESOURCE";
    suggestions.push(
      "This action isn't permitted for the current login — listing users requires elevated workspace permissions",
    );
  } else if (/object_not_found|could not find|not found/.test(lower)) {
    errCode = "OBJECT_NOT_FOUND";
    suggestions.push(
      "Check the id is correct and the object exists in this workspace",
    );
  } else if (/validation_error|invalid_request|invalid json/.test(lower)) {
    errCode = "VALIDATION_ERROR";
  }

  return new AxiError(message, errCode, suggestions);
}
