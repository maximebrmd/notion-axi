import { readFileSync } from "node:fs";
import { collectFlag, parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import {
  buildPropertyValue,
  objectTitle,
  propertyValue,
  shortDate,
  truncate,
  type Obj,
  type Truncated,
} from "../format.js";
import { call, getClient } from "../notion.js";

export const PAGE_HELP = `usage: notion-axi page <view|create|update|archive|move> ...

subcommands:
  view <id> [--full]
      Show properties and the page body (markdown). Body is previewed to
      ~1500 chars unless --full is given.

  create --parent <id> --title <text> [--content <md> | --content-file <path>] [--db] [--set Name=value ...]
      Create a page. By default --parent is a page id; pass --db to create
      the page as a row inside a database (data source). --set sets row
      properties (repeatable; requires --db).

  update <id> [--append <md> | --append-file <path>] [--replace <md> | --replace-file <path>] [--set Name=value ...]
      Append/replace the page body and/or set properties. --set is repeatable
      (e.g. --set Status=Done --set "Due=2026-07-01"; ranges as start..end;
      multi-select / people / relation as comma-separated values).

  archive <id> [--restore]
      Move a page to the trash, or restore it with --restore. Idempotent.

  move <id> --to <parent> [--db]
      Move a page under a new parent page (or a database with --db).

examples:
  notion-axi page view 24f1...
  notion-axi page create --parent 9ab2... --title "New task" --db --set Status=Todo
  notion-axi page update 24f1... --append "## Follow-ups"
  notion-axi page update 24f1... --set Status=Done --set "Due=2026-07-01"
  notion-axi page archive 24f1...
  notion-axi page move 24f1... --to 9ab2...
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

/** Parse repeatable `--set Name=value` entries into [name, value] pairs. */
function parseSets(entries: string[]): Array<[string, string]> {
  return entries.map((e) => {
    const i = e.indexOf("=");
    if (i < 0) throw usage(`--set must be Name=value (got "${e}")`);
    return [e.slice(0, i).trim(), e.slice(i + 1)];
  });
}

/** Build a `properties` payload from --set pairs against a name→schema map. */
function buildProperties(sets: Array<[string, string]>, schema: Obj): Obj {
  const props: Obj = {};
  for (const [name, value] of sets) {
    const type = schema[name]?.type;
    if (!type) {
      throw usage(
        `Unknown property: ${name}`,
        "Run `notion-axi db view <id>` to see valid property names",
      );
    }
    props[name] = buildPropertyValue(type, value);
  }
  return props;
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
    case "archive":
      return pageArchive(rest);
    case "move":
      return pageMove(rest);
    default:
      throw usage(
        sub ? `Unknown page subcommand "${sub}"` : "Missing page subcommand",
        "Run `notion-axi page view <id>`",
        "Run `notion-axi page create --parent <id> --title <text>`",
        "Run `notion-axi page update <id> --set Name=value`",
        "Run `notion-axi page archive <id>`",
        "Run `notion-axi page move <id> --to <parent>`",
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
  const sets = parseSets(collectFlag(args, "set"));

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
    properties = {
      [titleProp]: { title: [{ text: { content: title } }] },
      ...buildProperties(sets, ds.properties ?? {}),
    };
  } else {
    if (sets.length > 0) {
      throw usage(
        "--set requires creating a database row (--db)",
        "Set properties afterward with `notion-axi page update <id> --set ...`",
      );
    }
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
      "Run `notion-axi page update <id> --set Name=value`",
    );

  const append = contentFrom(flags, "append");
  const replace = contentFrom(flags, "replace");
  const sets = parseSets(collectFlag(args, "set"));
  if (append === undefined && replace === undefined && sets.length === 0) {
    throw usage(
      "Nothing to update",
      "Run `notion-axi page update <id> --set Name=value` to set a property",
      "Run `notion-axi page update <id> --append <markdown>` to append content",
      "Run `notion-axi page update <id> --replace <markdown>` to overwrite content",
    );
  }

  const notion = getClient();
  const out: Obj = { updated: id };

  if (sets.length > 0) {
    const page: Obj = await call(() => notion.pages.retrieve({ page_id: id }));
    const properties = buildProperties(sets, page.properties ?? {});
    await call(() =>
      notion.pages.update({ page_id: id, properties: properties as any }),
    );
    out.properties_set = sets.map(([name]) => name);
  }

  if (replace !== undefined) {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: id,
        type: "replace_content",
        replace_content: { new_str: replace, allow_deleting_content: true },
      }),
    );
    out.body = "replaced";
  } else if (append !== undefined) {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: id,
        type: "insert_content",
        insert_content: { content: append, position: { type: "end" } },
      }),
    );
    out.body = "appended";
  }

  out.help = [`Run \`notion-axi page view ${id}\` to confirm`];
  return out;
}

async function pageArchive(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["restore"]);
  const id = positionals[0];
  if (!id) throw usage("Missing page id", "Run `notion-axi page archive <id>`");
  const restore = flags.restore === true;
  const target = !restore; // archive → true (in trash); restore → false

  const notion = getClient();
  const page: Obj = await call(() => notion.pages.retrieve({ page_id: id }));
  const trashed = page.in_trash ?? page.archived ?? false;

  if (trashed === target) {
    return {
      page: id,
      result: target ? "already archived (no-op)" : "already active (no-op)",
    };
  }

  await call(() =>
    notion.pages.update({ page_id: id, in_trash: target } as any),
  );

  return {
    page: id,
    result: target ? "archived" : "restored",
    help: target
      ? [`Run \`notion-axi page archive ${id} --restore\` to undo`]
      : undefined,
  };
}

async function pageMove(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["db"]);
  const id = positionals[0];
  if (!id) {
    throw usage(
      "Missing page id",
      "Run `notion-axi page move <id> --to <parent>`",
    );
  }
  const to = strFlag(flags.to);
  if (!to) {
    throw usage(
      "Missing --to",
      "Run `notion-axi page move <id> --to <parent_page_id>` (add --db if the parent is a database)",
    );
  }
  const parent = flags.db === true ? { data_source_id: to } : { page_id: to };

  const notion = getClient();
  await call(() => notion.pages.move({ page_id: id, parent } as any));
  return {
    moved: id,
    to,
    help: [`Run \`notion-axi page view ${id}\` to confirm`],
  };
}
