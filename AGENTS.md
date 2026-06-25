# Agent instructions

Use `notion-axi` for Notion: search, read pages and databases, create and update pages.

- Auth: set `NOTION_TOKEN` to an internal integration secret and share content with the integration.
- Run `notion-axi` (no args) for recent pages/databases; `notion-axi --help` for commands.
- Output is TOON on stdout. Exit codes: 0 success, 1 error, 2 usage. Errors carry a `help` list.
- Lists are minimal by default — pass `--full` / `--limit <n>` only when the previewed output is not enough.
