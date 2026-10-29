export const creatures = [
  { id: 'pip', name: 'Pip', color: 'blue', hue: 35, trait: 'brave and curious', x: 38, y: 38 },
  { id: 'mochi', name: 'Mochi', color: 'pink', hue: 155, trait: 'shy and cautious', x: 52, y: 30 },
  { id: 'bean', name: 'Bean', color: 'yellow', hue: 240, trait: 'always hungry', x: 65, y: 42 },
  { id: 'zig', name: 'Zig', color: 'blue', hue: 35, trait: 'adventurous and energetic', x: 30, y: 58 },
  { id: 'lumi', name: 'Lumi', color: 'green', hue: 320, trait: 'calm and helpful', x: 47, y: 55 },
  { id: 'pebble', name: 'Pebble', color: 'pink', hue: 155, trait: 'nervous but loyal', x: 70, y: 62 },
  { id: 'bo', name: 'Bo', color: 'yellow', hue: 240, trait: 'bold and food motivated', x: 57, y: 73 },
  { id: 'miso', name: 'Miso', color: 'green', hue: 320, trait: 'playful and sociable', x: 25, y: 32 },
  { id: 'nova', name: 'Nova', color: 'blue', hue: 35, trait: 'fearless and independent', x: 79, y: 35 },
  { id: 'dot', name: 'Dot', color: 'pink', hue: 155, trait: 'gentle and easily startled', x: 35, y: 77 },
] as const;
export const landmarks = [
  { id: 'orchard', name: 'Berry orchard', emoji: '🌳', x: 17, y: 31, description: 'Pick berries and eat fruit under the trees.' },
  { id: 'pond', name: 'Moonpond', emoji: '💧', x: 79, y: 36, description: 'Fresh water for drinking and a safe place to swim.' },
  { id: 'cottage', name: 'Cozy cottage', emoji: '🏡', x: 19, y: 69, description: 'Shelter from rain, hide from danger, or sleep.' },
  { id: 'campfire', name: 'Campfire', emoji: '🔥', x: 51, y: 72, description: 'Gather, warm up, dance, or share a meal.' },
  { id: 'playground', name: 'Play meadow', emoji: '🛝', x: 80, y: 70, description: 'Play together, dance, and have fun.' },
  { id: 'lookout', name: 'Hilltop lookout', emoji: '⛰️', x: 50, y: 22, description: 'Explore, climb, and enjoy the view.' },
] as const;
export const actions = {
  approach: 'Move toward a destination or desired object.',
  flee: 'Move away from danger or an unwanted object.',
  follow: 'Follow another creature.',
  wait: 'Stay put; no applicable action or explicitly asked to stop.',
  eat: 'Travel to the orchard or cake and eat.',
  drink: 'Travel to the pond and drink fresh water.',
  sleep: 'Travel to the cottage or a specified place and sleep.',
  swim: 'Travel to the pond and swim in it.',
  dance: 'Travel to the requested place and dance.',
  play: 'Travel to the playground or a specified friend and play.',
  hide: 'Travel to shelter, usually the cottage, and hide.',
  explore: 'Travel to the lookout or another destination and explore.',
} as const;
export const activityLabels: Record<keyof typeof actions, string> = { approach: 'Moving', flee: 'Fleeing', follow: 'Following', wait: 'Waiting', eat: 'Eating', drink: 'Drinking', sleep: 'Sleeping', swim: 'Swimming', dance: 'Dancing', play: 'Playing', hide: 'Hiding', explore: 'Exploring' };
export const places = { orchard: [17,31], pond: [79,36], cottage: [19,69], campfire: [51,72], playground: [80,70], lookout: [50,22], top_left: [20,24], top_right: [80,24], bottom_left: [20,76], bottom_right: [80,76], center: [50,50] } as const;
export type Place = keyof typeof places;
export type Action = keyof typeof actions;
export type Decision = { action: Action; target: string; flying: boolean; confidence?: number; probabilities?: Record<string, number> };
export type World = { cake: Place | 'none'; lava: Place | 'none'; weather: 'clear' | 'rain' | 'disco' | 'night'; decisions: Record<string, Decision> };
export const initialWorld = (): World => ({ cake: 'none', lava: 'none', weather: 'clear', decisions: Object.fromEntries(creatures.map(c => [c.id, { action: 'wait', target: 'center', flying: false }])) });
export type CreatureQuestion = { type: 'choice'; instructions: string; criteria: Record<string, string> } | { type: 'noul'; instructions: string };
export function buildQuestions() {
  const options = Object.fromEntries(Object.keys(places).map(k => [k, landmarks.find(l => l.id === k)?.description ?? k.replaceAll('_',' ')]));
  const questions: Record<string, CreatureQuestion> = {
    cake: { type: 'choice', instructions: 'Where is the cake now? Apply the latest instruction to previous world state; keep unchanged unless moved, added, or removed.', criteria: { ...options, none: 'No cake exists' } },
    lava: { type: 'choice', instructions: 'Where is the circular lava patch now? Apply history and the latest instruction; lava around cake is at the cake position. Keep unchanged unless removed or moved.', criteria: { ...options, none: 'No lava exists' } },
    weather: { type: 'choice', instructions: 'What atmosphere should the scene have after the latest instruction? Preserve previous atmosphere if unchanged.', criteria: { clear: 'Normal daylight', rain: 'Rain or thunderstorm', disco: 'Dance party', night: 'Nighttime lighting' } },
  };
  for (const c of creatures) {
    const context = `For ${c.name}, id ${c.id}, a ${c.color} creature who is ${c.trait}. Use previous world, history and latest instruction; latest instruction overrides older ones. Questions are independent; infer current scene changes yourself. Read this creature’s current needs (0–100; high hunger needs food, low energy needs rest, low courage fears storms). During autonomous reconsideration, continue active user-directed activities from latest_user_instruction and history until completed or changed by the user. Choose new activities based on needs and the situation for creatures without an active user direction. An automatic reconsideration is not a new user command. `;
    questions[`${c.id}_action`] = { type: 'choice', instructions: context + 'What action should this creature take? Non-flying creatures avoid lava. Flying creatures can approach cake over lava. Respect which creatures are addressed. Choose a concrete activity (eat, drink, sleep, swim, dance, play, hide, explore) when it fits; use approach for plain movement. For open-ended situations use personality to choose a response, rather than making everybody identical. Leave unaddressed creatures doing their previous activity unless the situation affects them.', criteria: actions };
    questions[`${c.id}_target`] = { type: 'choice', instructions: context + 'Which destination or creature is the target of its action? For fleeing, choose the danger location, not the safe destination. For cake, choose its current position. Use the map landmarks: orchard for food, pond for drinking or swimming, cottage for shelter or sleep, campfire for warmth, playground for play, lookout for exploring. Explicit user destinations override defaults. Keep previous target for ongoing actions. Use center if no target.', criteria: { ...options, ...Object.fromEntries(creatures.filter(o => o.id !== c.id).map(o => [o.id, `${o.name}, ${o.color}, ${o.trait}`])) } };
    questions[`${c.id}_flying`] = { type: 'noul', instructions: context + 'Is this creature currently able to fly? Initially none can fly. Abilities persist until revoked. Infer new abilities from the latest instruction.' };
  }
  return questions;
}

