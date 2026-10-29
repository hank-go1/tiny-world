import { z } from 'zod';
import { estimateDecisionUsage, type DecisionUsage } from './decision-costs';
import { buildQuestions, creatures, initialWorld, places, landmarks, actions, type Place, type Action } from './world';

export type DecisionProvider = 'openai' | 'jev';
export type CreatureCallTrace = { provider: DecisionProvider; automatic: boolean; endpoint: string; request: string; response: string | null; status: number | null; latency: number; usage: DecisionUsage };
const probability = z.number().min(0).max(1);
const location = z.custom<Place | 'none'>(v => typeof v === 'string' && (v === 'none' || Object.hasOwn(places, v)));
const actionSchema = z.custom<Action>(v => typeof v === 'string' && Object.hasOwn(actions, v));
const decisionSchema = z.object({ action: actionSchema, target: z.string().max(30), flying: z.boolean(), confidence: probability.optional(), probabilities: z.record(probability).optional() });
export const creatureRequestSchema = z.object({
  provider: z.enum(['openai', 'jev']).default('jev'),
  apiKey: z.string().trim().max(512).optional(), prompt: z.string().trim().min(1).max(1000), history: z.array(z.string().max(1000)).max(12),
  world: z.object({ cake: location, lava: location, weather: z.enum(['clear','rain','disco','night']), decisions: z.record(decisionSchema) }),
  needs: z.record(z.object({ hunger: z.number().min(0).max(100), energy: z.number().min(0).max(100), courage: z.number().min(0).max(100) })).optional(),
  automatic: z.boolean().optional(),
  positions: z.record(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })),
});
type CreatureRequest = z.infer<typeof creatureRequestSchema>;

export function buildCreatureState(body: CreatureRequest) {
  return {
    description: 'A fictional creature world. Positions are percentages. Apply the latest instruction within supported actions and locations.',
    creatures, landmarks, needs: body.needs,
    autonomous_reconsideration: body.automatic, current_positions: body.positions, previous_world: body.world, history: body.history, latest_user_instruction: body.automatic ? body.history.at(-1) ?? null : body.prompt, latest_instruction: body.prompt,
  };
}

export function buildOpenAICreatureRequest(body: CreatureRequest) {
  return {
    model: 'gpt-6-luna', input: JSON.stringify(buildCreatureState(body)),
    questions: Object.entries(buildQuestions()).map(([name, question]) => question.type === 'noul'
      ? { type: 'predicate' as const, name, instructions: question.instructions }
      : { type: 'choice' as const, name, instructions: question.instructions, choices: Object.entries(question.criteria).map(([value, description]) => ({ value, description })) }),
  };
}

export function buildCreatureApiCall(body: CreatureRequest) {
  const openai = body.provider === 'openai';
  return {
    provider: body.provider, automatic: Boolean(body.automatic),
    endpoint: openai ? 'https://api.openai.com/v1/decisions' : 'https://openrouter.ai/api/alpha/decisions',
    params: openai ? buildOpenAICreatureRequest(body) : { model: 'typesafe/jev-1.13', state: buildCreatureState(body), questions: buildQuestions() },
  };
}

export function buildCreatureCallTrace(call: ReturnType<typeof buildCreatureApiCall>, response: unknown, status: number | null, latency: number, secrets: string[]): CreatureCallTrace {
  const redact = (text: string) => secrets.reduce((value, secret) => secret ? value.replaceAll(secret, '[REDACTED]') : value, text);
  return {
    provider: call.provider, automatic: call.automatic, endpoint: call.endpoint,
    request: redact(JSON.stringify(call.params, null, 2)),
    response: response === null ? null : redact(typeof response === 'string' ? response : JSON.stringify(response, null, 2)),
    status, latency, usage: estimateDecisionUsage(call.provider, call.params, response, status),
  };
}

const choiceSchema = z.object({ choice: z.string(), confidence: probability, probabilities: z.record(probability) });
const openAIResponseSchema = z.object({ model: z.string(), answers: z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice'), name: z.string(), choice: z.string(), confidence: probability, probabilities: z.array(z.object({ value: z.string(), probability })).min(1) }),
  z.object({ type: z.literal('predicate'), name: z.string(), probability }),
])) });

export function normalizeOpenAICreatureResponse(raw: unknown) {
  const data = openAIResponseSchema.parse(raw), questions = buildQuestions();
  const answers: Record<string, unknown> = {};
  if (data.answers.length !== Object.keys(questions).length) throw new Error('invalid');
  for (const answer of data.answers) {
    const question = questions[answer.name];
    if (!question || Object.hasOwn(answers, answer.name)) throw new Error('invalid');
    if (answer.type === 'predicate' && question.type === 'noul') answers[answer.name] = { noul: answer.probability };
    else if (answer.type === 'choice' && question.type === 'choice') {
      const values = answer.probabilities.map(p => p.value);
      if (!Object.hasOwn(question.criteria, answer.choice) || new Set(values).size !== values.length || values.some(value => !Object.hasOwn(question.criteria, value))) throw new Error('invalid');
      answers[answer.name] = { choice: answer.choice, confidence: answer.confidence, probabilities: Object.fromEntries(answer.probabilities.map(p => [p.value, p.probability])) };
    } else throw new Error('invalid');
  }
  return { model: data.model, answers };
}

export function readCreatureWorld(raw: unknown) {
  const data = z.object({ model: z.string(), answers: z.record(z.unknown()) }).parse(raw), a = data.answers, world = initialWorld();
  world.cake = location.parse(choiceSchema.parse(a.cake).choice);
  world.lava = location.parse(choiceSchema.parse(a.lava).choice);
  world.weather = z.enum(['clear','rain','disco','night']).parse(choiceSchema.parse(a.weather).choice);
  for (const c of creatures) {
    const action = choiceSchema.parse(a[`${c.id}_action`]), target = choiceSchema.parse(a[`${c.id}_target`]).choice;
    const flying = z.object({ noul: probability }).parse(a[`${c.id}_flying`]).noul;
    if (![...Object.keys(places), ...creatures.filter(o => o.id !== c.id).map(o => o.id)].includes(target)) throw new Error('invalid');
    world.decisions[c.id] = { action: actionSchema.parse(action.choice), target, flying: flying >= .5, confidence: action.confidence, probabilities: action.probabilities };
  }
  return { world, model: data.model };
}
