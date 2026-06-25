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

notion-axi reads \`NOTION_TOKEN\` from the environment — either a Personal Access Token (recommended; acts as the user and needs no page-sharing, created at https://www.notion.so/developers/tokens) or an internal integration secret. If a command fails with an authentication error, ask the user to create a token, export \`NOTION_TOKEN\`, and — for an internal integration — share the relevant pages/databases with it (••• → Connections).

## When to use

Use notion-axi whenever a task touches Notion: searching for pages or databases; reading a page's properties and content; creating a page under another page or as a database row; appending to or replacing a page's content; inspecting a database's schema; or listing database rows.

## Workflow

1. Run \`npx -y notion-axi\` with no arguments for a content-first view of recently edited pages and databases.
2. \`search <query>\` to find an item, then note its \`id\`.
3. \`page view <id>\` reads properties and the markdown body (previewed to ~1500 chars; add \`--full\` for everything).
4. \`db view <id>\` shows a database's schema; \`db query <id>\` lists rows (title + 3 columns; \`--full\` for all, \`--limit <n>\` for more).
5. \`page create --parent <id> --title <text>\` creates a page; add \`--db\` when \`--parent\` is a database id, and \`--content <markdown>\` to seed the body.
6. \`page update <id> --append <markdown>\` (or \`--replace\`) edits content. For long bodies, use \`--content-file\`/\`--append-file\`/\`--replace-file <path>\`.
7. \`api <method> <path> [--body <json>]\` calls any Notion REST endpoint directly — an escape hatch for anything the dedicated commands don't cover.
8. Every response ends with contextual next-step hints under \`help:\` — follow them.

## Commands

\`\`\`
commands[7]:
  (none)=home, search, page, db, users, api, setup
  page subcommands: view, create, update
  db subcommands: view, query
\`\`\`

Run \`npx -y notion-axi --help\` for global flags, or \`npx -y notion-axi <command> --help\` for per-command usage.

## Tips

- Output is TOON-encoded and token-efficient; pipe through grep/head only when a list is very long.
- A Personal Access Token (recommended) acts as you and needs no page-sharing; an internal integration only sees pages explicitly shared with it (a "not found" error usually means it wasn't shared).
- For \`db\` commands, \`<id>\` may be a database or a data-source id; a database resolves to its first data source automatically (use \`--source <id>\` to target a specific one).
- Lists are minimal by default — add \`--fields url\` (search) or \`--fields a,b\` (db query) to widen, or \`--full\` for all database columns.
- Page bodies are markdown via the Notion API, so \`--append\`/\`--replace\` and \`--content\` all take markdown (or read it from a file with the \`--*-file\` flags).
- Exit codes: 0 success, 1 error, 2 usage. Errors are structured with an \`error\`, \`code\`, and \`help\` list.
`;
}
