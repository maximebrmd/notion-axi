import { collectFlag, intFlag, listFlag, parseArgs, strFlag } from "../args.js";
import { AxiError, usage } from "../errors.js";
import {
  buildPropertySchema,
  objectTitle,
  propertyValue,
  richTextToPlain,
  type Obj,
} from "../format.js";
import { ntnApi } from "../ntn.js";

export const DB_HELP = `usage: notion-axi db <view|query|create|edit> <id> [flags]

subcommands:
  view <id> [--source <data_source_id>]
      List the database's data sources and property schema.

  query <id> [--limit <n>] [--full] [--fields <list>] [--source <id>]
            [--filter <json>] [--where Name=value ...] [--sort Field:asc|desc ...]
            [--cursor <c>]
      List rows as a table. Shows the title + first 3 columns by default;
      --full includes every column, or --fields <a,b> picks specific ones.
      Server-side selection (narrows before rows are fetched):
        --filter <json>   Raw Notion filter object, forwarded verbatim.
        --where Name=val  Sugar compiled from the schema (repeatable, AND-ed):
                          select/status/url/email/phone → equals, number →
                          equals, checkbox → bool equals, date → equals,
                          title/rich_text/multi_select/people/relation → contains.
        --sort Field:dir  Sort by a property (repeatable). dir is asc (default)
                          or desc; created_time/last_edited_time sort by timestamp.
        --cursor <c>      Resume paging from a prior response's next_cursor.
      --filter and --where are mutually exclusive (passing both exits 2); use
      --filter when you need a raw filter condition. When has_more is true the
      response carries next_cursor.

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
  notion-axi db query 1f0a... --where Status=Todo --sort Due:asc
  notion-axi db query 1f0a... --filter '{"property":"Done","checkbox":{"equals":false}}'
  notion-axi db query 1f0a... --cursor <next_cursor>   # continue paging
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

/** Compile repeatable `--sort Field:asc|desc` entries into the API `sorts`
 * array. `created_time`/`last_edited_time` become timestamp sorts; everything
 * else sorts by property. Direction defaults to ascending. */
function buildSorts(entries: string[]): Obj[] {
  return entries.map((e) => {
    const i = e.lastIndexOf(":");
    const field = (i < 0 ? e : e.slice(0, i)).trim();
    const raw = (i < 0 ? "" : e.slice(i + 1)).trim().toLowerCase();
    if (!field) throw usage(`--sort needs a field (got "${e}")`);
    let direction: string;
    if (raw === "" || raw === "asc" || raw === "ascending") {
      direction = "ascending";
    } else if (raw === "desc" || raw === "descending") {
      direction = "descending";
    } else {
      throw usage(
        `--sort direction must be asc or desc (got "${raw}")`,
        `e.g. --sort ${field}:desc`,
      );
    }
    return field === "created_time" || field === "last_edited_time"
      ? { timestamp: field, direction }
      : { property: field, direction };
  });
}

/** Build a single-property filter condition for `--where Name=value`, typed by
 * the property's schema. Types that have no sensible `=` mapping are rejected
 * with a pointer to raw `--filter`. */
function whereCondition(type: string, value: string, name: string): Obj {
  switch (type) {
    case "title":
    case "rich_text":
    case "multi_select":
    case "people":
    case "relation":
      return { property: name, [type]: { contains: value } };
    case "select":
    case "status":
    case "url":
    case "email":
    case "phone_number":
    case "date":
      return { property: name, [type]: { equals: value } };
    case "number": {
      const n = Number(value);
      if (Number.isNaN(n))
        throw usage(`--where ${name}: "${value}" is not a number`);
      return { property: name, number: { equals: n } };
    }
    case "checkbox":
      return {
        property: name,
        checkbox: { equals: /^(true|yes|1|done|checked)$/i.test(value) },
      };
    default:
      throw usage(
        `--where can't filter on property type "${type}" (${name})`,
        "Use --filter <json> for a raw Notion filter condition",
      );
  }
}

/** Compile repeatable `--where Name=value` entries into a Notion `filter`,
 * AND-ing multiple clauses. Unknown property names are rejected with the valid
 * list. */
