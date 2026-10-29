import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTownTime, formatTownTime } from './clock.ts';

test('town calendar rolls from December into the next year in local time', () => {
  const start = Date.parse('2026-12-31T23:59:59+07:00');
  const next = formatTownTime(advanceTownTime(start, 1000, 1, false));
  assert.equal(next.time, '00:00:00');
  assert.equal(next.date, 'Fri, 1 Jan 2027');
});

test('calendar handles leap day and the end of February', () => {
  const leap = Date.parse('2028-02-28T23:59:59+07:00');
  assert.match(formatTownTime(advanceTownTime(leap, 1000, 1, false)).date, /29 Feb 2028/);
  const normal = Date.parse('2027-02-28T23:59:59+07:00');
  assert.match(formatTownTime(advanceTownTime(normal, 1000, 1, false)).date, /1 Mar 2027/);
});

test('pause freezes time and speed scales elapsed time without losing background intervals', () => {
  const start = Date.parse('2026-10-27T12:00:00+07:00');
  assert.equal(advanceTownTime(start, 3600000, 4, true), start);
  assert.equal(formatTownTime(advanceTownTime(start, 3600000, 1, false)).time, '13:00:00');
  assert.equal(formatTownTime(advanceTownTime(start, 3600000, 4, false)).time, '16:00:00');
});
