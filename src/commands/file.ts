import { readFileSync } from "node:fs";
import { Blob } from "node:buffer";
import { basename } from "node:path";
import { parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import { call, getClient } from "../notion.js";
import type { Obj } from "../format.js";

export const FILE_HELP = `usage: notion-axi file upload <path> [flags]

Upload a local file to Notion (single-part) and optionally attach it to a page.
This is the one thing the raw \`api\` command can't do — uploads are multipart.

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
  const name = strFlag(flags.name) ?? basename(path);
  const attach = strFlag(flags.attach);

  let data: Buffer;
  try {
    data = readFileSync(path);
  } catch {
    throw usage(`Cannot read file: ${path}`, "Check the path to the file");
  }

  const notion = getClient();
  const upload: Obj = await call(() =>
    notion.fileUploads.create({ mode: "single_part", filename: name } as any),
  );
  // Send the bytes with the exact content type Notion recorded at create time,
  // otherwise the upload is rejected for a content-type mismatch.
  const blob = upload.content_type
    ? new Blob([data], { type: upload.content_type })
    : new Blob([data]);
  await call(() =>
    notion.fileUploads.send({
      file_upload_id: upload.id,
      file: { filename: name, data: blob },
    } as any),
  );

  const out: Obj = { uploaded: upload.id, filename: name, bytes: data.length };

  if (attach !== undefined) {
    await call(() =>
      notion.blocks.children.append({
        block_id: attach,
        children: [
          {
            type: "file",
            file: { type: "file_upload", file_upload: { id: upload.id } },
          },
        ],
      } as any),
    );
    out.attached_to = attach;
    out.help = [`Run \`notion-axi page view ${attach}\` to see it`];
  } else {
    out.help = [
      `Attach it with \`notion-axi file upload <path> --attach <page_id>\``,
    ];
  }
  return out;
}
