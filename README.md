<h1 align="center">notion-axi</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/notion-axi"><img alt="npm" src="https://img.shields.io/npm/v/notion-axi?style=flat-square" /></a>
  <a href="https://github.com/maximebrmd/notion-axi/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/maximebrmd/notion-axi/ci.yml?style=flat-square&label=ci" /></a>
  <a href="https://github.com/maximebrmd/notion-axi/actions/workflows/release-please.yml"><img alt="Release" src="https://img.shields.io/github/actions/workflow/status/maximebrmd/notion-axi/release-please.yml?style=flat-square&label=release" /></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square" />
  <a href="https://opensource.org/licenses/MIT"><img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" /></a>
</p>

Notion CLI for agents — designed with [AXI](https://github.com/kunchenguid/axi) (Agent eXperience Interface).

Wraps the official [`@notionhq/client`](https://www.npmjs.com/package/@notionhq/client) with token-efficient [TOON](https://toonformat.dev/) output, contextual next-step suggestions, and structured error handling. Built for autonomous agents that interact with Notion via shell execution.

## Quick Start

Install the notion-axi skill in the [Agent Skills](https://agentskills.io) format with [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add maximebrmd/notion-axi --skill notion-axi -g
```

That is the entire setup — no global install needed. The skill teaches your agent to run notion-axi through `npx -y notion-axi`, so the CLI comes along on demand.

You still need a Notion token (Node 20+ required). The quickest is a **Personal Access Token** — no page-sharing required:

1. Create one at <https://www.notion.so/developers/tokens> → **New personal access token** → capabilities **Notion API**.
2. Export it: `export NOTION_TOKEN=ntn_xxxxxxxx`.

That's it — a PAT acts as you, so it can already see everything you can. See [Authentication](#authentication) for the alternative (an internal integration) and the trade-offs.

`-g` installs the skill for all projects (`~/.claude/skills/`); drop it to install for the current project only (`.claude/skills/`).

## Other Ways to Install

The skill is the recommended path, but it is not the only one.

### Zero setup

notion-axi is an AXI, so any capable agent can run the CLI directly with nothing installed at all. Just tell your agent:

```
Execute `npx -y notion-axi` to get Notion tools (set NOTION_TOKEN first).
```

### Session hook

Want ambient Notion context — recently edited pages and databases — fed into every agent session instead of loading on demand? Install the CLI globally and opt into the hook:

```sh
npm install -g notion-axi
notion-axi setup hooks
```

This installs a `SessionStart` hook for **Claude Code**, **Codex**, and **OpenCode** that surfaces recent workspace state at the start of each session. **Restart your agent session after running this** so the new hook takes effect.

## Authentication

notion-axi reads a Notion token from `NOTION_TOKEN` (or `NOTION_API_KEY`). Each user supplies their **own** token — notion-axi never ships one, so it only ever touches _your_ workspace. Two kinds of token work, used identically:

### Personal Access Token — recommended

A [PAT](https://developers.notion.com/guides/get-started/personal-access-tokens) is a user-scoped token that **acts as you**: it can already access everything you can in Notion, with **no page-sharing step**. Ideal for a personal CLI / agent.

1. <https://www.notion.so/developers/tokens> → **New personal access token** → name it, pick the workspace, capabilities **Notion API**.
2. `export NOTION_TOKEN=ntn_…` (in your shell profile, or a local `.env`).

> A PAT expires after a year and inherits all of your permissions — store it like a password and never commit it. Note: Notion blocks PATs from listing workspace users, so `notion-axi users` needs an internal integration instead.

### Internal integration

An [internal integration](https://www.notion.so/my-integrations) is a workspace-scoped bot with a static secret. It only sees pages **explicitly shared** with it (via a page's `•••` → **Connections**), which is useful when you want to scope access narrowly.

1. <https://www.notion.so/my-integrations> → **New integration** (internal) → copy the secret.
2. `export NOTION_TOKEN=ntn_…`
3. Share each page/database with the integration.

> Why not OAuth? Public/OAuth connections require a hosted backend holding a client secret (Notion's token exchange is a confidential client with no PKCE) — that's a service to run, not something a distributable `npx` CLI can do. A PAT gives the same "acts as you" result with zero infrastructure.

## Usage

```bash
notion-axi                                   # home — recently edited pages & databases
notion-axi search "Q3 planning" --type page  # search pages and databases
notion-axi page view <id>                    # page properties + markdown body
notion-axi page view <id> --full             # full body, no truncation
notion-axi db view <id>                      # database data sources & schema
notion-axi db query <id> --limit 50          # database rows as a table
notion-axi db query <id> --fields Stage,Owner # pick specific columns
notion-axi page create --parent <id> --title "Meeting notes" --content "# Agenda"
notion-axi page create --parent <id> --title "Spec" --content-file ./spec.md
notion-axi page create --parent <id> --title "Ship v2" --db   # new row in a database
notion-axi page update <id> --append "## Follow-ups"
notion-axi page update <id> --set Status=Done --set "Due=2026-07-01"  # set row properties
notion-axi page archive <id>                  # trash a page (--restore to undo)
notion-axi page move <id> --to <parent_id>    # reparent a page
notion-axi db create --parent <page_id> --title Tasks --prop Stage:select --prop Due:date
notion-axi db edit <id> --add Priority:select --remove OldField
notion-axi comments add <id> "Looks good — shipping"
notion-axi whoami                             # token identity (integration vs PAT)
notion-axi file upload ./diagram.png --attach <page_id>   # upload + attach a file
notion-axi api post search --body '{"query":"roadmap"}'  # raw endpoint escape hatch
notion-axi setup hooks                        # install optional agent session hooks
```

Page bodies are markdown (via the Notion API), so `--content`, `--append`, and `--replace` all take markdown — or read it from a file with `--content-file` / `--append-file` / `--replace-file`. For `db` commands, `<id>` may be a database **or** a data-source id — a database resolves to its first data source automatically (use `--source <id>` to target a specific one). Use `api` for anything the dedicated commands don't cover (file uploads, complex filters).

### Commands

| Command    | Description                                                            |
| ---------- | ---------------------------------------------------------------------- |
| `search`   | Search pages & databases (`--fields url` to widen)                     |
| `page`     | Pages — `view`, `create`, `update` (body + `--set`), `archive`, `move` |
| `db`       | Databases — `view`, `query`, `create`, `edit` (schema)                 |
| `users`    | List workspace users (internal integration only)                       |
| `comments` | `list` / `add` page comments                                           |
| `whoami`   | Show the token's identity (integration vs PAT) and workspace           |
| `api`      | Call any Notion REST endpoint directly (escape hatch)                  |
| `setup`    | Install optional agent session hooks                                   |

### Global flags

- `--help` — show help for any command (`notion-axi <command> --help`)
- `-v`, `-V`, `--version` — show the installed `notion-axi` version

### Output & exit codes

- All structured output is **TOON on stdout**; logs never pollute it.
- Exit `0` success (including idempotent no-ops), `1` runtime/API error, `2` usage error.
- Errors are structured: `error`, `code`, and a `help` list of fixes.

## Development

```sh
pnpm install
pnpm run build        # compile TypeScript to dist/
pnpm run build:skill  # regenerate skills/notion-axi/SKILL.md from src/skill.ts
pnpm run dev          # run the CLI directly with tsx
pnpm run lint         # eslint
pnpm test             # vitest with coverage (100% thresholds enforced)
```

The committed `skills/notion-axi/SKILL.md` is generated by `pnpm run build:skill`; CI fails (`build:skill -- --check`) if it drifts. The npm package ships `skills/notion-axi/`, so published releases include the installable Agent Skill documented in Quick Start.

## License

MIT © Maxime Bourmaud
