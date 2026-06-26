<h1 align="center">notion-axi</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/notion-axi"><img alt="npm" src="https://img.shields.io/npm/v/notion-axi?style=flat-square" /></a>
  <a href="https://github.com/maximebrmd/notion-axi/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/maximebrmd/notion-axi/ci.yml?style=flat-square&label=ci" /></a>
  <a href="https://github.com/maximebrmd/notion-axi/actions/workflows/release-please.yml"><img alt="Release" src="https://img.shields.io/github/actions/workflow/status/maximebrmd/notion-axi/release-please.yml?style=flat-square&label=release" /></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square" />
  <a href="https://opensource.org/licenses/MIT"><img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" /></a>
</p>

Notion CLI for agents — designed with [AXI](https://github.com/kunchenguid/axi) (Agent eXperience Interface).

Wraps the official [Notion CLI (`ntn`)](https://developers.notion.com/cli) with token-efficient [TOON](https://toonformat.dev/) output, contextual next-step suggestions, and structured error handling. `ntn` handles authentication and the API; notion-axi makes its output ergonomic for autonomous agents driving Notion via shell execution.

## Quick Start

**1. Install and log in to the Notion CLI** (Node 20+ also required):

```sh
curl -fsSL https://ntn.dev | bash   # installs `ntn`
ntn login                           # opens a browser; token is stored in your OS keychain
```

`ntn login` acts as you — it can already see everything you can, with no page-sharing step.

**2. Install the notion-axi skill** in the [Agent Skills](https://agentskills.io) format with [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add maximebrmd/notion-axi --skill notion-axi -g
```

That is the entire notion-axi setup — no global install needed. The skill teaches your agent to run notion-axi through `npx -y notion-axi`, which shells out to `ntn` under the hood.

`-g` installs the skill for all projects (`~/.claude/skills/`); drop it to install for the current project only (`.claude/skills/`).

## Other Ways to Install

The skill is the recommended path, but it is not the only one.

### Zero setup

notion-axi is an AXI, so any capable agent can run the CLI directly with nothing installed via npm. Once `ntn` is installed and logged in (see above), just tell your agent:

```
Execute `npx -y notion-axi` to get Notion tools.
```

### Session hook

Want ambient Notion context — recently edited pages and databases — fed into every agent session instead of loading on demand? Install the CLI globally and opt into the hook:

```sh
npm install -g notion-axi
notion-axi setup hooks
```

This installs a `SessionStart` hook for **Claude Code**, **Codex**, and **OpenCode** that surfaces recent workspace state at the start of each session. **Restart your agent session after running this** so the new hook takes effect.

## Authentication

notion-axi delegates authentication entirely to the official **Notion CLI (`ntn`)** — it never handles a token itself, so it only ever touches _your_ workspace.

### `ntn login` — recommended

```sh
curl -fsSL https://ntn.dev | bash
ntn login
```

`ntn login` opens a browser, authorizes a workspace, and stores the credential in your **OS keychain**. It **acts as you**, so it can already reach everything you can with **no page-sharing step** — and there is no token to copy, paste, or rotate. This is the same browser-OAuth model the Notion MCP uses, but with zero hosted infrastructure.

### `NOTION_API_TOKEN` — for CI / headless

For non-interactive environments where a browser login isn't possible, `ntn` (and therefore notion-axi) honors a token from the `NOTION_API_TOKEN` environment variable, which takes precedence over the keychain:

```sh
export NOTION_API_TOKEN=ntn_…   # a personal access token or internal integration secret
```

> One restriction carries over from the Notion API regardless of how you authenticate: listing workspace users requires elevated permissions, so `notion-axi users` is often `RESTRICTED_RESOURCE`.

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
notion-axi whoami                             # login identity (bot/user) and workspace
notion-axi file upload ./diagram.png --attach <page_id>   # upload + attach a file
notion-axi block list <page_id>               # a page's child blocks (ids + text)
notion-axi api post search --body '{"query":"roadmap"}'  # raw endpoint escape hatch
notion-axi setup hooks                        # install optional agent session hooks
```

Page bodies are markdown (via the Notion API), so `--content`, `--append`, and `--replace` all take markdown — or read it from a file with `--content-file` / `--append-file` / `--replace-file`. For `db` commands, `<id>` may be a database **or** a data-source id — a database resolves to its first data source automatically (use `--source <id>` to target a specific one). Use `api` for anything the dedicated commands don't cover (views, meeting notes, templates, paginated property items) — so the **entire Notion REST API** is reachable, not just the dedicated commands.

### Commands

| Command    | Description                                                            |
| ---------- | ---------------------------------------------------------------------- |
| `search`   | Search pages & databases (`--fields url` to widen)                     |
| `page`     | Pages — `view`, `create`, `update` (body + `--set`), `archive`, `move` |
| `db`       | Databases — `view`, `query`, `create`, `edit` (schema)                 |
| `block`    | Blocks — `list` a page's child blocks, `delete` one                    |
| `users`    | List workspace users or `get` one by id (needs elevated permissions)   |
| `comments` | `list` / `add` / `delete` page comments                                |
| `whoami`   | Show the login identity (bot vs user) and workspace                    |
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
