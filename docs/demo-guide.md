# Tiny World

Ten creatures, one scene, typed decisions from OpenAI Decisions or Jev. Built for a live AI Day presentation.

## Tiny Block town preview

Run `npm run dev` and open `/town` on the printed local URL. The original creature demo remains at `/`.

The town is a drawn, zoomable 3,200 × 2,400 world with 30 places and 24 residents. Drag to pan and scroll or pinch to zoom. Click buildings or neighbors to inspect them; drag neighbors onto paths, change the weather, or open and close public places. Arrow keys pan, `+` / `-` zoom, `0` fits the town, and Space pauses ambient animation.

The town clock starts at the current time in Vietnam (GMT+7), showing seconds, weekday, date, and year. At 1×, one real second equals one town second; 2× and 4× accelerate the clock and animation together. Pause freezes town time, resuming continues from that point, and reloading starts again at the current real time. The clock accounts for elapsed time when the tab is in the background and rolls through months, leap days, and years.

Residents stroll until directed through town chat. Map data and road routing are in `lib/town/world.ts`, reusable drawing functions in `lib/town/render.ts`, the clock in `lib/town/clock.ts`, and the controls in `app/town/`.

Verify town movement and calendar behavior with `node --test lib/town/world.test.mjs lib/town/clock.test.mjs`.

### Town chat

Town chat opens as a compact dock on the right. Use the speech bubble in the header to reopen it after closing. Try “Sofia go to Arjun,” “Maya and Oliver, meet at the café,” “Everyone head home,” “Maya, wait here,” or “Everyone wander again.” Enter sends; Shift+Enter adds a line. Each submission makes one server-side call to OpenAI's `POST /v1/decisions` with `gpt-6-luna` and one choice question per resident plus one message classification question. The request includes the current town time, weather, closed places, resident activities and positions, assigned interests and spending preferences, up to twelve remembered town announcements, and the last six successful messages.

Set `OPENAI_API_KEY` in the ignored `.dev.vars` file and restart the preview. The key stays on the server. Responses are validated before any plans change; failures show an error and leave plans intact. API calls occur only for a submitted message or an explicit weather change; there is no background polling or scripted decision fallback. Direct instructions apply to the addressed residents. Announcements such as shop promotions or local gatherings let residents choose individual reactions using their preferences and current activity. Messages classified as conversation never execute resident actions. This local demo route is intended for the local preview; add authentication and usage controls before public hosting.

