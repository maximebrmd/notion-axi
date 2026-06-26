# Agent instructions

Use `notion-axi` for Notion: search; read pages & databases; create, update (body + `--set`), archive, and move pages; create & edit databases; read/add comments; `whoami`; upload files; or call any REST endpoint directly with `api`.

- Auth: set `NOTION_TOKEN` to a personal access token (recommended — acts as the user, no page-sharing needed) or an internal integration secret (then share content with it). `users` requires an integration token, not a PAT.
- Run `notion-axi` (no args) for recent pages/databases; `notion-axi --help` for commands.
- Output is TOON on stdout. Exit codes: 0 success, 1 error, 2 usage. Errors carry a `help` list.
- Lists are minimal by default — pass `--full`, `--limit <n>`, or `--fields <list>` only when the previewed output is not enough.
