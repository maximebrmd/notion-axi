import { objectTitle, shortDate, type Obj } from "../format.js";
import { call, getClient, hasToken } from "../notion.js";

/** Content-first home view: recently edited pages & databases. */
export async function homeCommand() {
  if (!hasToken()) {
    return {
      status: "NOTION_TOKEN is not set",
      setup: [
        "1. Create an internal integration: https://www.notion.so/my-integrations",
        "2. export NOTION_TOKEN=ntn_...",
        "3. Share pages/databases with the integration (••• → Connections)",
      ],
      help: ["Run `notion-axi --help` to see all commands"],
    };
  }

  const notion = getClient();
  const res: Obj = await call(() =>
    notion.search({
      page_size: 10,
      sort: { timestamp: "last_edited_time", direction: "descending" },
    }),
  );

  const recent = (res.results ?? []).map((r: Obj) => ({
    id: r.id,
    title: objectTitle(r),
    type: r.object === "data_source" ? "database" : r.object,
    edited: shortDate(r.last_edited_time),
  }));

  if (recent.length === 0) {
    return {
      recent: [],
      result: "Nothing shared with this integration yet",
      help: [
        "Share a page/database in Notion → ••• → Connections → add your integration",
        "Then run `notion-axi search <query>`",
      ],
    };
  }

  return {
    recent,
    count: recent.length,
    help: [
      "Run `notion-axi search <query>` to find more",
      "Run `notion-axi page view <id>` to read a page",
      "Run `notion-axi db query <id>` to list database rows",
    ],
  };
}
