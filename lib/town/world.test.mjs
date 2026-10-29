import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, createResidents, directResident, edges, neighbors, nodes, places, residentActivity, snapResident, walkResidents } from './world.ts';

test('every walkable road belongs to one connected neighborhood', () => {
  const active = new Set(edges.flat());
  const visited = new Set(), queue = [edges[0][0]];
  while (queue.length) {
    const node = queue.shift();
    if (visited.has(node)) continue;
    visited.add(node); queue.push(...neighbors[node]);
  }
  assert.equal(visited.size, active.size);
});

test('residents stay on paths, within the map, and outside the fountain after a long walk', () => {
  const residents = createResidents();
  for (let tick = 0; tick < 600; tick++) {
    walkResidents(residents, 1);
    for (const p of residents) {
      assert.ok(p.x >= 0 && p.x <= WORLD.width && p.y >= 0 && p.y <= WORLD.height);
      assert.ok(Math.hypot(p.x - 1500, p.y - 1280) > 66, `${p.name} walked through the fountain`);
      assert.ok(edges.some(([a, b]) => {
        const from = nodes[a], to = nodes[b];
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        return Math.abs(Math.hypot(p.x - from.x, p.y - from.y) + Math.hypot(p.x - to.x, p.y - to.y) - length) < .001;
      }), `${p.name} left the path`);
    }
  }
});

test('dragging snaps to the nearest path using the original drop position', () => {
  const person = createResidents()[0];
  person.x = 2910; person.y = 1120;
  snapResident(person, person);
  assert.equal(person.x, 2930);
  assert.equal(person.y, 1120);
  walkResidents([person], 1);
  assert.equal(person.x, 2930);
  assert.ok(person.y > 1120);
});

test('directed walks reach every destination along roads and remain there', () => {
  const residents = createResidents();
  for (const place of places) {
    for (const person of residents) directResident(person, `go:${place.id}`);
    for (let tick = 0; tick < 350; tick++) {
      walkResidents(residents, 1);
      for (const p of residents) {
        assert.ok(Math.hypot(p.x - 1500, p.y - 1280) > 66, `${p.name} crossed the fountain`);
        assert.ok(edges.some(([a, b]) => Math.abs(Math.hypot(p.x - nodes[a].x, p.y - nodes[a].y) + Math.hypot(p.x - nodes[b].x, p.y - nodes[b].y) - Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y)) < .001), `${p.name} left the road`);
      }
    }
    for (const p of residents) {
      assert.ok(p.plan.arrived, `${p.name} did not arrive at ${place.name}`);
      assert.ok(residentActivity(p).startsWith('At '));
      const position = { x: p.x, y: p.y };
      walkResidents([p], 100);
      assert.deepEqual({ x: p.x, y: p.y }, position);
    }
  }
});

test('wait, keep, resume wandering, and dragging preserve explicit plans', () => {
  const person = createResidents()[0], start = { x: person.x, y: person.y };
  directResident(person, 'wait'); walkResidents([person], 5);
  assert.deepEqual({ x: person.x, y: person.y }, start);
  directResident(person, 'keep'); assert.equal(person.waiting, true);
  directResident(person, 'go:cafe');
  const plan = person.plan;
  directResident(person, 'keep'); assert.equal(person.plan, plan);
  person.x = 2930; person.y = 1120; snapResident(person, person);
  assert.equal(person.plan.placeId, 'cafe');
  walkResidents([person], 1000); assert.equal(person.plan.arrived, true);
  directResident(person, 'wander'); assert.equal(person.plan, undefined);
  const atCafe = { x: person.x, y: person.y }; walkResidents([person], 1);
  assert.notDeepEqual({ x: person.x, y: person.y }, atCafe);
  assert.throws(() => directResident(person, 'go:missing'));
});

test('Sofia reaches moving Arjun on the roads and stops nearby', () => {
  const residents = createResidents(), sofia = residents.find(p => p.name === 'Sofia'), arjun = residents.find(p => p.name === 'Arjun');
  const arjunStart = { x: arjun.x, y: arjun.y };
  directResident(sofia, `meet:${arjun.id}`, residents);
  assert.equal(residentActivity(sofia), 'Heading to Arjun');
  for (let tick = 0; tick < 4000 && !sofia.plan.arrived; tick++) {
    walkResidents(residents, .25);
    assert.ok(Math.hypot(sofia.x - 1500, sofia.y - 1280) > 66);
    assert.ok(edges.some(([a, b]) => Math.abs(Math.hypot(sofia.x - nodes[a].x, sofia.y - nodes[a].y) + Math.hypot(sofia.x - nodes[b].x, sofia.y - nodes[b].y) - Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y)) < .001));
  }
  assert.ok(sofia.plan.arrived);
  assert.ok(Math.hypot(sofia.x - arjun.x, sofia.y - arjun.y) < 40);
  assert.notDeepEqual({ x: arjun.x, y: arjun.y }, arjunStart);
  assert.equal(residentActivity(sofia), 'Met Arjun');
  const end = { x: sofia.x, y: sofia.y }; walkResidents(residents, 1);
  assert.deepEqual({ x: sofia.x, y: sofia.y }, end);
  directResident(sofia, 'wander'); assert.equal(sofia.plan, undefined);
});

test('resident destinations can be changed, dragged, stopped, and cannot target themselves', () => {
  const residents = createResidents(), [maya, oliver] = residents;
  directResident(oliver, 'wait');
  directResident(maya, `meet:${oliver.id}`, residents);
  maya.x = 2930; maya.y = 1120; snapResident(maya, maya);
  assert.equal(maya.plan.residentId, oliver.id);
  walkResidents(residents, .25); assert.ok(maya.plan.waypoints.length);
  directResident(maya, 'go:park'); assert.equal(maya.plan.residentId, undefined);
  directResident(maya, `meet:${oliver.id}`, residents);
  directResident(maya, 'wait'); assert.equal(maya.plan, undefined); assert.equal(maya.waiting, true);
  assert.throws(() => directResident(maya, `meet:${maya.id}`, residents));
  assert.throws(() => directResident(maya, 'meet:missing', residents));
});
