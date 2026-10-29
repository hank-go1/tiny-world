export const WORLD = { width: 3200, height: 2400 };
export type Point = { x: number; y: number };
export type PlaceKind = 'home' | 'cafe' | 'bakery' | 'grocer' | 'arcade' | 'library' | 'school' | 'park' | 'camp';
export type Place = Point & { id: string; name: string; kind: PlaceKind; width: number; height: number; color: string; description: string; roadY: number };

const homes: Place[] = [
  ...[570, 810, 1050, 1290, 1600, 1840].map((x, i) => ({ x, y: 210, roadY: 440, label: i + 1 })),
  ...[560, 800, 1110, 1350, 1670, 1910].map((x, i) => ({ x, y: 610, roadY: 850, label: i + 7 })),
  ...[1150, 1370, 1740, 2010, 2290].map((x, i) => ({ x, y: 1510, roadY: 1760, label: i + 13 })),
  ...[1150, 1370, 1740, 2010, 2290].map((x, i) => ({ x, y: 1900, roadY: 2140, label: i + 18 })),
].map(p => ({ ...p, id: `home-${p.label}`, name: `${p.label} Maple Lane`, kind: 'home' as const, width: 150, height: 150, color: ['#ed786b', '#ef9578', '#e5a663', '#83b4b0'][p.label % 4], description: 'A little home with a garden and a sunny front step.' }));

export const places: Place[] = [
  ...homes,
  { id: 'bakery', name: 'Buttercup Bakery', kind: 'bakery', x: 1120, y: 1020, width: 175, height: 170, color: '#ed8fa4', roadY: 1280, description: 'Fresh bread, warm pastries, and a very good excuse for a break.' },
  { id: 'grocer', name: 'The Green Basket', kind: 'grocer', x: 1370, y: 1020, width: 175, height: 170, color: '#54b49c', roadY: 1280, description: 'A neighborhood shop for everyday essentials.' },
  { id: 'cafe', name: 'Sunbeam Café', kind: 'cafe', x: 1630, y: 1020, width: 200, height: 170, color: '#edb644', roadY: 1280, description: 'Coffee, outdoor tables, and a familiar face at every visit.' },
  { id: 'arcade', name: 'Lucky Star Arcade', kind: 'arcade', x: 1910, y: 1020, width: 180, height: 170, color: '#a58ad5', roadY: 1280, description: 'A bright little place to play after a long day.' },
  { id: 'library', name: 'Maple Library', kind: 'library', x: 2220, y: 1040, width: 180, height: 150, color: '#7fb5c7', roadY: 1280, description: 'A quiet corner for reading and a bit of daydreaming.' },
  { id: 'school', name: 'Little Oak School', kind: 'school', x: 2230, y: 540, width: 240, height: 190, color: '#e7b576', roadY: 850, description: 'The schoolhouse beside the swings and playground.' },
  { id: 'park', name: 'Willow Park', kind: 'park', x: 610, y: 1560, width: 430, height: 470, color: '#78ac68', roadY: 1760, description: 'Winding paths, a duck pond, and a bench with your name on it.' },
  { id: 'camp', name: 'Riverside Camp', kind: 'camp', x: 2930, y: 1110, width: 350, height: 450, color: '#d9a253', roadY: 850, description: 'Three tents, a campfire, and the sound of the river.' },
];

export type Road = { points: Point[]; width: number };
export const roads: Road[] = [
  { points: [{ x: 350, y: 440 }, { x: 2470, y: 440 }], width: 68 },
  { points: [{ x: 320, y: 850 }, { x: 3020, y: 850 }], width: 74 },
  { points: [{ x: 970, y: 1280 }, { x: 2470, y: 1280 }], width: 82 },
  { points: [{ x: 950, y: 1760 }, { x: 2990, y: 1760 }], width: 68 },
  { points: [{ x: 420, y: 2140 }, { x: 2470, y: 2140 }], width: 66 },
  ...[1000, 1500, 2470].map(x => ({ points: [{ x, y: 440 }, { x, y: 2140 }], width: 70 })),
  { points: [{ x: 610, y: 850 }, { x: 610, y: 1110 }, { x: 410, y: 1280 }, { x: 370, y: 1570 }, { x: 470, y: 1810 }, { x: 730, y: 1850 }, { x: 940, y: 1660 }, { x: 1000, y: 1480 }], width: 48 },
  { points: [{ x: 610, y: 1850 }, { x: 610, y: 2140 }], width: 48 },
  { points: [{ x: 2930, y: 850 }, { x: 2930, y: 1560 }, { x: 2990, y: 1760 }], width: 44 },
];

