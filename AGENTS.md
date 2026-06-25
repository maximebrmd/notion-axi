# Agent instructions

Use `notion-axi` for Notion: search, read pages and databases, create and update pages, or call any REST endpoint directly with `api`.

- Auth: set `NOTION_TOKEN` to a Personal Access Token (acts as you, no sharing needed) or an internal integration secret (share content with the integration).
- Run `notion-axi` (no args) for recent pages/databases; `notion-axi --help` for commands.
- Output is TOON on stdout. Exit codes: 0 success, 1 error, 2 usage. Errors carry a `help` list.
- Lists are minimal by default — pass `--full`, `--limit <n>`, or `--fields <list>` only when the previewed output is not enough.
