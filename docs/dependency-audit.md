# Dependency audit

Checked on 2026-10-28 against the public npm registry. The working lockfile has **26 dependency findings: 1 critical, 15 high, 9 moderate, 1 low**. Findings may represent shared transitive dependencies and do not prove that every advisory is reachable in this application. They remain unresolved in this preparation snapshot.

The machine-readable report is `dependency-audit.json`, with advisory URLs, affected ranges, and npm's proposed fixes. No credentials or local registry configuration are included. All 875 resolved package URLs in the lockfile use `registry.npmjs.org`.

## Required release work

1. Address the critical Next.js finding. npm proposes 16.4.3 for the current affected version. Validate the matching React/server-components dependencies and vinext compatibility rather than upgrading one runtime package in isolation.
2. Upgrade and test the affected Vite, vinext, Cloudflare Vite plugin, Wrangler, Miniflare, and their transitive dependencies. Several are pinned in this starter and need explicit changes.
3. Review the Zod advisory and a supported migration path from v3; npm currently proposes a v4 change. Re-run adapter/schema tests for both worlds.
4. Review the inherited Drizzle tooling and its affected dependencies. npm proposes a major-version downgrade as one fix; do not apply it blindly. The demo does not currently use the starter's database functionality.
5. Re-run `npm audit` and the full test, type, build, and clean-export checks after changing the lockfile. Record any remaining findings and their disposition before release.

No `npm audit fix --force` or framework migration was applied as part of packaging preparation. The existing runnable demo is preserved while these upgrade decisions remain visible. CI includes an audit that fails on high or critical findings, so its audit step is expected to fail until these are resolved.