// Shared road intersections keep ambient walkers on connected paths.
export const nodes: Point[] = [];
export const edges: [number, number][] = [];
function node(p: Point) {
  let index = nodes.findIndex(n => n.x === p.x && n.y === p.y);
  if (index === -1) { index = nodes.length; nodes.push(p); }
  return index;
}
const segments = roads.flatMap(r => r.points.slice(1).map((b, i) => ({ a: r.points[i], b })));
for (const { a, b } of segments) {
  const points = [a, b], dx = b.x - a.x, dy = b.y - a.y;
  for (const other of segments) {
    const ox = other.b.x - other.a.x, oy = other.b.y - other.a.y, cross = dx * oy - dy * ox;
    if (Math.abs(cross) < .00001) continue;
    const ax = other.a.x - a.x, ay = other.a.y - a.y;
    const t = (ax * oy - ay * ox) / cross, u = (ax * dy - ay * dx) / cross;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) points.push({ x: Math.round((a.x + t * dx) * 100) / 100, y: Math.round((a.y + t * dy) * 100) / 100 });
  }
  points.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
  for (let j = 1; j < points.length; j++) {
    const from = node(points[j - 1]), to = node(points[j]);
    if (from !== to && !edges.some(([x, y]) => x === from && y === to || x === to && y === from)) edges.push([from, to]);
  }
}
// Walk around the fountain instead of crossing its pool.
const center = nodes.findIndex(p => p.x === 1500 && p.y === 1280);
const ring = [{ x: 1500, y: 1165 }, { x: 1615, y: 1280 }, { x: 1500, y: 1395 }, { x: 1385, y: 1280 }].map(node);
for (let i = 0; i < edges.length; i++) {
  const [a, b] = edges[i];
  if (a !== center && b !== center) continue;
  const other = a === center ? b : a, p = nodes[other];
  const entry = p.x < 1500 ? ring[3] : p.x > 1500 ? ring[1] : p.y < 1280 ? ring[0] : ring[2];
  edges[i] = [other, entry];
}
ring.forEach((n, i) => edges.push([n, ring[(i + 1) % ring.length]]));
export const neighbors = nodes.map((_, i) => edges.flatMap(([a, b]) => a === i ? [b] : b === i ? [a] : []));

