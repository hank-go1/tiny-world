import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionRequests } from './decision-requests.ts';

test('chat preempts automatic work and its stale response cannot replace the new direction', () => {
  const requests = createDecisionRequests();
  const automatic = requests.begin(true);
  const manual = requests.begin(false);
  assert.equal(automatic.controller.signal.reason, 'superseded');
  assert.equal(requests.isCurrent(automatic), false);
  assert.equal(requests.owns(automatic), false);
  assert.equal(requests.finish(automatic), false);
  assert.equal(requests.busy, true);
  assert.equal(requests.isCurrent(manual), true);
  assert.equal(requests.owns(manual), true);
  assert.equal(requests.finish(manual), true);
  assert.equal(requests.busy, false);
  assert.ok(requests.begin(true));
});
test('automatic ticks cannot interrupt chat and duplicate chat submissions do not overlap', () => {
  const requests = createDecisionRequests(), manual = requests.begin(false);
  assert.equal(requests.begin(true), null);
  assert.equal(requests.begin(false), null);
  assert.equal(manual.controller.signal.aborted, false);
  assert.equal(requests.isCurrent(manual), true);
});
test('pause, reset, and stopping auto invalidate late responses without affecting a newer request', () => {
  const requests = createDecisionRequests(), first = requests.begin(true);
  requests.cancel();
  const next = requests.begin(false);
  assert.equal(first.controller.signal.reason, 'cancelled');
  assert.equal(requests.isCurrent(first), false);
  assert.equal(requests.finish(first), false);
  assert.equal(requests.isCurrent(next), true);
});
