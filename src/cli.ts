#!/usr/bin/env node
import { createRequire } from "node:module";
import { runAxiCli } from "axi-sdk-js";
import { call, getClient, objectTitle, shortDate, type Obj } from "./lib.js";
import { getCommandHelp, TOP_LEVEL_HELP } from "./help.js";
import { searchCommand } from "./commands/search.js";
import { pageCommand } from "./commands/page.js";
import { dbCommand } from "./commands/db.js";
import { usersCommand } from "./commands/users.js";
import { setupCommand } from "./commands/setup.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const DESCRIPTION = "Agent eXperience Interface for Notion — search, read, and write pages & databases.";

async function home() {
  if (!process.env.NOTION_TOKEN && !process.env.NOTION_API_KEY) {
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

await runAxiCli({
  description: DESCRIPTION,
  version: pkg.version,
  topLevelHelp: TOP_LEVEL_HELP,
  getCommandHelp,
  home,
  commands: {
    search: (args) => searchCommand(args),
    page: (args) => pageCommand(args),
    db: (args) => dbCommand(args),
    users: (args) => usersCommand(args),
    setup: (args) => setupCommand(args),
  },
});