export type Resident = Point & { id: string; name: string; color: string; skin: string; hair: string; target: number; previous: number; step: number; home: string; waiting?: boolean; plan?: { placeId?: string; residentId?: string; lastTarget?: Point; waypoints: Point[]; arrived: boolean } };
const names = ['Maya', 'Oliver', 'Linh', 'Noah', 'Amara', 'Theo', 'Sofia', 'Kai', 'Isla', 'Leo', 'Ava', 'Arjun', 'Nora', 'Finn', 'Zoe', 'Eli', 'Milo', 'Ivy', 'Luca', 'Ruby', 'Jules', 'Emi', 'Sam', 'Ada'];
const profiles: { interests: PlaceKind[]; spending: string; description: string }[] = [
  { interests: ['bakery', 'cafe'], spending: 'Looks for bargains', description: 'A pastry lover who enjoys finding a good deal.' },
  { interests: ['park', 'camp'], spending: 'Shops only when needed', description: 'An outdoors person who would rather take a walk than shop.' },
  { interests: ['grocer', 'bakery'], spending: 'Budget conscious', description: 'A home cook who keeps an eye out for affordable ingredients.' },
  { interests: ['arcade', 'cafe'], spending: 'Spends on hobbies', description: 'A playful neighbor who enjoys games and catching up with friends.' },
  { interests: ['library', 'school'], spending: 'Shops only when needed', description: 'A quiet reader who is drawn to books and learning.' },
  { interests: ['camp', 'park'], spending: 'Looks for bargains', description: 'An adventurous bargain hunter who likes being outside.' },
  { interests: ['cafe', 'park'], spending: 'Values experiences over shopping', description: 'A social neighbor who enjoys gatherings and meeting people.' },
  { interests: ['arcade', 'library'], spending: 'Budget conscious', description: 'A curious games and books fan who prefers inexpensive activities.' },
];
export function residentProfile(person: Pick<Resident, 'id'>) {
  return profiles[Number(person.id.split('-')[1]) % profiles.length];
}
export function createResidents(): Resident[] {
  return names.map((name, i) => {
    const edge = edges[(i * 7 + 3) % edges.length];
    const a = nodes[edge[0]], b = nodes[edge[1]], t = .15 + (i % 5) * .14;
    return { id: `resident-${i}`, name, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, target: edge[1], previous: edge[0], step: i, color: ['#d97591', '#5aaac4', '#e7ac43', '#7ca46b', '#9b83bf', '#e78f66'][i % 6], skin: ['#d8a373', '#b77d50', '#e8bd92', '#8e5b3d'][i % 4], hair: ['#50382c', '#342f2b', '#b47c38', '#72503b'][i % 4], home: homes[i % homes.length].id };
  });
}

export function walkResidents(residents: Resident[], seconds: number) {
  const positions = new Map(residents.map(p => [p.id, { x: p.x, y: p.y }]));
  for (const person of residents) {
    if (person.waiting || person.plan?.arrived) continue;
    const meeting = person.plan?.residentId ? positions.get(person.plan.residentId) : undefined;
    if (person.plan?.residentId && !meeting) continue;
    if (meeting && person.plan) {
      if (Math.hypot(meeting.x - person.x, meeting.y - person.y) <= 28) { person.plan.arrived = true; person.plan.waypoints = []; continue; }
      const last = person.plan.lastTarget;
      if (!last || Math.hypot(last.x - meeting.x, last.y - meeting.y) > 35 || !person.plan.waypoints.length) {
        person.plan.waypoints = routeResident(person, meeting); person.plan.lastTarget = meeting;
      }
    }
    let distance = seconds * (30 + Number(person.id.split('-')[1]) % 5 * 3) * (person.plan ? 5 : 1);
    if (person.plan) {
      while (distance > 0 && person.plan.waypoints.length) {
        const next = person.plan.waypoints[0], dx = next.x - person.x, dy = next.y - person.y, length = Math.hypot(dx, dy);
        if (length > distance) { person.x += dx / length * distance; person.y += dy / length * distance; break; }
        person.x = next.x; person.y = next.y; distance -= length; person.plan.waypoints.shift();
      }
      person.plan.arrived = meeting ? Math.hypot(meeting.x - person.x, meeting.y - person.y) <= 28 : person.plan.waypoints.length === 0;
      continue;
    }
    while (distance > 0) {
      const target = nodes[person.target], dx = target.x - person.x, dy = target.y - person.y, length = Math.hypot(dx, dy);
      if (length > distance) { person.x += dx / length * distance; person.y += dy / length * distance; break; }
      person.x = target.x; person.y = target.y; distance -= length;
      const choices = neighbors[person.target].filter(n => n !== person.previous);
      const next = choices.length ? choices[person.step++ % choices.length] : person.previous;
      person.previous = person.target; person.target = next;
    }
  }
}

