# CLAUDE.md

Guidance for AI agents working **on** this repository (not for using the CLI — that's `AGENTS.md`).

## What this is

`notion-axi` is an [AXI](https://github.com/kunchenguid/axi) (Agent eXperience Interface): a CLI built for agents, emitting token-efficient [TOON](https://toonformat.dev/) on stdout. It wraps `@notionhq/client` (Notion API `2025-09-03` — databases expose **data sources**; `pages.retrieveMarkdown`/`updateMarkdown`; `dataSources.query`). Auth is `NOTION_TOKEN` (a Personal Access Token or internal integration secret).

## Layout

- `bin/notion-axi.ts` — thin entry → `src/cli.ts` `main()`.
- `src/cli.ts` — `DESCRIPTION`, `TOP_HELP`, command + help maps, version.
- `src/{args,format,notion,errors}.ts` — shared helpers (arg parsing, Notion-object formatting, client + error translation).
- `src/commands/*.ts` — one file per command, each exporting its handler and a `*_HELP` string.
- `src/skill.ts` + `scripts/build-skill.ts` — generate `skills/notion-axi/SKILL.md` (do **not** hand-edit it).

## Conventions to keep

- Follow the 10 AXI principles: minimal default schemas, `--full`/`--fields` to widen, body truncation with size hints, pre-computed counts, definitive empty states, content-first home, contextual `help` suggestions, structured errors, consistent exit codes (`0` success, `1` error, `2` usage).
- All structured output is TOON on **stdout**; never log to stdout.
- New commands export a `*_HELP` const and are registered in `src/cli.ts`.
- Notion API objects are read defensively via the loose `Obj` type — `any` is allowed at those boundaries.

## Before pushing

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run build:skill -- --check   # SKILL.md must match src/skill.ts
pnpm run lint
pnpm run format:check
pnpm test                          # vitest with 100% coverage thresholds
```

The test suite enforces **100% line/branch/function/statement coverage** — add tests for any new branch.

## Contributing

Pushes to `main` go through [`no-mistakes`](https://github.com/kunchenguid/no-mistakes): work on a feature branch, `git push no-mistakes`, then run `no-mistakes` to drive the gate, which opens the PR. Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`) so release-please can version. See `CONTRIBUTING.md`.
