import { statSync } from "node:fs";
import { basename, extname } from "node:path";
import { checkFlags, limitFlag, parseArgs, strFlag } from "../args.js";
import { AxiError, usage } from "../errors.js";
import { ntnApi } from "../ntn.js";
import type { Obj } from "../format.js";

export const FILE_HELP = `usage: notion-axi file <upload|list|view|import|attach> ...

subcommands:
  upload <path> [--attach <page_id>] [--name <filename>]
      Upload a local file (single-part) and optionally attach it to a page.
  list [--status <pending|uploaded|expired|failed>] [--limit <1..100>] [--cursor <c>] [--full]
      List uploads, with server-side status filtering and cursor pagination.
  view <upload_id> [--full]
      Check upload status, size, expiry, and import errors.
  import <https-url> [--name <filename>]
      Import a public HTTPS URL asynchronously; check view before attaching.
  attach <upload_id> --to <page_id>
      Attach an existing upload as a file block once its status is uploaded.

Uploads must be attached before expiry. --full returns all upload fields.

examples:
  notion-axi file upload ./diagram.png
  notion-axi file upload ./report.pdf --attach 24f1...
  notion-axi file list --status pending
  notion-axi file import https://example.com/report.pdf
  notion-axi file attach <upload_id> --to 24f1...
`;

export async function fileCommand(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "upload":
      return fileUpload(rest);
    case "list":
      return fileList(rest);
    case "view":
      return fileView(rest);
    case "import":
      return fileImport(rest);
    case "attach":
      return fileAttach(rest);
    default:
      throw usage(
        sub ? `Unknown file subcommand "${sub}"` : "Missing file subcommand",
        "Run `notion-axi file --help`",
      );
  }
}

function fileSummary(file: Obj): Obj {
  return {
    id: file.id,
    filename: file.filename,
    status: file.status,
    expires: file.expiry_time,
  };
}

function statusHelp(file: Obj): string[] {
  switch (file.status) {
    case "uploaded":
      return [
        `Run \`notion-axi file attach ${file.id} --to <page_id>\` before expiry`,
      ];
    case "failed":
      return [
        "Correct the URL, file type, or size and create a new upload; inspect file_import_result for details",
      ];
    case "expired":
      return ["Create a new upload; expired uploads cannot be attached"];
    default:
      return [
        `Run \`notion-axi file view ${file.id}\` again to check completion before attaching`,
      ];
  }
}

async function fileList(args: string[]) {
  const { flags } = parseArgs(args, ["full"]);
  checkFlags(flags, ["status", "limit", "cursor", "full"]);
  const status = strFlag(flags.status);
  if (
    flags.status !== undefined &&
    !["pending", "uploaded", "expired", "failed"].includes(status!)
  ) {
    throw usage("--status must be pending, uploaded, expired, or failed");
  }
  const query: Record<string, string | number> = {
    page_size: limitFlag(flags.limit),
  };
  if (status) query.status = status;
  if (flags.cursor === true) throw usage("Missing value for --cursor");
  const cursor = strFlag(flags.cursor);
  if (cursor) query.start_cursor = cursor;
  const result = await ntnApi("v1/file_uploads", { query });
  const files: Obj[] = result.results ?? [];
  return {
    total: files.length,
    files: flags.full === true ? files : files.map(fileSummary),
    has_more: result.has_more ?? false,
    next_cursor: result.next_cursor ?? null,
    help: result.has_more
      ? [
          `Run \`notion-axi file list --limit ${query.page_size}${status ? ` --status ${status}` : ""} --cursor ${result.next_cursor}\` for the next page`,
        ]
      : ["Run `notion-axi file view <upload_id>` to inspect status and expiry"],
  };
}

async function fileView(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  checkFlags(flags, ["full"]);
  const id = positionals[0];
  if (!id)
    throw usage("Missing upload id", "Run `notion-axi file view <upload_id>`");
  const file = await ntnApi(`v1/file_uploads/${id}`);
  return {
    file:
      flags.full === true
        ? file
        : {
            ...fileSummary(file),
            content_type: file.content_type,
            bytes: file.content_length,
            file_import_result: file.file_import_result,
          },
    help: statusHelp(file),
  };
}