export function snapResident(person: Resident, point: Point) {
  const desired = { x: point.x, y: point.y };
  let closest = Infinity;
  for (const [a, b] of edges) {
    const from = nodes[a], to = nodes[b], dx = to.x - from.x, dy = to.y - from.y;
    const t = Math.max(0, Math.min(1, ((desired.x - from.x) * dx + (desired.y - from.y) * dy) / (dx * dx + dy * dy)));
    const x = from.x + dx * t, y = from.y + dy * t, d = Math.hypot(desired.x - x, desired.y - y);
    if (d < closest) { closest = d; person.x = x; person.y = y; person.previous = a; person.target = b; }
  }
  if (person.plan?.placeId) directResident(person, `go:${person.plan.placeId}`);
  else if (person.plan?.residentId) { person.plan.waypoints = []; person.plan.arrived = false; delete person.plan.lastTarget; }
}

function roadPoint(point: Point) {
  let closest = { a: 0, b: 0, x: 0, y: 0, distance: Infinity };
  for (const [a, b] of edges) {
    const from = nodes[a], to = nodes[b], dx = to.x - from.x, dy = to.y - from.y;
    const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)));
    const x = from.x + dx * t, y = from.y + dy * t, distance = Math.hypot(point.x - x, point.y - y);
    if (distance < closest.distance) closest = { a, b, x, y, distance };
  }
  return closest;
}

// Route across the existing road graph, including the detour around the fountain.
export function directResident(person: Resident, choice: string, residents: Resident[] = []) {
  if (choice === 'keep') return;
  if (choice === 'wait' || choice === 'wander') {
    delete person.plan; person.waiting = choice === 'wait';
    if (choice === 'wander') snapResident(person, person);
    return;
  }
  if (choice.startsWith('meet:')) {
    const target = residents.find(p => choice === `meet:${p.id}` && p.id !== person.id);
    if (!target) throw new Error('Unknown resident destination.');
    person.waiting = false;
    person.plan = { residentId: target.id, lastTarget: { x: target.x, y: target.y }, waypoints: routeResident(person, target), arrived: false };
    return;
  }
  const place = places.find(p => choice === `go:${p.id}`);
  if (!place) throw new Error('Unknown resident destination.');
  const offset = (Number(person.id.split('-')[1]) % 7 - 3) * 12;
  person.waiting = false;
  person.plan = { placeId: place.id, waypoints: routeResident(person, { x: place.x + offset, y: place.roadY }), arrived: false };
}

function routeResident(person: Resident, destination: Point) {
  const start = roadPoint(person), end = roadPoint(destination);
  const distances = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
  for (const n of [start.a, start.b]) distances[n] = Math.hypot(start.x - nodes[n].x, start.y - nodes[n].y);
  while (true) {
    let current = -1;
    for (let n = 0; n < nodes.length; n++) if (!visited.has(n) && Number.isFinite(distances[n]) && (current === -1 || distances[n] < distances[current])) current = n;
    if (current === -1) break;
    visited.add(current);
    for (const next of neighbors[current]) {
      const distance = distances[current] + Math.hypot(nodes[next].x - nodes[current].x, nodes[next].y - nodes[current].y);
      if (distance < distances[next]) { distances[next] = distance; previous[next] = current; }
    }
  }
  const finish = [end.a, end.b].sort((a, b) => distances[a] + Math.hypot(nodes[a].x - end.x, nodes[a].y - end.y) - distances[b] - Math.hypot(nodes[b].x - end.x, nodes[b].y - end.y))[0];
  const route: Point[] = [];
  for (let n = finish; n !== -1; n = previous[n]) route.unshift(nodes[n]);
  if (start.a === end.a && start.b === end.b) route.length = 0;
  person.x = start.x; person.y = start.y;
  return [...route, { x: end.x, y: end.y }];
}

export function residentActivity(person: Resident) {
  if (person.plan?.residentId) return `${person.plan.arrived ? 'Met' : 'Heading to'} ${names[Number(person.plan.residentId.split('-')[1])]}`;
  const destination = places.find(p => p.id === person.plan?.placeId);
  if (destination) return `${person.plan?.arrived ? 'At' : 'Heading to'} ${destination.name}`;
  return person.waiting ? 'Waiting here' : 'Exploring the town';
}
