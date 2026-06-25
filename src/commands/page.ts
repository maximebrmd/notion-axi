import { readFileSync } from "node:fs";
import { parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import {
  objectTitle,
  propertyValue,
  shortDate,
  truncate,
  type Obj,
  type Truncated,
} from "../format.js";
import { call, getClient } from "../notion.js";

export const PAGE_HELP = `usage: notion-axi page <view|create|update> ...

subcommands:
  view <id> [--full]
      Show properties and the page body (markdown). Body is previewed to
      ~1500 chars unless --full is given.

  create --parent <id> --title <text> [--content <md> | --content-file <path>] [--db]
      Create a page. By default --parent is a page id; pass --db to create
      the page as a row inside a database (data source) id instead.

  update <id> (--append <md> | --append-file <path> | --replace <md> | --replace-file <path>)
      Append markdown to the end of a page, or replace its entire content.

For long or multi-line markdown, the --*-file flags read the body from a UTF-8
file instead of the command line.

examples:
  notion-axi page view 24f1e2a3b4c5...
  notion-axi page create --parent 24f1... --title "Meeting notes" --content "# Agenda"
  notion-axi page create --parent 24f1... --title "Spec" --content-file ./spec.md
  notion-axi page create --parent 9ab2... --title "New task" --db
  notion-axi page update 24f1... --append "## Follow-ups"
  notion-axi page update 24f1... --replace-file ./body.md
`;

const BODY_PREVIEW = 1500;

/** Resolve markdown from an inline `--<name>` flag or a `--<name>-file` path. */
function contentFrom(
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined {
  const inline = strFlag(flags[name]);
  const file = strFlag(flags[`${name}-file`]);
  if (file !== undefined) {
    if (inline !== undefined) {
      throw usage(`Pass only one of --${name} or --${name}-file`);
    }
    try {
      return readFileSync(file, "utf8");
    } catch {
      throw usage(
        `Cannot read file: ${file}`,
        `Check the path passed to --${name}-file`,
      );
    }
  }
  return inline;
}

export async function pageCommand(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "view":
      return pageView(rest);
    case "create":
      return pageCreate(rest);
    case "update":
      return pageUpdate(rest);
    default:
      throw usage(
        sub ? `Unknown page subcommand "${sub}"` : "Missing page subcommand",
        "Run `notion-axi page view <id>`",
        "Run `notion-axi page create --parent <id> --title <text>`",
        "Run `notion-axi page update <id> --append <markdown>`",
      );
  }
}

async function pageView(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  const id = positionals[0];
  if (!id) throw usage("Missing page id", "Run `notion-axi page view <id>`");
  const full = flags.full === true;

  const notion = getClient();
  const page: Obj = await call(() => notion.pages.retrieve({ page_id: id }));
  const md: Obj = await call(() =>
    notion.pages.retrieveMarkdown({ page_id: id }),
  );

  const properties = Object.entries(page.properties ?? {})
    .map(([name, prop]) => ({
      name,
      type: (prop as Obj).type,
      value: propertyValue(prop as Obj),
    }))
    .filter((p) => p.value !== null && p.value !== "");

  const markdown = md.markdown ?? "";
  const view: Truncated = full
    ? { text: markdown, truncated: false }
    : truncate(markdown, BODY_PREVIEW);

  const out: Obj = {
    page: {
      id: page.id,
      title: objectTitle(page),
      url: page.url,
      edited: shortDate(page.last_edited_time),
    },
    properties,
    body: view.text || "(no text content)",
  };

  if (view.truncated || md.truncated) {
    out.body_truncated = true;
    out.body_chars_shown = view.text.length;
    if (view.total) out.body_chars_total = view.total;
    out.help = [
      `Run \`notion-axi page view ${id} --full\` for the complete body`,
    ];
  }
  return out;
}

async function pageCreate(args: string[]) {
  const { flags } = parseArgs(args, ["db"]);
  const parent = strFlag(flags.parent);
  const title = strFlag(flags.title);
  if (!parent)
    throw usage(
      "Missing --parent",
      "Run `notion-axi page create --parent <id> --title <text>`",
    );
  if (!title)
    throw usage(
      "Missing --title",
      "Run `notion-axi page create --parent <id> --title <text>`",
    );

  const notion = getClient();
  let parentRef: Obj;
  let properties: Obj;

  if (flags.db === true) {
    const ds: Obj = await call(() =>
      notion.dataSources.retrieve({ data_source_id: parent }),
    );
    const titleProp =
      Object.keys(ds.properties ?? {}).find(
        (k) => ds.properties[k]?.type === "title",
      ) ?? "Name";
    parentRef = { data_source_id: parent };
    properties = { [titleProp]: { title: [{ text: { content: title } }] } };
  } else {
    parentRef = { page_id: parent };
    properties = { title: { title: [{ text: { content: title } }] } };
  }

  const page: Obj = await call(() =>
    notion.pages.create({
      parent: parentRef as any,
      properties: properties as any,
    }),
  );

  const content = contentFrom(flags, "content");
  if (content !== undefined) {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: page.id,
        type: "insert_content",
        insert_content: { content, position: { type: "end" } },
      }),
    );
  }

  return {
    created: page.id,
    title,
    url: page.url,
    help: [
      `Run \`notion-axi page view ${page.id}\` to read it back`,
      `Run \`notion-axi page update ${page.id} --append <markdown>\` to add more content`,
    ],
  };
}

async function pageUpdate(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  const id = positionals[0];
  if (!id)
    throw usage(
      "Missing page id",
      "Run `notion-axi page update <id> --append <markdown>`",
    );

  const append = contentFrom(flags, "append");
  const replace = contentFrom(flags, "replace");
  if (append === undefined && replace === undefined) {
    throw usage(
      "Nothing to update",
      "Run `notion-axi page update <id> --append <markdown>` to append content",
      "Run `notion-axi page update <id> --replace <markdown>` to overwrite content",
    );
  }

  const notion = getClient();
  if (replace !== undefined) {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: id,
        type: "replace_content",
        replace_content: { new_str: replace, allow_deleting_content: true },
      }),
    );
  } else {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: id,
        type: "insert_content",
        insert_content: {
          content: append as string,
          position: { type: "end" },
        },
      }),
    );
  }

  return {
    updated: id,
    mode: replace !== undefined ? "replace" : "append",
    help: [`Run \`notion-axi page view ${id}\` to confirm`],
  };
}
