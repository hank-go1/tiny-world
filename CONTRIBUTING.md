# Contributing

Use Node.js 24, run `npm ci`, and follow the local setup in the README. API keys are optional for building and automated tests. Use your own keys for live decision checks and keep them in ignored `.dev.vars`.

Before submitting a change, run:

```sh
npm test
npm run typecheck
npm run build
npm run release:check
```

Keep changes focused. Describe the behavior before and after your change and how you verified it. For interface changes, include a screenshot using fictional data. Exercise both engines if you change their shared adapter. Never attach credentials, private chat history, or raw requests containing personal information.

Simulation plans are validated model outputs; the application owns movement and rendering. Preserve chat priority over automatic calls and keep errors from partially applying a world update. Add a focused regression test for a behavior change when it provides meaningful coverage.

Report ordinary bugs through the repository's issues once it is published. Include reproduction steps, browser, Node version, and sanitized errors. Do not report security issues publicly; follow SECURITY.md.

Contributions to project source code are accepted under the MIT License. Do not add third-party art or code without its source, license, and required attribution.