function buildWhere(entries: string[], schema: Obj, id: string): Obj {
  const clauses = entries.map((e) => {
    const i = e.indexOf("=");
    if (i < 0) {
      throw usage(
        `--where must be Name=value (got "${e}")`,
        `Run \`notion-axi db query ${id} --where Status=Todo\``,
      );
    }
    const name = e.slice(0, i).trim();
    const value = e.slice(i + 1).trim();
    const type = schema[name]?.type;
    if (!type) {
      throw usage(
        `Unknown property: ${name}`,
        `Valid names: ${Object.keys(schema).join(", ")}`,
        `Run \`notion-axi db view ${id}\` to see valid property names`,
      );
    }
    return whereCondition(type, value, name);
  });
  return clauses.length === 1 ? clauses[0] : { and: clauses };
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
  if (source) return { dsId: source, sources: [] };
  let db: Obj;
  try {
    db = await ntnApi(`v1/databases/${id}`);
  } catch (e) {
    // Not a database id — assume it is a data_source id. Only fall back when the
    // object genuinely wasn't found; auth/install/other errors must surface.
    if (e instanceof AxiError && e.code === "OBJECT_NOT_FOUND") {
      return { dsId: id, sources: [] };
    }
    throw e;
  }
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
}

async function dbView(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  const id = positionals[0];
  if (!id) throw usage("Missing database id", "Run `notion-axi db view <id>`");
  const source = strFlag(flags.source);

  const r = await resolve(id, source);
  const ds: Obj = await ntnApi(`v1/data_sources/${r.dsId}`);

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

  const r = await resolve(id, source);
  const ds: Obj = await ntnApi(`v1/data_sources/${r.dsId}`);

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

  const body: Obj = { page_size: Math.min(limit, 100) };
  const cursor = strFlag(flags.cursor);
  if (cursor) body.start_cursor = cursor;

  const whereEntries = collectFlag(args, "where");
  if (flags.filter !== undefined) {
    if (whereEntries.length) {
      throw usage(
        "Use either --filter or --where, not both",
        "--filter takes a raw Notion filter object; --where builds one from Name=value pairs",
      );
    }
    const raw = strFlag(flags.filter);
    if (raw === undefined) {
      throw usage(
        "--filter needs a JSON value",
        `e.g. --filter '{"property":"Status","select":{"equals":"Todo"}}'`,
      );
    }
    try {
      body.filter = JSON.parse(raw);
    } catch {
      throw usage(
        `--filter is not valid JSON: ${raw.slice(0, 80)}`,
        `Pass a raw Notion filter object, e.g. --filter '{"property":"Status","select":{"equals":"Todo"}}'`,
        `Run \`notion-axi db query ${id} --help\``,
      );
    }
  } else if (whereEntries.length) {
    body.filter = buildWhere(whereEntries, ds.properties ?? {}, id);
  }

  const sortEntries = collectFlag(args, "sort");
  if (sortEntries.length) body.sorts = buildSorts(sortEntries);

  const res: Obj = await ntnApi(`v1/data_sources/${r.dsId}/query`, {
    method: "POST",
    body,
  });
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

  const hasMore = res.has_more ?? false;
  const nextCursor = hasMore ? (res.next_cursor ?? null) : null;
  return {
    rows,
    count: rows.length,
    has_more: hasMore,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
    columns_shown: (titleName ? 1 : 0) + cols.length,
    help: [
      "Run `notion-axi page view <id>` to open a row",
      !full && requested.length === 0 && others.length > cols.length
        ? `Run \`notion-axi db query ${id} --full\` to see all ${others.length} columns`
        : undefined,
      nextCursor
        ? `Fetch the next page with \`notion-axi db query ${id} --cursor ${nextCursor}\``
        : undefined,
      hasMore && limit < 100
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

  const db: Obj = await ntnApi("v1/databases", {
    method: "POST",
    body: {
      parent: { type: "page_id", page_id: parent },
      title: [{ text: { content: title } }],
      initial_data_source: { properties },
    },
  });
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

  const r = await resolve(id, source);
  const properties: Obj = {};
  for (const [name, type] of adds) properties[name] = buildPropertySchema(type);
  for (const name of removes) properties[name] = null;

  await ntnApi(`v1/data_sources/${r.dsId}`, {
    method: "PATCH",
    body: { properties },
  });
  return {
    updated: r.dsId,
    added: adds.map(([n]) => n),
    removed: removes,
    help: [`Run \`notion-axi db view ${id}\` to confirm`],
  };
}
