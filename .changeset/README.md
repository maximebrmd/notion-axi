# Changesets

Run `pnpm changeset` when a change should ship in a new npm release. Select
`notion-axi`, choose a patch/minor/major bump, and describe the change for users.
Commit the generated Markdown file with your change. Documentation and internal
maintenance that do not need a release can omit a changeset.

On `main`, the release workflow opens or updates a release PR. Merging that PR
publishes the new version to npm and creates a GitHub release. See
[CONTRIBUTING.md](../CONTRIBUTING.md#releases) for setup and local verification.
