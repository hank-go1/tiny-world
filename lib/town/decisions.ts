import { z } from 'zod';
import { WORLD, createResidents, places, residentActivity, residentProfile, type Resident } from './world';
import { weatherKinds } from './weather';

const locals = createResidents();
const residentId = z.string().refine(id => locals.some(p => p.id === id));
const placeId = z.string().refine(id => places.some(p => p.id === id));
export const messageKind = z.enum(['instruction', 'announcement', 'conversation']);
export type MessageKind = z.infer<typeof messageKind>;
export const townChoice = z.string().refine(choice => ['keep', 'wait', 'wander'].includes(choice) || places.some(p => choice === `go:${p.id}`) || locals.some(p => choice === `meet:${p.id}`));
export const townDecision = z.object({ residentId, choice: townChoice, confidence: z.number().min(0).max(1) }).refine(decision => decision.choice !== `meet:${decision.residentId}`);
export type TownDecision = z.infer<typeof townDecision>;
export const townChatRequest = z.object({
  prompt: z.string().trim().min(1).max(1000),
  history: z.array(z.string().max(1000)).max(6),
  news: z.array(z.string().max(1000)).max(12).default([]),
  townTime: z.number().finite().min(0).max(8640000000000000),
  weather: z.enum(weatherKinds), previousWeather: z.enum(weatherKinds).optional(), trigger: z.enum(['message', 'weather']).default('message'),
  closed: z.array(placeId).max(places.length),
  residents: z.array(z.object({ id: residentId, x: z.number().min(0).max(WORLD.width), y: z.number().min(0).max(WORLD.height), activity: z.string().max(160), atPlace: placeId.nullable().default(null) }))
    .length(locals.length).refine(rows => new Set(rows.map(p => p.id)).size === locals.length),
});
export type TownChatRequest = z.infer<typeof townChatRequest>;
export const townChatResult = z.object({
  decisions: z.array(townDecision).length(locals.length).refine(rows => new Set(rows.map(p => p.residentId)).size === locals.length),
  latency: z.number().nonnegative(), model: z.string(),
  messageKind,
});
export type TownChatResult = z.infer<typeof townChatResult>;

export function buildTownDecisionRequest(body: TownChatRequest) {
  return {
    model: 'gpt-6-luna',
    input: JSON.stringify({
      setting: 'Maplebrook is a living fictional town. The user can give direct instructions OR introduce news about the world. Residents may react to NEW news without being explicitly ordered. Reactions must be caused by the latest message, not merely by a favorite activity or old news. Questions and conversation cause no changes. Choose plausible individual reactions using each resident’s interests, spending preferences, current activity, distance, weather, and open places. Keep current plans when there is no relevant reason to change. Do not make everyone react identically. The application handles walking.',
      latest_instruction: body.prompt, earlier_instructions: body.history,
      town_news: body.news, news_rules: 'Only town_news and the latest announcement describe current circumstances. Earlier messages are historical context; do not restore announcements absent from town_news, as they may have been cleared. Newer announcements supersede conflicting older news. Do not treat old direct orders as new announcements. Do not invent prices, money transfers, purchases, or unavailable actions.',
      town_time: new Date(body.townTime).toISOString(), timezone: 'Asia/Ho_Chi_Minh', weather: body.weather,
      trigger: body.trigger, previous_weather: body.previousWeather,
      weather_rules: 'The structured weather field is authoritative over older news and history. A weather trigger is new world news. In rain, consider open indoor places, home, and outdoor preferences. During a storm, exposed residents should seek their own home or an open indoor place; even an outdoor waiting order can be interrupted to seek shelter. Already sheltered residents may stay. When skies clear, outdoor-minded residents may resume wandering, visit parks or camp, while others can keep indoor activities. Weather reactions need no explicit order. Choose individually; do not send everyone to the same home. Walking routes remain outdoors while traveling.',
      places: places.map(p => ({ id: p.id, name: p.name, kind: p.kind, indoors: !['park', 'camp'].includes(p.kind), open: !body.closed.includes(p.id), x: p.x, y: p.roadY })),
      residents: locals.map(p => {
        const current = body.residents.find(resident => resident.id === p.id);
        const location = places.find(place => place.id === current?.atPlace);
        return { id: p.id, name: p.name, home: p.home, profile: residentProfile(p), ...current, sheltered: Boolean(location && !['park', 'camp'].includes(location.kind)) };
      }),
    }),
    questions: [{
      type: 'choice', name: 'message_kind', instructions: 'Classify the latest message. A statement that changes or introduces circumstances in this fictional town is an announcement, even without any order to residents. A request directing residents to perform an action is an instruction. Questions, greetings, and unrelated conversation are conversation. When a message combines town news with resident orders, use announcement.',
      choices: [
        { value: 'announcement', description: 'New or updated world circumstances, such as a shop promotion, an event, or local conditions, which residents can react to.' },
        { value: 'instruction', description: 'A direct request for one or more residents to act.' },
        { value: 'conversation', description: 'A question, greeting, or unrelated message that does not change the world.' },
      ],
    }, ...locals.map(person => ({
      type: 'choice', name: person.id,
      instructions: `Choose ${person.name}'s response to the LATEST message. First: if it is a question, greeting, or conversation, choose keep regardless of old news. For a weather trigger, follow weather_rules: seek appropriate shelter in rain or storms, or reconsider indoor shelter when skies clear, based on this resident's location and preferences. For other NEW town news, independently decide whether this person has a relevant reason to react; no explicit order is required. Interested residents can visit the place involved in the news. Do not send someone to an unrelated favorite place just to make them react. Other residents keep their plans. Respect explicit waiting orders except to leave exposure during a storm. For a direct instruction, apply it only to the addressed residents; everyone else keeps their plans. Old news may inform a new instruction but must not independently trigger new actions. Stop means wait. Home means ${person.home}. Going to a resident means meet them, not their home; the target keeps their activity unless instructed otherwise. Only visit open places. For unsupported actions choose keep.`,
      choices: [
        { value: 'keep', description: 'Keep the current plan when it remains more appealing or important than reacting to the news, the instruction does not address this resident, or no supported action fits.' },
        { value: 'wait', description: 'Stop walking and wait at the current position.' },
        { value: 'wander', description: 'Resume a free stroll around town without a destination.' },
        ...places.filter(p => !body.closed.includes(p.id)).map(p => ({ value: `go:${p.id}`, description: `Walk to ${p.name} (${p.kind}) and stay there.${p.id === person.home ? ' This is this resident’s own home.' : ''}` })),
        ...locals.filter(p => p.id !== person.id).map(p => ({ value: `meet:${p.id}`, description: `Go to ${p.name}, tracking their position while walking, and stop nearby when reached.` })),
      ],
    }))],
  };
}

