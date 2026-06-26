import { AxiError } from "../errors.js";
import { objectTitle, shortDate, type Obj } from "../format.js";
import { ntnApi } from "../ntn.js";

/** Content-first home view: recently edited pages & databases. */
export async function homeCommand() {
  let res: Obj;
  try {
    res = await ntnApi("v1/search", {
      method: "POST",
      body: {
        page_size: 10,
        sort: { timestamp: "last_edited_time", direction: "descending" },
      },
    });
  } catch (e) {
    if (e instanceof AxiError && e.code === "NTN_NOT_INSTALLED") {
      return {
        status: "the Notion CLI (ntn) is not installed",
        setup: [
          "1. Install it: curl -fsSL https://ntn.dev | bash",
          "2. Connect your workspace: ntn login",
        ],
        help: ["Run `notion-axi --help` to see all commands"],
      };
    }
    if (e instanceof AxiError && e.code === "AUTH_REQUIRED") {
      return {
        status: "not logged in to Notion",
        setup: [
          "1. Run: ntn login (opens a browser; token is stored in your OS keychain)",
          "2. Or export NOTION_API_TOKEN with a Notion token",
        ],
        help: ["Run `notion-axi --help` to see all commands"],
      };
    }
    throw e;
  }

  const recent = (res.results ?? []).map((r: Obj) => ({
    id: r.id,
    title: objectTitle(r),
    type: r.object === "data_source" ? "database" : r.object,
    edited: shortDate(r.last_edited_time),
  }));

  if (recent.length === 0) {
    return {
      recent: [],
      result: "Nothing in this workspace yet",
      help: ["Create a page in Notion, then run `notion-axi search <query>`"],
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
