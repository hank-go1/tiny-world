import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Match the app bundler's extensionless TypeScript import in Node's test runner.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === './world' && context.parentURL?.endsWith('/calendar.ts') ? './world.ts' : specifier, context);
} });
const { applyCalendarCommand, isCalendarDate, monthDays, moveMonth, removeOccasion, saveOccasion, townDateKey } = await import('./calendar.ts');

test('month navigation and the Monday-first grid cross years and include leap day', () => {
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2027-01', -1), '2026-12');
  const days = monthDays('2028-02');
  assert.equal(days.length, 42); assert.equal(days[0], '2028-01-31');
  assert.ok(days.includes('2028-02-29')); assert.equal(new Date(`${days[0]}T12:00:00Z`).getUTCDay(), 1);
});

test('event dates reject impossible days and match the town timezone at midnight', () => {
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2028-02-29'), true);
  assert.equal(isCalendarDate('2026-04-31'), false);
  assert.equal(isCalendarDate('not-a-date'), false);
  assert.equal(townDateKey(Date.parse('2026-12-31T17:00:00Z')), '2027-01-01');
});

test('occasions can be added, edited, moved, and removed without losing other events', () => {
  const input = { title: 'A birthday picnic', kind: 'birthday', date: '2026-10-27', time: '16:00', placeId: 'park' };
  let events = saveOccasion([], input, 'birthday');
  events = saveOccasion(events, { ...input, title: 'Game night', kind: 'game-night' }, 'games');
  events = saveOccasion(events, { ...input, date: '2026-10-28', title: 'Birthday tomorrow' }, 'birthday');
  assert.equal(events.length, 2);
  assert.equal(events.find(event => event.id === 'birthday').date, '2026-10-28');
  assert.equal(removeOccasion(events, 'birthday')[0].id, 'games');
});

test('Jev marks a validated occasion using predefined choices without generating text', () => {
  const command = { type: 'mark_occasion', kind: 'picnic', date: '2026-10-31', time: '16:00', placeId: 'park' };
  const events = applyCalendarCommand([], command);
  assert.equal(events[0].title, 'Community picnic'); assert.equal(events[0].createdBy, 'jev');
  assert.equal(events[0].placeId, 'park'); assert.equal(events[0].date, command.date);
  assert.throws(() => applyCalendarCommand(events, { ...command, date: '2026-02-30' }));
  assert.throws(() => applyCalendarCommand(events, { ...command, placeId: 'imaginary-place' }));
  assert.throws(() => applyCalendarCommand(events, { ...command, title: 'Invented model text' }));
});
