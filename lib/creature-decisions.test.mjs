import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { buildQuestions, creatures, initialWorld, initialNeeds } from './world.ts';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(['./world','./decision-costs'].includes(specifier) && context.parentURL?.endsWith('/creature-decisions.ts') ? `${specifier}.ts` : specifier, context);
} });
const { creatureRequestSchema, buildOpenAICreatureRequest, buildCreatureState, buildCreatureApiCall, buildCreatureCallTrace, normalizeOpenAICreatureResponse, readCreatureWorld } = await import('./creature-decisions.ts');
const body = () => creatureRequestSchema.parse({ provider: 'openai', apiKey: 'private-browser-key', prompt: 'Pip can fly. Bean, eat at the orchard.', history: ['Cake at the pond'], world: initialWorld(), needs: initialNeeds(), positions: Object.fromEntries(creatures.map(c => [c.id, { x:c.x, y:c.y }])) });
function response() {
  return { model:'gpt-6-luna', answers:Object.entries(buildQuestions()).map(([name, q]) => {
    if (q.type === 'noul') return { type:'predicate', name, probability:name === 'pip_flying' ? .99 : .01 };
    const choice = name === 'cake' || name === 'lava' ? 'none' : name === 'weather' ? 'clear' : name.endsWith('_action') ? 'eat' : 'orchard';
    return { type:'choice', name, choice, confidence:.98, probabilities:Object.keys(q.criteria).map(value => ({ value, probability:value === choice ? 1 : 0 })) };
  }) };
}
test('both engines receive identical world context and all 33 original questions', () => {
  const parsed = body(), request = buildOpenAICreatureRequest(parsed), original = buildQuestions();
  assert.equal(request.model, 'gpt-6-luna');
  assert.equal(request.questions.length, 33);
  assert.equal(JSON.parse(request.input).latest_user_instruction, parsed.prompt);
  assert.deepEqual(JSON.parse(request.input), JSON.parse(JSON.stringify(buildCreatureState(parsed))));
  assert.ok(!request.input.includes(parsed.apiKey));
  for (const q of request.questions) {
    assert.equal(q.instructions, original[q.name].instructions);
    assert.equal(q.type, original[q.name].type === 'noul' ? 'predicate' : 'choice');
    if (q.type === 'choice') assert.deepEqual(Object.fromEntries(q.choices.map(c => [c.value,c.description])), original[q.name].criteria);
  }
  parsed.automatic = true;
  const state = buildCreatureState(parsed);
  assert.equal(state.autonomous_reconsideration, true);
  assert.equal(state.latest_user_instruction, 'Cake at the pond');
  assert.deepEqual(state.needs, initialNeeds());
  assert.deepEqual(state.history, ['Cake at the pond']);
});
test('OpenAI probabilities and flight predicates produce the existing renderer world', () => {
  const normalized = normalizeOpenAICreatureResponse(response());
  const { world, model } = readCreatureWorld(normalized);
  assert.equal(model, 'gpt-6-luna');
  assert.equal(world.decisions.pip.flying, true);
  assert.equal(world.decisions.mochi.flying, false);
  assert.equal(world.decisions.bean.action, 'eat');
  assert.equal(world.decisions.bean.target, 'orchard');
  assert.equal(world.decisions.bean.confidence, .98);
  assert.equal(world.decisions.bean.probabilities.eat, 1);
  assert.deepEqual(readCreatureWorld(normalized).world, world);
  assert.equal(creatureRequestSchema.parse({ ...body(), provider:undefined }).provider, 'jev');
});
test('neither engine receives a clock or mandatory bedtime rules', () => {
  const parsed = creatureRequestSchema.parse({ ...body(), clock:{ running:true, day:2, minute:1260 }, automatic:true });
  parsed.world.weather = 'night';
  const state = buildCreatureState(parsed), request = buildOpenAICreatureRequest(parsed);
  assert.equal(Object.hasOwn(parsed, 'clock'), false);
  assert.equal(Object.hasOwn(state, 'world_clock'), false);
  assert.equal(JSON.parse(request.input).previous_world.weather, 'night');
  assert.equal(state.autonomous_reconsideration, true);
  for (const q of Object.values(buildQuestions())) assert.doesNotMatch(q.instructions, /clock|curfew|bedtime|8:00 PM|6:00 AM|heading home/i);
});
test('incomplete, duplicate, refused, out-of-range and unsupported answers cannot change the world', () => {
  const mutations = [
    r => r.answers.pop(),
    r => r.answers[1] = r.answers[0],
    r => r.answers[0] = { type:'refusal', name:'cake' },
    r => r.answers.find(a => a.name === 'pip_action').choice = 'teleport',
    r => r.answers.find(a => a.name === 'pip_target').choice = 'pip',
    r => r.answers.find(a => a.name === 'pip_flying').probability = 2,
    r => r.answers[0].probabilities.push(r.answers[0].probabilities[0]),
  ];
  for (const mutate of mutations) { const r = response(); mutate(r); assert.throws(() => readCreatureWorld(normalizeOpenAICreatureResponse(r))); }
});
test('the inspector captures the exact provider parameters and raw response without credentials', () => {
  for (const provider of ['openai','jev']) {
    const parsed = { ...body(), provider }, call = buildCreatureApiCall(parsed), raw = response();
    const trace = buildCreatureCallTrace(call, raw, 200, 850, [parsed.apiKey]);
    assert.equal(trace.provider, provider);
    assert.equal(trace.status, 200);
    assert.equal(trace.latency, 850);
    assert.deepEqual(JSON.parse(trace.request), JSON.parse(JSON.stringify(call.params)));
    assert.deepEqual(JSON.parse(trace.response), raw);
    assert.ok(!JSON.stringify(trace).includes(parsed.apiKey));
    if (provider === 'openai') {
      assert.equal(call.endpoint, 'https://api.openai.com/v1/decisions');
      assert.deepEqual(call.params, buildOpenAICreatureRequest(parsed));
    } else {
      assert.equal(call.endpoint, 'https://openrouter.ai/api/alpha/decisions');
      assert.deepEqual(call.params.state, buildCreatureState(parsed));
      assert.deepEqual(call.params.questions, buildQuestions());
    }
  }
});
test('upstream errors that echo credentials are redacted, and network failures have no response body', () => {
  const parsed = body(), call = buildCreatureApiCall(parsed);
  const trace = buildCreatureCallTrace(call, { error:{message:`Rejected ${parsed.apiKey} and server-secret`} }, 401, 100, [parsed.apiKey, 'server-secret']);
  assert.equal(JSON.parse(trace.response).error.message, 'Rejected [REDACTED] and [REDACTED]');
  const textError = buildCreatureCallTrace(call, `Bad key ${parsed.apiKey}`, 502, 100, [parsed.apiKey]);
  assert.equal(textError.response, 'Bad key [REDACTED]');
  assert.equal(buildCreatureCallTrace(call, null, null, 20000, []).response, null);
});
