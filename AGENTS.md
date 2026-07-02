# Agent instructions

Use `notion-axi` for Notion: search; read pages & databases; create, update (body + `--set`), archive, and move pages; create & edit databases; read/add/delete comments; `whoami`; upload files; inspect/delete blocks; or call any REST endpoint directly with `api`.

- Auth: notion-axi wraps the official Notion CLI (`ntn`). Install it (`curl -fsSL https://ntn.dev | bash`) and run `ntn login` (browser; token in the OS keychain, acts as the user, no page-sharing). For headless use, export `NOTION_API_TOKEN`. `users` needs elevated permissions and is often `RESTRICTED_RESOURCE`.
- Run `notion-axi` (no args) for recent pages/databases; `notion-axi --help` for commands.
- Output is TOON on stdout. Exit codes: 0 success, 1 error, 2 usage. Errors carry a `help` list.
- Lists are minimal by default — pass `--full`, `--limit <n>`, or `--fields <list>` only when the previewed output is not enough.
- `db query` selects server-side: `--where Name=value` (repeatable, AND-ed, typed from the schema) or a raw `--filter <json>` (mutually exclusive with `--where`), `--sort Field:asc|desc` (repeatable; `created_time`/`last_edited_time` sort by timestamp), and `--cursor <c>` to page (the response returns `next_cursor` when `has_more`). Prefer these over fetching all rows and filtering client-side.
