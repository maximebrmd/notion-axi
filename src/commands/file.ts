import { statSync } from "node:fs";
import { basename, extname } from "node:path";
import { parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import { ntnApi } from "../ntn.js";
import type { Obj } from "../format.js";

export const FILE_HELP = `usage: notion-axi file upload <path> [flags]

Upload a local file to Notion (single-part) and optionally attach it to a page.

flags:
  --attach <page_id>   Append the uploaded file as a block on this page
  --name <filename>    Override the stored filename (default: the file's name)

examples:
  notion-axi file upload ./diagram.png
  notion-axi file upload ./report.pdf --attach 24f1...
`;

export async function fileCommand(args: string[]) {
  const sub = args[0];
  if (sub !== "upload") {
    throw usage(
      sub ? `Unknown file subcommand "${sub}"` : "Missing file subcommand",
      "Run `notion-axi file upload <path>`",
    );
  }
  return fileUpload(args.slice(1));
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
    await ntnApi(`v1/blocks/${attach}/children`, {
      method: "PATCH",
      body: {
        children: [
          {
            type: "file",
            file: { type: "file_upload", file_upload: { id: upload.id } },
          },
        ],
      },
    });
    out.attached_to = attach;
    out.help = [`Run \`notion-axi page view ${attach}\` to see it`];
  } else {
    out.help = [
      `Attach it with \`notion-axi file upload <path> --attach <page_id>\``,
    ];
  }
  return out;
}
