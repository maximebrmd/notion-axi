# Changelog

## [2.0.0](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v1.0.0...notion-axi-v2.0.0) (2026-06-26)


### ⚠ BREAKING CHANGES

* `ntn` must be installed (`curl -fsSL https://ntn.dev | bash`) and authenticated (`ntn login`). The `NOTION_TOKEN`/`NOTION_API_KEY` variables are replaced by `ntn`'s own auth (keychain or `NOTION_API_TOKEN`).

### Features

* wrap the official Notion CLI (ntn) instead of @notionhq/client ([#19](https://github.com/maximebrmd/notion-axi/issues/19)) ([65222c9](https://github.com/maximebrmd/notion-axi/commit/65222c92795f82ef68bbb080082f76e5083ec388))

## [1.0.0](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v0.5.0...notion-axi-v1.0.0) (2026-06-26)


### Documentation

* finalize the command surface for 1.0.0 ([#17](https://github.com/maximebrmd/notion-axi/issues/17)) ([c797c91](https://github.com/maximebrmd/notion-axi/commit/c797c91921eb93c7de40716270447b158d7b3585))

## [0.5.0](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v0.4.0...notion-axi-v0.5.0) (2026-06-26)


### Features

* **commands:** add block list/delete, users get, and comments delete ([#15](https://github.com/maximebrmd/notion-axi/issues/15)) ([0093fa5](https://github.com/maximebrmd/notion-axi/commit/0093fa5e1054a16f33932101b14b4ca49df33d32))

## [0.4.0](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v0.3.0...notion-axi-v0.4.0) (2026-06-26)


### Features

* add file upload command (multipart) with optional page attach ([#13](https://github.com/maximebrmd/notion-axi/issues/13)) ([3defb83](https://github.com/maximebrmd/notion-axi/commit/3defb83d2fe372177480cfb45400e9aca780e248))

## [0.3.0](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v0.2.0...notion-axi-v0.3.0) (2026-06-26)


### Features

* **commands:** add database create/edit and page move ([#11](https://github.com/maximebrmd/notion-axi/issues/11)) ([5f0a9f2](https://github.com/maximebrmd/notion-axi/commit/5f0a9f2f88a2f0ae4700acf5fd46658093f46253))

## [0.2.0](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v0.1.1...notion-axi-v0.2.0) (2026-06-26)


### Features

* **commands:** add property setting, page archive, comments, and whoami ([#8](https://github.com/maximebrmd/notion-axi/issues/8)) ([23008d2](https://github.com/maximebrmd/notion-axi/commit/23008d2c25cbeb3413895b093c44b28084948fa3))

## [0.1.1](https://github.com/maximebrmd/notion-axi/compare/notion-axi-v0.1.0...notion-axi-v0.1.1) (2026-06-26)


### Features

* **cli:** add `api` escape hatch, `--fields` projection, and content-from-file flags ([e0df40d](https://github.com/maximebrmd/notion-axi/commit/e0df40d8b701b6001e22929b5cdb3ca2b37f8151))


### Bug Fixes

* **commands:** fall back to "(untitled)" for empty database titles ([80f43f8](https://github.com/maximebrmd/notion-axi/commit/80f43f8e0d2bed4e7872fc16b4ebf4b5d873191b))
* **notion:** quiet SDK logging and add PAT-aware auth guidance ([a6cdb83](https://github.com/maximebrmd/notion-axi/commit/a6cdb83cb949e50f8ce67044445a30431ccb3203))
