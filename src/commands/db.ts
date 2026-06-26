import { isNotionClientError } from "@notionhq/client";
import { collectFlag, intFlag, listFlag, parseArgs, strFlag } from "../args.js";
import { usage } from "../errors.js";
import {
  buildPropertySchema,
  objectTitle,
  propertyValue,
  richTextToPlain,
  type Obj,
} from "../format.js";
import { call, getClient } from "../notion.js";

export const DB_HELP = `usage: notion-axi db <view|query|create|edit> <id> [flags]

subcommands:
  view <id> [--source <data_source_id>]
      List the database's data sources and property schema.

  query <id> [--limit <n>] [--full] [--fields <list>] [--source <data_source_id>]
      List rows as a table. Shows the title + first 3 columns by default;
      --full includes every column, or --fields <a,b> picks specific ones.

  create --parent <page_id> --title <name> [--prop Name:type ...]
      Create a database under a page. --prop is repeatable (e.g. --prop
      Stage:select --prop Due:date); a title property is added if none given.

  edit <id> [--add Name:type ...] [--remove Name ...] [--source <id>]
      Add or remove data-source properties. Both flags are repeatable.

Property types: title, rich_text, number, select, multi_select, date,
people, files, checkbox, url, email, phone_number.

examples:
  notion-axi db view 1f0a...
  notion-axi db query 1f0a... --fields Stage,Company
  notion-axi db create --parent 24f1... --title Tasks --prop Stage:select --prop Due:date
  notion-axi db edit 1f0a... --add Priority:select --remove OldField
`;

export async function dbCommand(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "view":
    case "schema":
      return dbView(rest);
    case "query":
    case "rows":
      return dbQuery(rest);
    case "create":
      return dbCreate(rest);
    case "edit":
      return dbEdit(rest);
    default:
      throw usage(
        sub ? `Unknown db subcommand "${sub}"` : "Missing db subcommand",
        "Run `notion-axi db view <id>` to see the schema",
        "Run `notion-axi db query <id>` to list rows",
        "Run `notion-axi db create --parent <page_id> --title <name>`",
        "Run `notion-axi db edit <id> --add Name:type`",
      );
  }
}

/** Parse `Name:type` entries into [name, type] pairs. */
function parseProps(entries: string[], flag: string): Array<[string, string]> {
  return entries.map((e) => {
    const i = e.indexOf(":");
    if (i < 0) throw usage(`--${flag} must be Name:type (got "${e}")`);
    return [e.slice(0, i).trim(), e.slice(i + 1).trim()];
  });
}

interface Resolved {
  dsId: string;
  sources: Array<{ id: string; name: string }>;
  dbId?: string;
  dbTitle?: string;
  dbUrl?: string;
}

/**
 * Accept either a database id or a data-source id and resolve to a queryable
 * data source. A database may expose several data sources; default to the first.
 */
async function resolve(id: string, source?: string): Promise<Resolved> {
  const notion = getClient();
  if (source) return { dsId: source, sources: [] };
  try {
    const db: Obj = await notion.databases.retrieve({ database_id: id });
    const sources = (db.data_sources ?? []) as Array<{
      id: string;
      name: string;
    }>;
    if (sources.length === 0) {
      throw usage("That database has no data sources to query");
    }
    return {
      dsId: sources[0].id,
      sources,
      dbId: db.id,
      dbTitle: objectTitle(db),
      dbUrl: db.url,
    };
  } catch (e) {
    // Not a database id (or not shared) — assume it is already a data_source id.
    if (isNotionClientError(e)) return { dsId: id, sources: [] };
    throw e;
  }
}

async function dbView(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  const id = positionals[0];
  if (!id) throw usage("Missing database id", "Run `notion-axi db view <id>`");
  const source = strFlag(flags.source);

  const notion = getClient();
  const r = await resolve(id, source);
  const ds: Obj = await call(() =>
    notion.dataSources.retrieve({ data_source_id: r.dsId }),
  );

  const schema = Object.entries(ds.properties ?? {}).map(([name, prop]) => ({
    name,
    type: (prop as Obj).type,
  }));

  return {
    database: {
      id: r.dbId ?? id,
      title: r.dbTitle ?? (richTextToPlain(ds.title) || "(untitled)"),
      url: r.dbUrl ?? ds.url,
    },
    data_sources:
      r.sources.length > 0 ? r.sources : [{ id: r.dsId, name: "(default)" }],
    schema,
    properties: schema.length,
    help: [`Run \`notion-axi db query ${id}\` to list rows`],
  };
}

