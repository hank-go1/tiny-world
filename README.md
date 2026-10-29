# Tiny World

Give a world a direction and watch its residents choose what to do. Tiny World pairs an interactive simulation with structured decisions from OpenAI Decisions or TypeSafe's Jev.

- **Creature island (`/`)**: ten personalities, twelve actions, weather, flight, optional automatic decisions, and an expandable API inspector with token and cost totals.
- **Tiny Block (`/town`)**: a large town with pan and zoom, road-following residents, chat, weather reactions, and an occasions calendar.

This is an independent demo, with no affiliation or endorsement implied by the model names. Model calls use external, separately billed APIs. The repository does not include API access or credits.

## Run locally

Use Node.js 24 (the tested version is in `.nvmrc`) and npm.

```sh
nvm use                 # optional, if you use nvm
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

Open the local URL printed by the server, normally `http://localhost:5173`. The worlds render without API keys; making decisions requires your own key. Edit `.dev.vars`, then restart the server:

| Variable | Used by |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI Decisions on the island and in town |
| `OPENROUTER_API_KEY` | Jev on the island |

Leave unused variables blank. Server keys stay on the server. Jev also supports entering a key through Connection settings for the current browser visit. Never add keys to `NEXT_PUBLIC_*` variables, screenshots, issues, or commits.

Choose an engine on the island, then try “Pip, go to the pond,” “Bean and Bo, eat at the orchard,” or “A thunderstorm arrives.” Automatic decisions are optional, limited to 30 calls per session, and can be overridden with chat. Calls contain world state, character profiles, questions, and recent instructions. The inspector displays this context and the model's response, so use fictional, non-sensitive input. Cost totals are estimates for this visit, not an account balance.

## Validate

```sh
npm test
npm run typecheck
npm run build
npm run release:check
npm audit --audit-level=high
```

Tests run locally without API keys or network model calls. The [dependency audit](docs/dependency-audit.md) records existing findings that must be addressed before release; the audit command currently fails. `npm start` serves the built Cloudflare worker locally; it is not a public deployment command.

## How it works

React renders the controls, sprite animation, and canvas town. Vite and vinext provide the Next.js-style application runtime, with Cloudflare Workers handling API routes. Each route validates model decisions before changing simulation plans. Movement, supported actions, collision handling, and rendering stay in the application.

| Area | Files |
| --- | --- |
| Island interface | `app/page.tsx`, `app/island.css` |
| Island world and model adapter | `lib/world.ts`, `lib/creature-decisions.ts` |
| Cost estimates and request priority | `lib/decision-costs.ts`, `lib/decision-requests.ts` |
| Town interface and model adapter | `app/town/`, `lib/town/` |
| Server endpoints | `app/api/decide/`, `app/api/town/decide/` |

The island currently requests `gpt-6-luna` from OpenAI or `typesafe/jev-1.13` through OpenRouter. Town uses OpenAI Decisions. Availability depends on your provider account; the app shows errors if a model is unavailable. See the [demo guide](docs/demo-guide.md) for controls, context, calendar behavior, and cost calculations.

## Sharing the source

```sh
npm run release:check
npm run release:pack
```

The pack command creates `releases/tiny-world/` and `releases/tiny-world.tar.gz` from an explicit list of source paths. It excludes secrets, hosting metadata, build output, tool state, and Git history. Initialize a new repository inside that export, not in a surrounding multi-project workspace. The command refuses to overwrite an existing export.

Review the [release checklist](docs/release-checklist.md), [contribution guide](CONTRIBUTING.md), [security notes](SECURITY.md), and [third-party notices](THIRD_PARTY_NOTICES.md) before publishing or hosting. Source scanning is a useful check, not a guarantee that every possible secret or rights issue has been found.

## License

Project source code is licensed under the [MIT License](LICENSE), copyright © 2026 hank-go1. Third-party code retains its existing licenses and notices. See [asset provenance](docs/asset-provenance.md) for the separate image attribution and redistribution review.
