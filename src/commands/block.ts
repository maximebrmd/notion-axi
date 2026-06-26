import { intFlag, parseArgs } from "../args.js";
import { usage } from "../errors.js";
import { richTextToPlain, type Obj } from "../format.js";
import { ntnApi } from "../ntn.js";

export const BLOCK_HELP = `usage: notion-axi block <list|delete> <id> [flags]

subcommands:
  list <page_id> [--limit <n>]   List a page's child blocks (id, type, text)
  delete <block_id>              Delete (trash) a single block

examples:
  notion-axi block list 24f1...
  notion-axi block delete 8a1b...
`;

export async function blockCommand(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "list":
      return blockList(rest);
    case "delete":
      return blockDelete(rest);
    default:
      throw usage(
        sub ? `Unknown block subcommand "${sub}"` : "Missing block subcommand",
        "Run `notion-axi block list <page_id>`",
        "Run `notion-axi block delete <block_id>`",
      );
  }
}

/** Best-effort plain-text preview of a block of any type. */
function blockText(b: Obj): string {
  const body = b[b.type];
  return richTextToPlain(body?.rich_text) || (body?.url ?? "");
}

async function blockList(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  const id = positionals[0];
  if (!id)
    throw usage("Missing page id", "Run `notion-axi block list <page_id>`");
  const limit = intFlag(flags.limit, 50);

  const res: Obj = await ntnApi(`v1/blocks/${id}/children`, {
    query: { page_size: Math.min(limit, 100) },
  });
  const blocks = (res.results ?? []).slice(0, limit).map((b: Obj) => ({
    id: b.id,
    type: b.type,
    text: blockText(b),
  }));

  if (blocks.length === 0) {
    return { blocks: [], result: "0 child blocks on this page" };
  }
  return {
    blocks,
    count: blocks.length,
    has_more: res.has_more ?? false,
    help: ["Run `notion-axi block delete <id>` to remove one"],
  };
}

async function blockDelete(args: string[]) {
  const { positionals } = parseArgs(args);
  const id = positionals[0];
  if (!id)
    throw usage("Missing block id", "Run `notion-axi block delete <block_id>`");

  await ntnApi(`v1/blocks/${id}`, { method: "DELETE" });
  return { deleted: id, result: "block trashed" };
}
