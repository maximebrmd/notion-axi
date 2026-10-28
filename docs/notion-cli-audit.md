# Notion CLI coverage audit

Implementation update: the selected additions are now available in this branch:
explicit child-content deletion permission, file lifecycle commands, API
discovery, Markdown export/stdin input, and native Workers command support.
See the README and per-command help for current syntax. The baseline comparison
below records the original audit and its recommendations.

Checked on 2026-10-28 against the official Notion CLI documentation and local
`ntn 0.18.1` help. Repository baseline:
[`9f04aa0`](https://github.com/maximebrmd/notion-axi/tree/9f04aa0f465529f90e3f903ec866cc7efe88f7f3),
`notion-axi 2.1.0`. The installed CLI is older than the current documentation;
the recommendations below identify which evidence supports each addition.
This is a source/help comparison; no live workspace mutations were performed.

## Already covered

| Area                 | Existing notion-axi behavior                                                                                                                                               | Evidence                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Pages                | Markdown reading, full body, creation, append/replace, content files, typed property updates, trash/restore, move                                                          | [page.ts](../src/commands/page.ts)    |
| Data sources         | Database-to-source resolution, source listing and selection, direct source IDs, query filters, typed `--where`, multiple sorts, cursor pagination, schema creation/editing | [db.ts](../src/commands/db.ts)        |
| Files                | Local single-part upload, stored filename override, optional attachment as a file block                                                                                    | [file.ts](../src/commands/file.ts)    |
| Identity and content | Home, search, users, comments, child-block listing/deletion, identity                                                                                                      | [command registration](../src/cli.ts) |
| REST access          | GET/POST/PATCH/DELETE with JSON body and query parameters                                                                                                                  | [api.ts](../src/commands/api.ts)      |
| Authentication       | Delegated to `ntn`; environment and keychain support are inherited                                                                                                         | [ntn.ts](../src/ntn.ts)               |

Do not add separate query/sort/filter/source-resolution commands just for parity:
those workflows already exist. Views, templates, and other REST resources can be
called through `api` today; dedicated commands would add ergonomics.

## Recommended additions

These command names are proposals, not implemented commands. Effort estimates
are relative implementation judgments, including tests and generated help.

| Priority | Addition | What is missing now | Suggested shape | Effort |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| High | Explicit permission to delete child content | `page update --replace` hardcodes `allow_deleting_content: true`. The official edit command makes deletion an explicit option. | Default to preserving child pages/databases; add `--allow-deleting-content` for intentional replacement. | Small; changes current behavior |
| High | File inspection and external URL import | Only `file upload <path>` is implemented. There is no upload status/list command or URL import. | `file list`, `file view <id>`, `file import <url>`; expose status, expiry and a follow-up hint while an import is pending. | Small–medium |
| High | API discovery | `api` cannot list endpoints or pass through `--docs`/`--spec`. Global `--help` resolves to the wrapper's static help. | `api endpoints`, `api docs <path> --method ...`, `api schema <path> --method ...` with bounded output. | Medium |
| Medium | File input and attachment controls | Uploads require a local path; content type is inferred; attachments always become generic file blocks. | Read bytes from stdin with a filename/content type; attach an existing upload as an image, file block, cover, icon, or files property. | Medium |
| Medium | Page export and stdin input | `page view --full` still emits a TOON envelope; content can come from flags or files, but not stdin. | `page export <id> --output page.md`; permit `--content-file -` and `--replace-file -`. Preserve normal TOON output. | Small–medium |
| Medium | Query input/performance | Queries accept inline filters only; `--fields` reduces output after full properties are fetched. | `--filter-file <path                                                                                                                                      | ->`and server-side`filter_properties` for selected columns, retaining the title field. | Small–medium |
| Medium | Diagnostics and completions | No wrapper health check or shell completion command. | `doctor` for binary/auth/version checks; generate completions for notion-axi's own commands. | Small–medium |
| Later | Workers | No Workers command family is registered; the current transport runs `ntn api` only. | Start with worker list/details/capabilities, runs/logs and usage. Add deploy, execution, syncs, environment and webhook management as a separate feature. | Large |

### Evidence and implementation notes

**Child content and page workflows.** The official CLI documents
`pages edit --allow-deleting-content`, Markdown retrieval, and stdin content.
Local `ntn pages get --help` also describes property frontmatter. In the wrapper,
[page replacement](../src/commands/page.ts) always enables child-content deletion,
and page viewing does not return the API's `unknown_block_ids`. Export should
surface upstream truncation and unknown blocks so a partial response is not
mistaken for a complete document. See the official
[command reference](https://developers.notion.com/cli/reference/commands).

**Files.** The official CLI supports upload listing/retrieval, external URL
imports, stdin bytes, and content-type overrides. Imports are asynchronous, so
status inspection belongs alongside import. Its file list currently returns only
the first page; implement cursor support through the API instead of inheriting
that limit. The wrapper's current upload method is single-part; any multipart
extension needs an explicit create/send/complete lifecycle. See
[file uploads](https://developers.notion.com/cli/guides/file-uploads).

**API discovery.** `ntn api ls`, `--spec`, `--docs`, body files/stdin, repeated
query parameters, headers and per-request version selection are available
upstream. The wrapper forwards none of those controls, although
`NOTION_API_VERSION` is already inherited by the subprocess. Add file-backed
JSON and discovery before copying the entire inline input parser. The shared
transport currently expects JSON, so Markdown docs need a separate output path.
See [API requests](https://developers.notion.com/cli/guides/api-requests).

**Data sources.** The official reference documents `--filter-file`; the data
source guide describes `filter_properties` to reduce returned property payloads.
Existing wrapper source resolution, filters, sorting and cursor pagination need
no replacement. See
[data sources](https://developers.notion.com/cli/guides/data-sources) and the
[command reference](https://developers.notion.com/cli/reference/commands).

**Developer utilities.** Local `ntn --help` exposes `doctor` and `update`.
Completions for bash, zsh, fish, PowerShell and elvish are documented in
[installation](https://developers.notion.com/cli/get-started/installation).
An AXI completion command must describe its own command tree rather than return
the `ntn` completion script unchanged. Authentication can remain delegated.

**Workers.** Current documentation includes deployment, capabilities, run logs,
syncs, secrets and webhooks. This would expand notion-axi into a second major
workflow. The existing `api` escape hatch targets the public Notion REST API and
does not automatically expose worker operations. See the
[Workers overview](https://developers.notion.com/workers/get-started/overview)
and [command reference](https://developers.notion.com/cli/reference/commands).

## Improvements beyond CLI parity

- Search, blocks, comments and users return `has_more` but omit `next_cursor` and
  accept no resume cursor. Extend their pagination using the existing `db query`
  pattern before adding unrelated command families.
- Update the API-version guidance in `CLAUDE.md`: it describes `2025-09-03` as
  fixed, while the transport supplies no version and inherits `ntn` defaults or
  `NOTION_API_VERSION`. Pick and test an explicit compatibility policy.
- For each new command, update the command/help maps and shared skill source,
  regenerate the skill, and retain the repository's 100% test coverage requirement.

Recommended order: explicit content-deletion permission, file lifecycle,
API discovery, Markdown export, then query/diagnostic improvements. Treat Workers
as a separately scoped feature.
