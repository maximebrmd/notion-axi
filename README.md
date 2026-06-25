# notion-axi

An **[AXI](https://github.com/kunchenguid/axi)** (Agent eXperience Interface) for Notion — a CLI built for AI agents, not humans. It returns compact [TOON](https://github.com/toon-format/toon) output, minimal field schemas, truncated bodies with `--full` escape hatches, pre-computed counts, definitive empty states, and next-step suggestions — so an agent gets what it needs in one call with a small token bill.

Built on [`axi-sdk-js`](https://www.npmjs.com/package/axi-sdk-js) and the official [`@notionhq/client`](https://www.npmjs.com/package/@notionhq/client) (Notion API `2025-09-03`, with data-source support).

## Install

```sh
npm install -g notion-axi
# or run without installing
npx notion-axi
```

From source:

```sh
git clone https://github.com/maximebrmd/notion-axi
cd notion-axi
pnpm install && pnpm run build
node dist/cli.js
```

## Auth

`notion-axi` authenticates with a Notion **internal integration** token — the only non-interactive auth that suits an agent.

1. Create an internal integration at <https://www.notion.so/my-integrations>.
2. Copy the **Internal Integration Secret** and export it:
   ```sh
   export NOTION_TOKEN=ntn_xxxxxxxxxxxx
   ```
3. **Share** each page or database you want to reach with the integration:
   open it in Notion → `•••` menu → **Connections** → add your integration.

> An integration only sees content explicitly shared with it. A "not found" error almost always means the object hasn't been shared.

## Usage

Run with no arguments for a content-first home view (recently edited pages & databases):

```sh
notion-axi
```

```
bin: notion-axi
description: Agent eXperience Interface for Notion — search, read, and write pages & databases.
recent[3]{id,title,type,edited}:
  24f1...,Product roadmap,page,2026-06-24
  1f0a...,Tasks,database,2026-06-23
  9ab2...,Meeting notes,page,2026-06-22
count: 3
help[3]: ...
```

### Commands

| Command | Description |
|---|---|
| `search <query> [--type page\|db] [--limit n]` | Search pages & databases, newest first |
| `page view <id> [--full]` | Page properties + markdown body (previewed to ~1500 chars) |
| `page create --parent <id> --title <text> [--content <md>] [--db]` | Create a page under a page, or a row in a database (`--db`) |
| `page update <id> (--append <md> \| --replace <md>)` | Append to or overwrite a page's content |
| `db view <id> [--source <ds_id>]` | Database data sources + property schema |
| `db query <id> [--limit n] [--full] [--source <ds_id>]` | List rows as a table (title + 3 columns by default) |
| `users [--limit n]` | List workspace users |
| `setup hooks` | Install agent session-start hooks |
| `update`-style basics | `--help`, `--version` are built in |

Every command supports `--help` with its own flags and examples.

### Examples

```sh
notion-axi search "Q3 planning" --type page
notion-axi page view 24f1e2a3b4c5d6e7f8
notion-axi page view 24f1e2a3b4c5d6e7f8 --full
notion-axi page create --parent 24f1... --title "Meeting notes" --content "# Agenda"
notion-axi page create --parent 1f0a... --title "Ship v2" --db          # new row in a database
notion-axi page update 24f1... --append "## Follow-ups\n- email the team"
notion-axi db view 1f0a...
notion-axi db query 1f0a... --limit 50 --full
```

`<id>` accepts the IDs returned by `search` / `db query`. For `db` commands, the id may be a database **or** a data-source id — `notion-axi` resolves a database to its first data source automatically (use `--source` to target a specific one).

## Use with coding agents

Add this line to your `CLAUDE.md` or `AGENTS.md`:

> Use `notion-axi` for Notion (search, read pages/databases, create & update pages).

Optionally install session hooks so agents load a compact workspace view automatically at session start:

```sh
notion-axi setup hooks
```

This writes opt-in `SessionStart` hooks for Claude Code / Codex and a managed plugin for OpenCode.

## Output & exit codes

- All structured output is **TOON on stdout**; logs never pollute it.
- Exit `0` success (including idempotent no-ops), `1` runtime/API error, `2` usage error.
- Errors are structured: `error`, `code`, and a `help` list of fixes.

## Development

```sh
pnpm install
pnpm run build      # tsc → dist/, makes the bin executable
node dist/cli.js    # run locally
```

## License

MIT © Maxime Bourmaud