Supported choices are keep the current plan, wait, wander, visit a named open place (including a resident's own home), or go to another resident. Residents follow connected roads and avoid the fountain. Place visits remain at the destination. Resident visits track the person while walking and stop nearby on arrival; the target resident keeps their current activity. Residents travel at five times their wandering pace while heading to a place or another resident. Casual wandering keeps its original speed; pausing and arrival behavior are unchanged. Chat shows the changed residents, selected actions, model confidence, and request duration. Click a resident in the results to find and follow them on the map. Pause holds movement. Reloading clears resident plans, chat history, and pending results. Chat history, town news, and plans last for the current page session. Town news is visible in chat and can be cleared; reloading also clears it. Newer announcements take precedence over conflicting earlier ones. News is model context, not a full inventory or economy simulation: it does not create products, process purchases, change shop controls, or schedule events. Resident profiles are visible in the inspector and next to chat results; they are assigned traits, not model-generated explanations. Calendar marking and other world changes are not part of town chat yet.

Verify decision validation and routing with `node --test lib/town/decisions.test.mjs lib/town/world.test.mjs`.

### Weather controller

Open the weather picker in the bottom-left toolbar and choose Clear, Rain, or Storm. The scene changes immediately, then one shared Decisions API request lets all residents reconsider their plans. Rain adds a light shower; storms darken the scene and add heavier, windblown rain. The controller shows progress and a reaction count; “See resident reactions” opens the weather entry in town chat. Controls prevent overlapping model calls. If a request fails, the selected weather remains visible, plans remain unchanged, and “Retry resident reactions” retries the current conditions.

Every request includes the current weather, and weather-triggered requests also include the previous conditions. The model receives indoor/outdoor place information and each resident's current place when they have arrived. Residents traveling on roads are exposed. The weather prompt asks exposed residents to find home or an open indoor place in a storm, considers individual preferences in rain, and lets outdoor-minded residents head back out when skies clear. Residents already at indoor destinations can keep their activity. Movement still follows the road graph; there are no building interiors.

Weather reactions appear as WEATHER messages and do not accumulate as stale town-news entries. Weather actions share the chat request lifecycle, and reloading restores clear skies. Changing weather while the town is paused still chooses plans; movement begins when the town resumes. There is no background model polling.

### Occasions calendar

Click the clock/date to open the month calendar. Pick a day, then add an occasion with a name, type, optional time, and optional place. Existing occasions can be edited, moved to another date, or removed. Day markers show saved occasions; Today returns to the current town date. Occasions are saved in this browser, survive refreshes, and update across tabs on the same origin.

`useTownCalendar()` exposes `applyCommand(command)` for the future decision adapter. It accepts a validated command such as:

```json
{"type":"mark_occasion","kind":"picnic","date":"2026-10-31","time":"16:00","placeId":"park"}
```

Supported decision choices are `birthday`, `festival`, `market`, `picnic`, and `game-night`. The application supplies their titles, so Jev does not need to generate text. The command helper and schemas are in `lib/town/calendar.ts`; the persistent store is in `lib/town/use-calendar.ts`. This is a browser-side command interface, not an HTTP endpoint. Model-driven calendar marking is not connected yet. Validate with `node --test lib/town/calendar.test.mjs`.

## Original creature demo

Run `npm install` then `npm run dev`. Open the printed local URL.

There are no scripted reactions, preset sequences, or offline decision fallbacks. Every submitted instruction calls the selected engine: OpenAI Decisions (default) or Jev. Reset clears the scene. Pause freezes animation. Expand “Meet the creatures” to inspect activities and needs. Pause, reset, and fullscreen are above the island; chat and scene controls are beside it.

Open the original demo at `/` and choose **OpenAI Decisions** or **Jev** in the decision engine selector. OpenAI uses `gpt-6-luna` through `https://api.openai.com/v1/decisions`, with `OPENAI_API_KEY` saved only on the server. For Jev, use a server-side `OPENROUTER_API_KEY` or open **Connection settings** and enter an OpenRouter API key. A Jev key entered in the browser lives only in React memory, is sent to this app's same-origin server route, and is forwarded exclusively to `https://openrouter.ai/api/alpha/decisions`. It is not stored or logged. Refresh or disconnect to clear it.

Each submission makes one request with 33 independent questions: three scene choices, plus action, target, and flight for each creature. Both engines receive the same world context and original questions, and return decisions and probabilities. The OpenAI adapter maps flight questions to predicates and converts the answers into the existing renderer format. Changing engines preserves the scene and stops automatic decisions; enable them again to use the selected engine. Chat takes priority while auto is on: a new user direction cancels a pending automatic request, stale responses are ignored, and automatic decisions resume eight seconds after the direction is applied. Subsequent automatic calls receive the latest user direction and are instructed to continue active user plans. Scene buttons use the same priority. The renderer owns animation, collision avoidance, and the finite action vocabulary. Latency measures the upstream request. Automatic reconsideration is opt-in with “Auto decisions”: one automatic call every eight seconds when no other decision is running, at most 30 automatic calls per session. Calls are counted when initiated, including failures/cancellations. No automatic retries. Pause and backgrounding freeze movement and needs and cancel pending requests; errors disable automatic thinking.

The island has a berry orchard, pond, cottage, campfire, play meadow, and lookout. Either engine can choose approach, flee, follow, wait, eat, drink, sleep, swim, dance, play, hide, or explore independently for each creature. Activities appear on arrival; animation and travel stay in the renderer. Cake and lava can appear at any named location; clear/rain/night/disco atmosphere and flight remain available. Unsupported objects are not generated. History is bounded to 12 instructions plus previous world state. API errors leave the scene unchanged, without scripted fallback.

The **API request & response** section below the demo shows the latest completed call for either engine: its actual endpoint, parameters, raw provider response, HTTP status, and latency. Readable requests and responses have expandable object and array fields, plus Expand all and Collapse all controls. Raw JSON keeps the original serialized request available. Chat and automatic calls both update it. Failed upstream responses are inspectable too. Authentication headers are never returned, and configured keys are redacted if a provider echoes them. Reset clears the inspector.

The inspector also totals estimated USD cost and input tokens for this browser visit, across both engines and chat/automatic calls. Each initiated request starts with a rough estimate (compact request JSON characters divided by four, including all questions), replaced by provider-reported usage when its response arrives. Canceled, timed-out and unanswered requests retain their estimate because the upstream call may still be billed. Explicit upstream 4xx rejections without usage count as zero spend. Jev's reported `usage.cost` takes precedence; otherwise the estimate uses published input prices: Jev 1.13 $0.042/M, OpenAI Decisions gpt-6-luna $0.10/M, with reported OpenAI cache reads at $0.01/M and 30m/12h cache writes at $0.125/$0.25 per M. Output is free on these endpoints. These are estimates, not an account invoice; regional or other account adjustments are not included. Rates checked 2026-10-28 against [OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability), [OpenAI cache pricing](https://developers.openai.com/api/docs/pricing), and [Jev 1.13](https://openrouter.ai/typesafe/jev-1.13). Resetting the world or switching engines preserves the visit's totals; refreshing clears them.

Official API contracts: https://developers.openai.com/api/docs/guides/decisions and https://docs.typesafe.ai/api

Validate the adapter and simulation with `node --test lib/creature-decisions.test.mjs lib/decision-costs.test.mjs lib/decision-requests.test.mjs lib/world.test.mjs`.

Configure your own OPENROUTER_API_KEY in ignored .dev.vars for local use. The browser never receives the server key.


Creature needs update while the world is running. There is no island clock, curfew, or mandatory bedtime. “Auto decisions” lets creatures reconsider their activities based on needs, personalities, and the current scene. Night is an optional visual atmosphere selected by an instruction.