async function fileImport(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  checkFlags(flags, ["name"]);
  if (flags.name === true) throw usage("Missing value for --name");
  let url: URL;
  let filename: string;
  try {
    url = new URL(positionals[0]);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Invalid URL");
    filename =
      strFlag(flags.name) ?? basename(decodeURIComponent(url.pathname));
  } catch {
    throw usage(
      "Pass a public HTTPS URL",
      "Run `notion-axi file import https://example.com/report.pdf --name report.pdf`",
    );
  }
  if (!filename) throw usage("A filename is required; pass --name <filename>");
  const file = await ntnApi("v1/file_uploads", {
    method: "POST",
    body: { mode: "external_url", external_url: url.href, filename },
  });
  return {
    imported: file.id,
    filename,
    status: file.status,
    expires: file.expiry_time,
    file_import_result: file.file_import_result,
    help: statusHelp(file),
  };
}

async function appendFile(id: string, page: string): Promise<void> {
  await ntnApi(`v1/blocks/${page}/children`, {
    method: "PATCH",
    body: {
      children: [
        { type: "file", file: { type: "file_upload", file_upload: { id } } },
      ],
    },
  });
}

async function fileAttach(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  checkFlags(flags, ["to"]);
  const id = positionals[0];
  const page = strFlag(flags.to);
  if (!id || !page)
    throw usage(
      "An upload id and --to are required",
      "Run `notion-axi file attach <upload_id> --to <page_id>`",
    );
  const file = await ntnApi(`v1/file_uploads/${id}`);
  if (file.status !== "uploaded") {
    throw new AxiError(
      `Upload ${id} is ${file.status}; attachment requires uploaded status`,
      "UPLOAD_NOT_READY",
      statusHelp(file),
    );
  }
  await appendFile(id, page);
  return {
    attached: id,
    page,
    help: [`Run \`notion-axi page view ${page}\` to see it`],
  };
}

/**
 * Notion infers a file's content type from the create-time filename's extension,
 * while `ntn api --file` derives the sent content type from the bytes on disk. If
 * a `--name` override carries a different extension than the real file the two
 * diverge and Notion rejects the upload, so keep the stored name's extension in
 * step with the actual file.
 */
function storedName(override: string | undefined, path: string): string {
  if (override === undefined) return basename(path);
  const ext = extname(path);
  if (!ext || extname(override).toLowerCase() === ext.toLowerCase()) {
    return override;
  }
  return override + ext;
}

async function fileUpload(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  checkFlags(flags, ["attach", "name"]);
  const path = positionals[0];
  if (!path)
    throw usage("Missing file path", "Run `notion-axi file upload <path>`");
  if (flags.name === true)
    throw usage(
      "Missing value for --name",
      "Run `notion-axi file upload <path> --name <filename>`",
    );
  if (flags.attach === true)
    throw usage(
      "Missing page id for --attach",
      "Run `notion-axi file upload <path> --attach <page_id>`",
    );
  const name = storedName(strFlag(flags.name), path);
  const attach = strFlag(flags.attach);

  let bytes: number;
  try {
    bytes = statSync(path).size;
  } catch {
    throw usage(`Cannot read file: ${path}`, "Check the path to the file");
  }

  // Two-step single-part upload: create the upload object, then send the bytes
  // as a multipart `file` field (which `ntn api --file` handles).
  const upload: Obj = await ntnApi("v1/file_uploads", {
    method: "POST",
    body: { mode: "single_part", filename: name },
  });
  await ntnApi(`v1/file_uploads/${upload.id}/send`, {
    method: "POST",
    file: path,
  });

  const out: Obj = { uploaded: upload.id, filename: name, bytes };

  if (attach !== undefined) {
    await appendFile(upload.id, attach);
    out.attached_to = attach;
    out.help = [`Run \`notion-axi page view ${attach}\` to see it`];
  } else {
    out.help = [
      `Attach it with \`notion-axi file attach ${upload.id} --to <page_id>\``,
    ];
  }
  return out;
}
