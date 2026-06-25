import { isNotionClientError } from "@notionhq/client";
import {
  call,
  getClient,
  intFlag,
  objectTitle,
  parseArgs,
  propertyValue,
  richTextToPlain,
  usage,
  type Obj,
} from "../lib.js";

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
    default:
      throw usage(
        sub ? `Unknown db subcommand "${sub}"` : "Missing db subcommand",
        "Run `notion-axi db view <id>` to see the schema",
        "Run `notion-axi db query <id>` to list rows",
      );
  }
}

interface Resolved {
  dsId: string;
  sources: Array<{ id: string; name: string }>;
  dbId?: string;
  dbTitle?: string;
  dbUrl?: string;
}

/** Accept either a database id or a data-source id and resolve to a queryable
 * data source. A database may expose several data sources; default to the first. */
async function resolve(id: string, source?: string): Promise<Resolved> {
  const notion = getClient();
  if (source) return { dsId: source, sources: [] };
  try {
    const db: Obj = await notion.databases.retrieve({ database_id: id });
    const sources = (db.data_sources ?? []) as Array<{ id: string; name: string }>;
    if (sources.length === 0) {
      throw usage("That database has no data sources to query");
    }
    return { dsId: sources[0].id, sources, dbId: db.id, dbTitle: objectTitle(db), dbUrl: db.url };
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
  const source = typeof flags.source === "string" ? flags.source : undefined;

  const notion = getClient();
  const r = await resolve(id, source);
  const ds: Obj = await call(() => notion.dataSources.retrieve({ data_source_id: r.dsId }));

  const schema = Object.entries(ds.properties ?? {}).map(([name, prop]) => ({
    name,
    type: (prop as Obj).type,
  }));

  return {
    database: {
      id: r.dbId ?? id,
      title: r.dbTitle ?? richTextToPlain(ds.title) ?? "(untitled)",
      url: r.dbUrl ?? ds.url,
    },
    data_sources: r.sources.length > 0 ? r.sources : [{ id: r.dsId, name: "(default)" }],
    schema,
    properties: schema.length,
    help: [`Run \`notion-axi db query ${id}\` to list rows`],
  };
}

async function dbQuery(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  const id = positionals[0];
  if (!id) throw usage("Missing database id", "Run `notion-axi db query <id>`");
  const source = typeof flags.source === "string" ? flags.source : undefined;
  const limit = intFlag(flags.limit, 25);
  const full = flags.full === true;

  const notion = getClient();
  const r = await resolve(id, source);
  const ds: Obj = await call(() => notion.dataSources.retrieve({ data_source_id: r.dsId }));

  const names = Object.keys(ds.properties ?? {});
  const titleName = names.find((n) => ds.properties[n]?.type === "title");
  const others = names.filter((n) => n !== titleName);
  const cols = full ? others : others.slice(0, 3);

  const res: Obj = await call(() =>
    notion.dataSources.query({ data_source_id: r.dsId, page_size: Math.min(limit, 100) }),
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
      !full && others.length > cols.length
        ? `Run \`notion-axi db query ${id} --full\` to see all ${others.length} columns`
        : undefined,
      rows.length >= limit ? "Raise the cap with `--limit <n>`" : undefined,
    ].filter(Boolean),
  };
}
