# Contributing

Thanks for wanting to contribute.
One rule up front:

**Pull requests targeting `main` must be raised through [`no-mistakes`](https://github.com/kunchenguid/no-mistakes).**
Pushing through it runs an AI-driven review/test/lint pipeline in an isolated worktree, forwards the push only after every check passes, and opens a clean PR automatically.

A GitHub Actions check (`Require no-mistakes`) runs on PRs targeting `main` and fails if the body is missing the deterministic signature that no-mistakes writes. The release and dependency bots are exempt so their automation keeps working; other PRs without the signature will not be merged.

## Repo conventions

- Node 24 LTS for development and CI (the distributed CLI still supports Node 20+), TypeScript, ESM-only.
- Install dependencies with `pnpm install --frozen-lockfile`; run `pnpm run build`, `pnpm run lint`, `pnpm run format:check`, and `pnpm test` before pushing. `pnpm test` runs vitest with coverage and enforces 100% thresholds (lines, functions, branches, statements).
- Do not hand-edit `CHANGELOG.md` — [Changesets](https://github.com/changesets/changesets) generates it from `.changeset/*.md` files. Run `pnpm changeset` for changes that need a release. A CI check (`Guard generated files`) fails the PR if the changelog is modified; the release bot is exempt.
- Do not hand-edit `skills/notion-axi/SKILL.md`. It is generated from the shared skill source (`src/skill.ts`); run `pnpm run build:skill` and commit the result. CI fails (`pnpm run build:skill -- --check`) if it drifts.

## Design

notion-axi follows the [AXI](https://github.com/kunchenguid/axi) (Agent eXperience Interface) standards: TOON output, minimal default schemas, body truncation with `--full`, pre-computed aggregates, definitive empty states, content-first home view, contextual next-step suggestions, and structured errors with consistent exit codes (0 success, 1 error, 2 usage). Keep new commands consistent with these principles.

## Workflow

1. Fork the repo and create a branch.
2. Make your changes; add or update tests under `test/`.
3. Run `pnpm run build && pnpm run build:skill && pnpm run lint && pnpm run format:check && pnpm test`.
4. Run `pnpm changeset` if the change needs a release, then commit it with a [conventional commit](https://www.conventionalcommits.org/) message (e.g. `feat: …`, `fix: …`). Documentation and internal maintenance can omit a changeset when no release is needed.
5. Push through the gate instead of pushing to `origin`:

   ```sh
   git push no-mistakes
   ```

6. Run `no-mistakes` to drive the pipeline. Once it passes, it opens the PR against `main` for you with the required signature.

## Releases

Release notes and bump types come from `.changeset/*.md`, rather than commit
messages. `pnpm changeset` asks for a patch, minor, or major bump and a user-facing
summary. The release workflow runs all checks before creating a release PR or
publishing.

1. Merge a contribution containing a changeset into `main`.
2. The workflow opens or updates `chore: release notion-axi`, generating the next
   package version, changelog, and lockfile.
3. Review and merge that PR. The next workflow run publishes the new version to
   npm with provenance and creates a GitHub release and version tag. Versions
   already present on npm are skipped on subsequent runs.

The existing `CHANGELOG.md` history is preserved. Changesets uses `v<version>`
tags for this single-package repository; historical `notion-axi-v<version>` tags
remain available.

The workflow stays at `.github/workflows/release-please.yml` because npm trusted
publishers are bound to the filename. Its implementation now uses Changesets;
the old release-please configuration has been removed. To enable publishing:

- In GitHub, enable **Settings → Actions → General → Allow GitHub Actions to
  create and approve pull requests**.
- In the npm `notion-axi` package settings, configure a GitHub Actions trusted
  publisher for owner `maximebrmd`, repository `notion-axi`, workflow filename
  `release-please.yml`, with permission to publish directly. Existing matching
  trusted-publisher settings can be reused. No `NPM_TOKEN` secret is required.

For local inspection, `pnpm changeset status` previews pending releases.
`pnpm run version-packages` consumes changesets and updates the package version,
changelog, and lockfile; the release PR normally runs this for you. `pnpm run
release` publishes any unpublished version and must only be run when you intend
to publish. Package publication also builds the CLI and checks that the generated
skill is current.

## Questions

Open an issue.