export type Needs = { hunger: number; energy: number; courage: number };
export type Positions = Record<string, { x: number; y: number }>;
export const initialNeeds = (): Record<string, Needs> => Object.fromEntries(creatures.map((c,i) => [c.id, { hunger: c.color === 'yellow' ? 75 : 25+i*4, energy: c.id === 'mochi' ? 35 : 80-i*3, courage: ['pip','zig','nova','bo'].includes(c.id) ? 85 : ['mochi','pebble','dot'].includes(c.id) ? 25 : 55 }]));
export function advanceNeeds(needs: Record<string, Needs>, world: World, positions: Positions): Record<string, Needs> {
  return Object.fromEntries(creatures.map(c => {
    const n = needs[c.id], d = world.decisions[c.id], p = positions[c.id];
    const target = places[d.target as Place];
    const arrived = target && Math.hypot(p.x-target[0],p.y-target[1]) <= 12;
    const eating = arrived && d.action === 'eat' && (d.target === 'orchard' || d.target === world.cake);
    const resting = arrived && d.action === 'sleep';
    const active = ['swim','play','dance','explore','flee'].includes(d.action);
    return [c.id, { ...n, hunger: Math.max(0,Math.min(100,n.hunger+(eating?-5:.35))), energy: Math.max(0,Math.min(100,n.energy+(resting?3:active?-.5:-.18))) }];
  }));
}
