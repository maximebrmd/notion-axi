import { parseArgs } from "../args.js";
import { usage } from "../errors.js";
import { richTextToPlain, shortDate, type Obj } from "../format.js";
import { call, getClient } from "../notion.js";

export const COMMENTS_HELP = `usage: notion-axi comments <list|add> <id> ...

subcommands:
  list <id>          List comments on a page (or block)
  add <id> <text>    Add a comment to a page

examples:
  notion-axi comments list 24f1...
  notion-axi comments add 24f1... "Looks good — shipping it."
`;

export async function commentsCommand(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "list":
      return commentsList(rest);
    case "add":
      return commentsAdd(rest);
    default:
      throw usage(
        sub
          ? `Unknown comments subcommand "${sub}"`
          : "Missing comments subcommand",
        "Run `notion-axi comments list <id>`",
        "Run `notion-axi comments add <id> <text>`",
      );
  }
}

async function commentsList(args: string[]) {
  const { positionals } = parseArgs(args);
  const id = positionals[0];
  if (!id) throw usage("Missing id", "Run `notion-axi comments list <id>`");

  const notion = getClient();
  const res: Obj = await call(() => notion.comments.list({ block_id: id }));
  const comments = (res.results ?? []).map((c: Obj) => ({
    id: c.id,
    author: c.created_by?.name ?? c.created_by?.id ?? "",
    created: shortDate(c.created_time),
    text: richTextToPlain(c.rich_text),
  }));

  if (comments.length === 0) {
    return { comments: [], result: "0 comments on this page" };
  }
  return {
    comments,
    count: comments.length,
    help: [`Run \`notion-axi comments add ${id} <text>\` to reply`],
  };
}

async function commentsAdd(args: string[]) {
  const { positionals } = parseArgs(args);
  const id = positionals[0];
  const text = positionals.slice(1).join(" ").trim();
  if (!id)
    throw usage("Missing id", "Run `notion-axi comments add <id> <text>`");
  if (!text) {
    throw usage(
      "Missing comment text",
      "Run `notion-axi comments add <id> <text>`",
    );
  }

  const notion = getClient();
  const comment: Obj = await call(() =>
    notion.comments.create({
      parent: { page_id: id },
      rich_text: [{ text: { content: text } }],
    } as any),
  );

  return {
    added: comment.id,
    on: id,
    help: [`Run \`notion-axi comments list ${id}\` to see all comments`],
  };
}
