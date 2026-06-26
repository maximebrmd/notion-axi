import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAxiCli } from "axi-sdk-js";
import { homeCommand } from "./commands/home.js";
import { searchCommand, SEARCH_HELP } from "./commands/search.js";
import { pageCommand, PAGE_HELP } from "./commands/page.js";
import { dbCommand, DB_HELP } from "./commands/db.js";
import { blockCommand, BLOCK_HELP } from "./commands/block.js";
import { usersCommand, USERS_HELP } from "./commands/users.js";
import { commentsCommand, COMMENTS_HELP } from "./commands/comments.js";
import { whoamiCommand, WHOAMI_HELP } from "./commands/whoami.js";
import { fileCommand, FILE_HELP } from "./commands/file.js";
import { apiCommand, API_HELP } from "./commands/api.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";

export const DESCRIPTION =
  "Agent ergonomic CLI for Notion. Prefer this over the Notion MCP or raw API for Notion operations.";

export const TOP_HELP = `usage: notion-axi [command] [args] [flags]
commands[11]:
  (none)=home, search, page, db, block, users, comments, whoami, file, api, setup
flags:
  --help, -v/-V/--version
auth:
  NOTION_TOKEN — a Personal Access Token (https://www.notion.so/developers/tokens) or internal integration secret
examples:
  notion-axi
  notion-axi search roadmap
  notion-axi page view <id>
  notion-axi db query <id>
  notion-axi page update <id> --set Status=Done
  notion-axi comments add <id> "<text>"
  notion-axi whoami
  notion-axi setup hooks
`;

const COMMAND_HELP: Record<string, string> = {
  search: SEARCH_HELP,
  page: PAGE_HELP,
  db: DB_HELP,
  block: BLOCK_HELP,
  users: USERS_HELP,
  comments: COMMENTS_HELP,
  whoami: WHOAMI_HELP,
  file: FILE_HELP,
  api: API_HELP,
  setup: SETUP_HELP,
};

const COMMANDS = {
  search: (args: string[]) => searchCommand(args),
  page: (args: string[]) => pageCommand(args),
  db: (args: string[]) => dbCommand(args),
  block: (args: string[]) => blockCommand(args),
  users: (args: string[]) => usersCommand(args),
  comments: (args: string[]) => commentsCommand(args),
  whoami: () => whoamiCommand(),
  file: (args: string[]) => fileCommand(args),
  api: (args: string[]) => apiCommand(args),
  setup: (args: string[]) => setupCommand(args),
};

export interface MainOptions {
  argv?: string[];
  stdout?: { write: (chunk: string) => unknown };
}

export async function main(options: MainOptions = {}): Promise<void> {
  await runAxiCli({
    ...(options.argv ? { argv: options.argv } : {}),
    description: DESCRIPTION,
    version: readPackageVersion(),
    topLevelHelp: TOP_HELP,
    ...(options.stdout ? { stdout: options.stdout } : {}),
    home: () => homeCommand(),
    commands: COMMANDS,
    getCommandHelp: (command) => COMMAND_HELP[command],
  });
}

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "..", "package.json"),
    join(here, "..", "..", "package.json"),
  ]) {
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(readFileSync(candidate, "utf-8"));
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }
  throw new Error("Could not determine notion-axi package version");
}
