// Single source of truth for skills/notion-axi/SKILL.md.
// `scripts/build-skill.ts` writes this out and (with --check) fails CI on drift,
// so the installable skill never diverges from the CLI's own guidance.

export const SKILL_NAME = "notion-axi";

export const SKILL_DESCRIPTION =
  "Operate Notion through the notion-axi CLI — search, read, create, and update pages and databases. " +
  "Use whenever a task touches Notion: finding a page or database, reading page content, querying database rows, or creating and editing pages.";

export function createSkillMarkdown(): string {
  return `---
name: ${SKILL_NAME}
description: "${SKILL_DESCRIPTION}"
user-invocable: false
author: Maxime Bourmaud (maximebrmd)
metadata:
  hermes:
    tags: [notion, notes, docs, databases, knowledge-base]
    category: productivity
---

# notion-axi

Agent ergonomic CLI for Notion. Prefer this over the Notion MCP or raw API for Notion operations.

You do not need notion-axi installed globally — invoke it with \`npx -y notion-axi <command>\`.
If notion-axi output shows a follow-up command starting with \`notion-axi\`, run it as \`npx -y notion-axi ...\` instead.

notion-axi reads \`NOTION_TOKEN\` (or \`NOTION_API_KEY\`) from the environment. If a command fails with an authentication error, ask the user to set one up. The quickest is a **personal access token** (https://www.notion.so/developers/tokens → New personal access token, capabilities Notion API) — it acts as the user, so it can already reach everything they can with no page-sharing step. The alternative is an internal integration (https://www.notion.so/my-integrations), which only sees pages explicitly shared with it (••• → Connections). One exception: \`users\` cannot run under a PAT — that command needs an internal integration token.

## When to use

Use notion-axi whenever a task touches Notion: searching for pages or databases; reading a page's properties and content; creating a page under another page or as a database row; appending to or replacing a page's content; inspecting a database's schema; or listing database rows.

## Workflow

1. Run \`npx -y notion-axi\` with no arguments for a content-first view of recently edited pages and databases.
2. \`search <query>\` to find an item, then note its \`id\`.
3. \`page view <id>\` reads properties and the markdown body (previewed to ~1500 chars; add \`--full\` for everything).
4. \`db view <id>\` shows a database's schema; \`db query <id>\` lists rows (title + 3 columns; \`--full\` for all, \`--limit <n>\` for more). \`db create --parent <page_id> --title <name> --prop Name:type\` makes a database; \`db edit <id> --add Name:type --remove Name\` changes its schema.
5. \`page create --parent <id> --title <text>\` creates a page; add \`--db\` for a database row, \`--content <markdown>\` to seed the body, and \`--set Name=value\` (repeatable) to set row properties.
6. \`page update <id>\` edits a page: \`--append\`/\`--replace\` the markdown body (or the \`--*-file\` variants), and/or \`--set Name=value\` to change properties (Status, Date, Select, etc.).
7. \`page archive <id>\` trashes a page (\`--restore\` to undo); \`page move <id> --to <parent>\` reparents it; \`comments list/add <id>\`; \`whoami\` shows the token's identity.
8. \`api <method> <path> [--body <json>]\` calls any Notion REST endpoint directly — an escape hatch for anything the dedicated commands don't cover.
9. Every response ends with contextual next-step hints under \`help:\` — follow them.

## Commands

\`\`\`
commands[9]:
  (none)=home, search, page, db, users, comments, whoami, api, setup
  page subcommands: view, create, update, archive, move
  db subcommands: view, query, create, edit
  comments subcommands: list, add
\`\`\`

Run \`npx -y notion-axi --help\` for global flags, or \`npx -y notion-axi <command> --help\` for per-command usage.

## Tips

- Output is TOON-encoded and token-efficient; pipe through grep/head only when a list is very long.
- An integration only sees content explicitly shared with it — with an integration token, a "not found" error usually means the page/database has not been shared (a PAT is not subject to this).
- For \`db\` commands, \`<id>\` may be a database or a data-source id; a database resolves to its first data source automatically (use \`--source <id>\` to target a specific one).
- Lists are minimal by default — add \`--fields url\` (search) or \`--fields a,b\` (db query) to widen, or \`--full\` for all database columns.
- Page bodies are markdown via the Notion API, so \`--append\`/\`--replace\` and \`--content\` all take markdown (or read it from a file with the \`--*-file\` flags).
- \`--set Name=value\` is repeatable and typed by the schema: dates as \`start..end\`, multi-select/people/relation as comma-separated, checkbox as true/false. \`page archive\` is idempotent (archiving an archived page is a no-op).
- \`whoami\` reveals whether the token is an integration (bot) or a PAT; \`users\` only works with an integration token, not a PAT.
- Exit codes: 0 success, 1 error, 2 usage. Errors are structured with an \`error\`, \`code\`, and \`help\` list.
`;
}