export function readTownDecisions(raw: unknown, closed: string[]): TownDecision[] {
  const data = z.object({ answers: z.array(z.object({ type: z.string(), name: residentId, choice: townChoice.optional(), confidence: z.number().min(0).max(1).optional() })).length(locals.length) }).parse(raw);
  const decisions = data.answers.map(answer => {
    if (answer.type !== 'choice' || !answer.choice || answer.confidence === undefined) throw new Error('Incomplete decisions.');
    if (answer.choice.startsWith('go:') && closed.includes(answer.choice.slice(3))) throw new Error('Destination is closed.');
    return townDecision.parse({ residentId: answer.name, choice: answer.choice, confidence: answer.confidence });
  });
  if (new Set(decisions.map(p => p.residentId)).size !== locals.length) throw new Error('Duplicate resident decisions.');
  return decisions;
}

export function readTownReply(raw: unknown, closed: string[]) {
  const data = z.object({ answers: z.array(z.object({ type: z.string(), name: z.string(), choice: z.unknown().optional(), confidence: z.number().min(0).max(1).optional() })).length(locals.length + 1) }).parse(raw);
  const classification = data.answers.filter(answer => answer.name === 'message_kind');
  if (classification.length !== 1 || classification[0].type !== 'choice') throw new Error('Missing message classification.');
  const kind = messageKind.parse(classification[0].choice);
  const decisions = readTownDecisions({ answers: data.answers.filter(answer => answer.name !== 'message_kind') }, closed);
  // A question or greeting must not execute incidental actions from the batch.
  return { messageKind: kind, decisions: kind === 'conversation' ? decisions.map(decision => ({ ...decision, choice: 'keep', confidence: classification[0].confidence ?? 0 })) : decisions };
}

export function rememberTownNews(news: string[], text: string) {
  return [...news.filter(item => item !== text), text].slice(-12);
}

export function describeTownChoice(resident: Resident, choice: string) {
  if (choice === 'keep') return residentActivity(resident);
  if (choice === 'wait') return 'Wait here';
  if (choice === 'wander') return 'Explore the town';
  const target = locals.find(p => choice === `meet:${p.id}`);
  if (target) return `Go to ${target.name}`;
  return `Go to ${places.find(p => choice === `go:${p.id}`)?.name ?? 'a place'}`;
}