async function dbQuery(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  const id = positionals[0];
  if (!id) throw usage("Missing database id", "Run `notion-axi db query <id>`");
  const source = strFlag(flags.source);
  const limit = intFlag(flags.limit, 25);
  const full = flags.full === true;

  const notion = getClient();
  const r = await resolve(id, source);
  const ds: Obj = await call(() =>
    notion.dataSources.retrieve({ data_source_id: r.dsId }),
  );

  const names = Object.keys(ds.properties ?? {});
  const titleName = names.find((n) => ds.properties[n]?.type === "title");
  const others = names.filter((n) => n !== titleName);
  const asked = listFlag(flags.fields);
  const unknown = asked.filter((n) => !names.includes(n));
  if (unknown.length) {
    throw usage(
      `Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
      `Run \`notion-axi db view ${id}\` to see valid column names`,
    );
  }
  const requested = asked.filter((n) => n !== titleName);
  const cols = requested.length
    ? requested
    : full
      ? others
      : others.slice(0, 3);

  const res: Obj = await call(() =>
    notion.dataSources.query({
      data_source_id: r.dsId,
      page_size: Math.min(limit, 100),
    }),
  );
  const pages = (res.results ?? []).slice(0, limit);

  const rows = pages.map((p: Obj) => {
    const row: Obj = { id: p.id };
    if (titleName) row.title = propertyValue(p.properties?.[titleName]);
    for (const c of cols) row[c] = propertyValue(p.properties?.[c]);
    return row;
  });

  if (rows.length === 0) {
    return {
      rows: [],
      result: "0 rows in this database",
      help: [`Run \`notion-axi db view ${id}\` to inspect the schema`],
    };
  }

  return {
    rows,
    count: rows.length,
    has_more: res.has_more ?? false,
    columns_shown: (titleName ? 1 : 0) + cols.length,
    help: [
      "Run `notion-axi page view <id>` to open a row",
      !full && requested.length === 0 && others.length > cols.length
        ? `Run \`notion-axi db query ${id} --full\` to see all ${others.length} columns`
        : undefined,
      res.has_more && limit < 100
        ? "Raise the cap with `--limit <n>` for more"
        : undefined,
    ].filter(Boolean),
  };
}

async function dbCreate(args: string[]) {
  const { flags } = parseArgs(args);
  const parent = strFlag(flags.parent);
  const title = strFlag(flags.title);
  if (!parent) {
    throw usage(
      "Missing --parent",
      "Run `notion-axi db create --parent <page_id> --title <name>`",
    );
  }
  if (!title) {
    throw usage(
      "Missing --title",
      "Run `notion-axi db create --parent <page_id> --title <name>`",
    );
  }

  const properties: Obj = {};
  let hasTitle = false;
  for (const [name, type] of parseProps(collectFlag(args, "prop"), "prop")) {
    properties[name] = buildPropertySchema(type);
    if (type === "title") hasTitle = true;
  }
  if (!hasTitle) properties.Name = { title: {} };

  const notion = getClient();
  const db: Obj = await call(() =>
    notion.databases.create({
      parent: { type: "page_id", page_id: parent },
      title: [{ text: { content: title } }],
      initial_data_source: { properties },
    } as any),
  );
  const dsId = db.data_sources?.[0]?.id;
  return {
    created: db.id,
    data_source: dsId,
    title,
    url: db.url,
    help: [
      `Run \`notion-axi db view ${db.id}\` to see the schema`,
      `Run \`notion-axi page create --parent ${dsId} --title <text> --db\` to add a row`,
    ],
  };
}

async function dbEdit(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  const id = positionals[0];
  if (!id) {
    throw usage(
      "Missing database id",
      "Run `notion-axi db edit <id> --add Name:type`",
    );
  }
  const source = strFlag(flags.source);
  const adds = parseProps(collectFlag(args, "add"), "add");
  const removes = collectFlag(args, "remove");
  if (adds.length === 0 && removes.length === 0) {
    throw usage(
      "Nothing to change",
      "Run `notion-axi db edit <id> --add Name:type` to add a property",
      "Run `notion-axi db edit <id> --remove Name` to remove one",
    );
  }

  const notion = getClient();
  const r = await resolve(id, source);
  const properties: Obj = {};
  for (const [name, type] of adds) properties[name] = buildPropertySchema(type);
  for (const name of removes) properties[name] = null;

  await call(() =>
    notion.dataSources.update({
      data_source_id: r.dsId,
      properties,
    } as any),
  );
  return {
    updated: r.dsId,
    added: adds.map(([n]) => n),
    removed: removes,
    help: [`Run \`notion-axi db view ${id}\` to confirm`],
  };
}
