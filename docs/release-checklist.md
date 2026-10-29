# Public release checklist

Publication target: https://github.com/hank-go1/tiny-world, owned by the personal user account `hank-go1`. Source publication and a licensed release are separate milestones; outstanding license, asset, and security tasks remain listed below. No public deployment is included.

## Prepared locally

- Blank `.dev.vars.example`, pinned Node version, setup and architecture documentation.
- Local hosting metadata made optional for clean clones and excluded from release source.
- Contribution and security guidance, preserved third-party notices, asset inventory, and a proposed MIT license.
- Key-free tests, type checking, build, and source scanning configured in GitHub Actions.
- Explicit source export that excludes local secrets, tool state, build products, and all Git history.

## Outstanding release checks

- [ ] Confirm the copyright owner and authorization to release this work, including any employer-owned material.
- [ ] Approve the code license. If using the MIT proposal, replace `[COPYRIGHT HOLDER]`, rename `LICENSE.proposed` to `LICENSE`, update `package.json` and the root entry in `package-lock.json` to `"license": "MIT"`, and replace the pending-license section of README.
- [ ] Clear each asset in `asset-provenance.md`; replace or omit anything without redistribution rights. Record the final asset license and attribution.
- [ ] Revoke and replace development keys that were shared in chat or elsewhere. The archive excludes the local secrets file; exclusion does not revoke a key.
- [x] GitHub destination confirmed by the maintainer: personal account `hank-go1`, repository `tiny-world`. Repository metadata added to package.json.
- [ ] Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run release:check`, and `npm audit`. Review any audit findings rather than applying a forced major upgrade.
- [ ] Resolve or explicitly disposition the existing 26 dependency findings, including one critical and 15 high findings. See `dependency-audit.md` and `dependency-audit.json`; CI's high-severity audit currently fails.
- [ ] Build a fresh export with `npm run release:pack` and inspect its `RELEASE_MANIFEST.json` and file list. Test it without local secrets or hosting metadata.

## Create the independent repository

Use **only** the generated export directory. Never initialize or publish a surrounding multi-repository workspace. The export contains no Git history.

```sh
cd releases/tiny-world
git init -b main
git add .
git diff --cached --stat
git diff --cached -- .dev.vars.example .gitignore
git status --short
```

Inspect the complete staged file list, then create the initial commit. Create the GitHub repository under the approved owner, attach its remote, and push after the licensing, asset, and credential checks above are complete. Do not copy the working checkout's `.git`, `.dev.vars`, `.openai`, runtime folders, or build output into this repository.

## GitHub settings and first release

- Enable private vulnerability reporting and secret scanning/push protection where available.
- Let CI pass on the initial branch; protect the main branch with required review and checks appropriate to the project.
- Add a concise description, topics, and a screenshot containing only fictional demo data.
- Review dependency alerts and tag the initial release after verifying the public source tree.
- Keep API keys out of Actions. The supplied CI workflow needs no provider secrets.

Public hosting is a separate step. The current endpoints are local-demo endpoints with no authentication, server-side budget, or per-user rate limits. Follow SECURITY.md before exposing them with a shared key.
