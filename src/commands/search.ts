import { call, getClient, intFlag, objectTitle, parseArgs, shortDate, usage, type Obj } from "../lib.js";

const TYPE_FILTER: Record<string, "page" | "data_source"> = {
  page: "page",
  pages: "page",
  db: "data_source",
  database: "data_source",
  databases: "data_source",
  data_source: "data_source",
};

export async function searchCommand(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  const query = positionals.join(" ").trim();
  const limit = intFlag(flags.limit, 25);

  let filter: { property: "object"; value: "page" | "data_source" } | undefined;
  if (flags.type) {
    const value = TYPE_FILTER[String(flags.type).toLowerCase()];
    if (!value) throw usage(`Unknown --type "${flags.type}"`, "Use --type page or --type db");
    filter = { property: "object", value };
  }

  const notion = getClient();
  const res: Obj = await call(() =>
    notion.search({
      query: query || undefined,
      filter,
      page_size: Math.min(limit, 100),
      sort: { timestamp: "last_edited_time", direction: "descending" },
    }),
  );

  const results = (res.results ?? []).slice(0, limit).map((r: Obj) => ({
    id: r.id,
    title: objectTitle(r),
    type: r.object === "data_source" ? "database" : r.object,
    edited: shortDate(r.last_edited_time),
  }));

  if (results.length === 0) {
    return {
      results: [],
      result: query
        ? `0 items match "${query}"${filter ? ` (type=${flags.type})` : ""}`
        : "0 items shared with this integration yet",
      help: [
        "Share pages/databases with your integration in Notion → ••• → Connections",
        "Try a broader query or drop --type",
      ],
    };
  }

  return {
    results,
    count: results.length,
    has_more: res.has_more ?? false,
    help: [
      "Run `notion-axi page view <id>` to read a page",
      "Run `notion-axi db query <id>` to list database rows",
      results.length >= limit ? "Raise the cap with `--limit <n>`" : undefined,
    ].filter(Boolean),
  };
}
