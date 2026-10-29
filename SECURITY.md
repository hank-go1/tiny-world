# Security

## Intended use

This is a local demonstration, not a hardened public service. Its decision endpoints do not implement authentication, per-user authorization, distributed rate limits, or a spending budget. Publishing source does not require deploying these endpoints.

Do not expose a running instance containing a shared API key to the internet. Before public hosting, add access controls, request size limits, server-side rate and concurrency limits, usage budgets, abuse monitoring, and an appropriate data-handling policy. The browser's automatic-call limit is a presentation control and can be bypassed by direct requests.

Requests send scene state, character profiles, instructions, and history to the selected external provider. The API inspector displays the actual request and response. Avoid real personal or company data. Configured credentials are omitted from model payloads and redacted from displayed provider responses, but sensitive text voluntarily entered as an instruction remains visible and is sent to the provider.

## Credentials

Keep keys in ignored `.dev.vars` locally or your hosting provider's secret store. `.dev.vars.example` contains blank values only. Never commit keys or place them in public client environment variables. Canceling a browser request may not stop an already running upstream request or its charge.

If a key was pasted into a chat, shared outside its intended secret store, or committed anywhere, revoke it in the issuing provider's dashboard and create a replacement before release. Removing a key from a file does not revoke it. Do not reuse keys used during development for a public service.

## Reporting a vulnerability

Once the repository is published, use its GitHub **Security → Advisories → Report a vulnerability** feature. The maintainer must enable private vulnerability reporting before accepting reports. Until that channel is enabled, contact the repository owner privately through an existing trusted channel. Do not open a public issue containing exploit details or credentials.

Only the current main branch is planned for security fixes. No security-response SLA is promised for this demo.
