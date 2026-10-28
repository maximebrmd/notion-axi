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
notion-axi page export <id> --output notes.md # write raw Markdown
notion-axi db view <id>                      # database data sources & schema
notion-axi db query <id> --limit 50          # database rows as a table
notion-axi db query <id> --fields Stage,Owner # pick specific columns
notion-axi db query <id> --where Status=Todo --sort Due:asc  # filter + sort server-side
notion-axi db query <id> --filter '{"property":"Done","checkbox":{"equals":false}}'
notion-axi db query <id> --cursor <next_cursor>  # continue paging past has_more
notion-axi page create --parent <id> --title "Meeting notes" --content "# Agenda"
notion-axi page create --parent <id> --title "Spec" --content-file ./spec.md
notion-axi page create --parent <id> --title "Ship v2" --db   # new row in a database
notion-axi page update <id> --append "## Follow-ups"
cat notes.md | notion-axi page update <id> --replace-file -
notion-axi page update <id> --set Status=Done --set "Due=2026-07-01"  # set row properties
notion-axi page archive <id>                  # trash a page (--restore to undo)
notion-axi page move <id> --to <parent_id>    # reparent a page
notion-axi db create --parent <page_id> --title Tasks --prop Stage:select --prop Due:date
notion-axi db edit <id> --add Priority:select --remove OldField
notion-axi comments add <id> "Looks good — shipping"
notion-axi whoami                             # login identity (bot/user) and workspace
notion-axi file upload ./diagram.png --attach <page_id>   # upload + attach a file
notion-axi file list --status pending --limit 10 # filtered, paginated uploads
notion-axi file import https://example.com/report.pdf # asynchronous import
notion-axi file view <upload_id>              # status, expiry and import errors
notion-axi file attach <upload_id> --to <page_id> # attach after status is uploaded
notion-axi block list <page_id>               # a page's child blocks (ids + text)
notion-axi api post search --body '{"query":"roadmap"}'  # raw endpoint escape hatch
notion-axi api endpoints pages               # discover official API endpoints
notion-axi api docs v1/pages --method post    # official Markdown reference
notion-axi api schema v1/pages --method post  # reduced OpenAPI fragment
notion-axi workers                           # list Workers
notion-axi workers runs list                 # inspect recent runs
notion-axi workers sync trigger contacts --preview
notion-axi setup hooks                        # install optional agent session hooks
```

Page bodies are Markdown. The `--content-file` / `--append-file` / `--replace-file` flags accept a path or `-` for stdin. Append and replace are mutually exclusive. Replacement preserves child pages and databases by default; `--allow-deleting-content` explicitly permits deleting them. Use that flag only when the user authorizes deletion. Export with `page export <id> --output page.md`; existing files require `--force`, and the TOON result reports partial Markdown and unknown block IDs returned by Notion.

For `db` commands, `<id>` may be a database **or** a data-source id — a database resolves to its first data source automatically (use `--source <id>` to target a specific one). Use `api` for other REST resources. `--body-file <path|->` accepts JSON files/stdin, and `--notion-version` overrides the version for a request or discovery command. API docs/schema output is previewed to 6,000 characters; `--full` returns the complete response. Endpoint listing supports a search term, `--method`, and `--limit` (default 25).

URL imports are asynchronous. Check `file view <upload_id>` until status is `uploaded` before attaching. Failed or expired uploads need a new upload. `file list` returns `next_cursor` for `--cursor`, supports server-side `--status`, and uses four fields per upload by default (`--full` expands them).

Workers use native `ntn workers` syntax for inspection, scaffolding, deployment, execution, syncs, environment variables, database bindings, webhooks and OAuth. Use `workers --help` for the command reference. `--workers-config-file` selects a project/workspace; `--worker-id` works where supported upstream. `workers exec --data-file <path|->` accepts JSON files/stdin. List previews default to 10 items with `--limit`, `--fields`, and `--full` controls; these are local preview limits. Other responses are bounded to 6,000 characters. Sync status prints once and exits. Delete, database attach/detach, and env pull/push require explicit `--yes`. Keep `ntn` updated for the latest subcommands; TUI and streaming remain available directly through `ntn`.

### Commands

| Command    | Description                                                                      |
| ---------- | -------------------------------------------------------------------------------- |
| `search`   | Search pages & databases (`--fields url` to widen)                               |
| `page`     | Pages — `view`, `export`, `create`, `update` (body + `--set`), `archive`, `move` |
| `db`       | Databases — `view`, `query`, `create`, `edit` (schema)                           |
| `block`    | Blocks — `list` a page's child blocks, `delete` one                              |
| `users`    | List workspace users or `get` one by id (needs elevated permissions)             |
| `comments` | `list` / `add` / `delete` page comments                                          |
| `whoami`   | Show the login identity (bot vs user) and workspace                              |
| `file`     | Upload, list, inspect, import URLs, and attach existing uploads                  |
| `api`      | Call endpoints or discover the catalog, docs and OpenAPI schemas                 |
| `workers`  | Inspect, deploy and execute Workers; manage syncs, env and bindings              |
| `setup`    | Install optional agent session hooks                                             |

### Global flags

- `--help` — show help for any command (`notion-axi <command> --help`)
- `-v`, `-V`, `--version` — show the installed `notion-axi` version

### Output & exit codes

- All structured output is **TOON on stdout**; logs never pollute it.
- Exit `0` success (including idempotent no-ops), `1` runtime/API error, `2` usage error.
- Errors are structured: `error`, `code`, and a `help` list of fixes.

See the [Notion CLI coverage audit](docs/notion-cli-audit.md) for existing coverage
and prioritized additions from the official CLI.

## Benchmarks

How much does the AXI layer actually buy an agent? Measured against the CLI it wraps (`ntn`) and the [Notion MCP server](https://github.com/makenotion/notion-mcp-server), driving an identical agent (`claude -p`, Claude Sonnet 4.6) headlessly across 5 read/multi-step Notion tasks × 3 repeats (45 runs). Input tokens include cache reads; every condition hit **100% task success**.

| Condition      | Avg input tokens |   Avg cost | Turns | Duration |
| -------------- | ---------------: | ---------: | ----: | -------: |
| **notion-axi** |          ~63,300 | **$0.063** |   2.8 |      11s |
| raw `ntn` CLI  |          ~83,700 |     $0.079 |   3.6 |      16s |
| Notion MCP     |         ~177,900 |     $0.191 |   5.4 |      34s |

- **~19% cheaper than driving `ntn` directly** — and **~33% cheaper at half the turns on simple reads**, where the content-first home view, TOON output, and structured `help` save the round-trips an agent otherwise spends discovering the raw CLI's syntax.
- **~3× cheaper than the Notion MCP** overall (and **~3.6× on complex multi-step tasks**, where the MCP ballooned to ~293k tokens / $0.29 / 67s), at a third of the tokens and half the turns.

Caveats: a single model and prompt style, 3 repeats, and tasks that every condition could complete — harder or edge-case endpoints would likely widen the gap further. The grading harness is workspace-specific, so it isn't committed.

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
