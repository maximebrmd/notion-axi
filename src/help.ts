export const TOP_LEVEL_HELP = `notion-axi — Agent eXperience Interface for Notion

USAGE
  notion-axi                      Recently edited pages & databases (content-first home)
  notion-axi <command> [args] [flags]

COMMANDS
  search <query>                  Search pages & databases
  page view <id>                  Read a page's properties + markdown body
  page create --parent <id> ...   Create a page under a page or database
  page update <id> --append ...   Append or replace a page's content
  db view <id>                    Show a database's data sources & schema
  db query <id>                   List database rows as a table
  users                           List workspace users
  setup hooks                     Install agent session-start hooks

AUTH
  Set NOTION_TOKEN to an internal integration secret (https://www.notion.so/my-integrations)
  and share the pages/databases you want to reach with that integration.

Run \`notion-axi <command> --help\` for details on any command.
`;

const COMMAND_HELP: Record<string, string> = {
  search: `notion-axi search <query> [flags]

Search pages and databases shared with the integration, newest first.

FLAGS
  --type <page|db>   Restrict to pages or databases
  --limit <n>        Max results (default 25)

EXAMPLES
  notion-axi search roadmap
  notion-axi search "Q3 planning" --type page
  notion-axi search tasks --type db --limit 50
`,
  page: `notion-axi page <view|create|update> ...

SUBCOMMANDS
  view <id> [--full]
      Show properties and the page body (markdown). Body is previewed to
      ~1500 chars unless --full is given.

  create --parent <id> --title <text> [--content <markdown>] [--db]
      Create a page. By default --parent is a page id; pass --db to create
      the page as a row inside a database (data source) id instead.

  update <id> (--append <markdown> | --replace <markdown>)
      Append markdown to the end of a page, or replace its entire content.

EXAMPLES
  notion-axi page view 24f1e2a3b4c5...
  notion-axi page create --parent 24f1... --title "Meeting notes" --content "# Agenda"
  notion-axi page create --parent 9ab2... --title "New task" --db
  notion-axi page update 24f1... --append "## Follow-ups\\n- ship it"
`,
  db: `notion-axi db <view|query> <id> [flags]

SUBCOMMANDS
  view <id> [--source <data_source_id>]
      List the database's data sources and property schema.

  query <id> [--limit <n>] [--full] [--source <data_source_id>]
      List rows as a table. Shows the title + first 3 columns by default;
      --full includes every column. <id> may be a database or data-source id.

EXAMPLES
  notion-axi db view 1f0a...
  notion-axi db query 1f0a... --limit 50
  notion-axi db query 1f0a... --full
`,
  users: `notion-axi users [--limit <n>]

List users visible to the integration (id, name, type, email).
`,
  setup: `notion-axi setup hooks

Install session-start hooks so coding agents (Claude Code, Codex, OpenCode)
load a compact Notion workspace view at the start of each session.
`,
};

export function getCommandHelp(command: string): string | null {
  return COMMAND_HELP[command] ?? null;
}
