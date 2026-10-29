import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createResidents, residentActivity } from './world.ts';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(['./world', './weather'].includes(specifier) && context.parentURL?.endsWith('/decisions.ts') ? `${specifier}.ts` : specifier, context);
} });
const { buildTownDecisionRequest, readTownDecisions, readTownReply, rememberTownNews, townChatRequest } = await import('./decisions.ts');
const residents = createResidents();
const body = { prompt: 'Maya, go to the park.', history: [], news: [], townTime: Date.now(), weather: 'clear', trigger: 'message', closed: ['cafe'], residents: residents.map(p => ({ id: p.id, x: p.x, y: p.y, activity: residentActivity(p), atPlace: null })) };
const response = () => ({ answers: residents.map(p => ({ name: p.id, type: 'choice', choice: p.id === 'resident-0' ? 'go:park' : 'keep', confidence: .99 })) });

test('one bounded choice per resident excludes closed places and includes the latest context', () => {
  const request = buildTownDecisionRequest(townChatRequest.parse(body));
  assert.equal(request.questions.length, 25);
  assert.equal(new Set(request.questions.map(q => q.name)).size, 25);
  assert.equal(JSON.parse(request.input).latest_instruction, body.prompt);
  assert.equal(JSON.parse(request.input).residents[0].name, 'Maya');
  for (const question of request.questions.filter(q => q.name !== 'message_kind')) {
    assert.ok(!question.choices.some(c => c.value === 'go:cafe'));
    assert.ok(question.choices.some(c => c.value === 'keep'));
  }
  assert.equal(readTownDecisions(response(), body.closed)[0].choice, 'go:park');
});

test('incomplete, repeated, refused, or unsupported model choices cannot be applied', () => {
  const mutations = [
    data => data.answers.pop(),
    data => { data.answers[0].name = data.answers[1].name; },
    data => { data.answers[0] = { type: 'refusal', name: 'resident-0' }; },
    data => { data.answers[0].choice = 'go:missing'; },
    data => { data.answers[0].choice = 'go:cafe'; },
    data => { data.answers[0].confidence = 5; },
  ];
  for (const mutate of mutations) { const data = response(); mutate(data); assert.throws(() => readTownDecisions(data, body.closed)); }
});

test('chat request rejects missing or duplicate residents and oversized messages', () => {
  assert.equal(townChatRequest.safeParse({ ...body, prompt: ' '.repeat(10) }).success, false);
  assert.equal(townChatRequest.safeParse({ ...body, prompt: 'x'.repeat(1001) }).success, false);
  assert.equal(townChatRequest.safeParse({ ...body, residents: body.residents.slice(1) }).success, false);
  assert.equal(townChatRequest.safeParse({ ...body, residents: body.residents.map(() => body.residents[0]) }).success, false);
});

test('resident destinations are offered and validated for Sofia go to Arjun', () => {
  const sofia = residents.find(p => p.name === 'Sofia'), arjun = residents.find(p => p.name === 'Arjun');
  const request = buildTownDecisionRequest({ ...body, prompt: 'Sofia go to Arjun' });
  const question = request.questions.find(q => q.name === sofia.id);
  assert.ok(question.choices.some(choice => choice.value === `meet:${arjun.id}`));
  assert.ok(!question.choices.some(choice => choice.value === `meet:${sofia.id}`));
  const data = response();
  data.answers.find(answer => answer.name === sofia.id).choice = `meet:${arjun.id}`;
  assert.equal(readTownDecisions(data, body.closed).find(d => d.residentId === sofia.id).choice, `meet:${arjun.id}`);
  data.answers.find(answer => answer.name === sofia.id).choice = `meet:${sofia.id}`;
  assert.throws(() => readTownDecisions(data, body.closed));
});

test('news and different resident preferences are supplied independently of direct orders', () => {
  const request = buildTownDecisionRequest({ ...body, prompt: 'The bakery is selling off 50% of their products', news: ['The library has a book club today.'] });
  const context = JSON.parse(request.input);
  assert.deepEqual(context.town_news, ['The library has a book club today.']);
  assert.ok(context.residents.find(p => p.name === 'Maya').profile.interests.includes('bakery'));
  assert.ok(context.residents.find(p => p.name === 'Amara').profile.interests.includes('library'));
  assert.notDeepEqual(context.residents[0].profile, context.residents[1].profile);
  assert.ok(request.questions.find(q => q.name === 'message_kind').choices.some(c => c.value === 'announcement'));
});

test('news classification and resident actions are validated together before applying either', () => {
  const data = response();
  data.answers.push({ name: 'message_kind', type: 'choice', choice: 'announcement', confidence: .99 });
  assert.equal(readTownReply(data, body.closed).messageKind, 'announcement');
  assert.equal(readTownReply(data, body.closed).decisions.length, 24);
  data.answers.at(-1).choice = 'conversation';
  assert.ok(readTownReply(data, body.closed).decisions.every(decision => decision.choice === 'keep'));
  data.answers.at(-1).choice = 'announcement';
  data.answers[0].choice = 'go:cafe';
  assert.throws(() => readTownReply(data, body.closed));
  data.answers[0].choice = 'keep';
  data.answers.at(-1).choice = 'unknown';
  assert.throws(() => readTownReply(data, body.closed));
  data.answers.pop();
  assert.throws(() => readTownReply(data, body.closed));
});

test('town news stays ordered, replaces exact repeats, and is bounded to twelve entries', () => {
  const news = Array.from({ length: 12 }, (_, i) => `Announcement ${i}`);
  const next = rememberTownNews(news, 'A new town event');
  assert.equal(next.length, 12); assert.equal(next[0], 'Announcement 1'); assert.equal(next.at(-1), 'A new town event');
  const repeated = rememberTownNews(next, 'Announcement 5');
  assert.equal(repeated.length, 12); assert.equal(repeated.at(-1), 'Announcement 5');
  assert.equal(repeated.filter(item => item === 'Announcement 5').length, 1);
});

test('weather changes include authoritative conditions and distinguish shelter from exposed residents', () => {
  const snapshot = { ...body, weather: 'storm', previousWeather: 'clear', trigger: 'weather', residents: body.residents.map((p, i) => ({ ...p, atPlace: i === 0 ? 'library' : i === 1 ? 'park' : null })) };
  const request = buildTownDecisionRequest(townChatRequest.parse(snapshot)), context = JSON.parse(request.input);
  assert.equal(context.weather, 'storm'); assert.equal(context.previous_weather, 'clear'); assert.equal(context.trigger, 'weather');
  assert.equal(context.residents[0].sheltered, true);
  assert.equal(context.residents[1].sheltered, false);
  assert.equal(context.residents[2].sheltered, false);
  assert.equal(context.places.find(p => p.id === 'cafe').indoors, true);
  assert.equal(context.places.find(p => p.id === 'camp').indoors, false);
  assert.equal(context.places.find(p => p.id === 'cafe').open, false);
  assert.ok(!request.questions.find(q => q.name === 'resident-0').choices.some(c => c.value === 'go:cafe'));
  assert.equal(townChatRequest.safeParse({ ...snapshot, weather: 'unknown' }).success, false);
  assert.equal(townChatRequest.safeParse({ ...snapshot, residents: snapshot.residents.map(p => ({ ...p, atPlace: 'missing' })) }).success, false);
});
