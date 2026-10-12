## What and why

<!-- One paragraph: what changes and why. Link the issue if there is one. -->

Fixes #

## Checks

- [ ] `npm run lint` and `npm test` pass locally
- [ ] New or changed behaviour has tests (unit under `src/test/` or `electron/__tests__/`, e2e under `e2e/` when the UI changes)
- [ ] Documentation is updated in the same change (`README.md`, `docs/`, `CHANGELOG.md` under _Unreleased_)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Bundled plugins were re-signed if any of their files changed (`node scripts/sign-plugin.js plugins/<id>`)

## How to try it

<!-- Steps for a reviewer: OS, cluster provider if any, what to click. -->
