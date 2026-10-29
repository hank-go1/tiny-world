import { WORLD, places, roads, type Place, type Point, type Resident } from './world';
import type { TownWeather } from './weather';

type Ctx = CanvasRenderingContext2D;
export type Camera = Point & { zoom: number };
export type Viewport = { width: number; height: number };

function random(seed: number) {
  let value = seed;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
function box(c: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function oval(c: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function line(c: Ctx, points: Point[], color: string, width: number) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
}
function label(c: Ctx, text: string, x: number, y: number, size = 15, color = '#697c4c') {
  c.fillStyle = color; c.font = `700 ${size}px "Avenir Next", "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y);
}

export function riverX(y: number, side: 'left' | 'right') {
  return side === 'left' ? 135 + Math.sin(y / 370) * 75 : 2720 + Math.sin(y / 360) * 75;
}
function riverPath(side: 'left' | 'right') {
  const path = new Path2D(); path.moveTo(riverX(-100, side), -100);
  for (let y = -80; y <= WORLD.height + 100; y += 20) path.lineTo(riverX(y, side), y);
  return path;
}
function river(c: Ctx, side: 'left' | 'right') {
  const path = riverPath(side);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [width, color] of [[196, '#8dbb6a'], [176, '#efd7a5'], [145, '#bce0cb'], [128, '#77c5d0'], [97, '#82cdd5']] as const) {
    c.strokeStyle = color; c.lineWidth = width; c.stroke(path);
  }
  const rng = random(side === 'left' ? 73 : 91);
  for (let y = 70; y < WORLD.height; y += 150) {
    const x = riverX(y, side) + (rng() > .5 ? 1 : -1) * 94;
    oval(c, x + 5, y + 7, 19, 12, '#719b62');
    oval(c, x, y, 18, 17, '#a5afa4'); oval(c, x - 4, y - 5, 10, 9, '#c5c9b5');
  }
}
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function tree(c: Ctx, x: number, y: number, size: number, seed: number) {
  const rng = random(seed); c.save(); c.translate(x, y); c.scale(size, size);
  oval(c, 10, 19, 39, 18, '#6a984938'); box(c, -6, -6, 13, 31, 4, '#a87b4d');
  oval(c, 0, -14, 35, 33, '#467e4b');
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    oval(c, Math.cos(a) * 23, -23 + Math.sin(a) * 20, 17 + rng() * 5, 17 + rng() * 6, ['#4d934c', '#5d9f4d', '#69a750'][i % 3]);
  }
  oval(c, -10, -38, 18, 17, '#7db758'); oval(c, 5, -21, 20, 19, '#66a84c');
  c.restore();
}
function bush(c: Ctx, x: number, y: number, color = '#609b53') {
  oval(c, x + 3, y + 5, 20, 10, '#59864330');
  oval(c, x - 12, y, 12, 12, color); oval(c, x + 9, y - 4, 16, 14, color); oval(c, x, y - 11, 12, 12, '#78ad55');
}
function flowers(c: Ctx, x: number, y: number, color = '#fbf0cb') {
  for (let i = 0; i < 3; i++) {
    const px = x + i * 8 - 8, py = y + (i % 2) * 8;
    line(c, [{ x: px, y: py + 7 }, { x: px, y: py }], '#78a654', 2);
    for (let j = 0; j < 5; j++) oval(c, px + Math.cos(j * 1.26) * 3, py + Math.sin(j * 1.26) * 3, 2.7, 2.7, color);
    oval(c, px, py, 1.8, 1.8, '#e8b959');
  }
}
function fence(c: Ctx, x: number, y: number, width: number) {
  box(c, x, y + 9, width, 5, 2, '#f0e8c6');
  for (let i = 0; i < width; i += 14) box(c, x + i, y, 6, 26, 3, '#fff2d7');
}
function bench(c: Ctx, x: number, y: number, vertical = false) {
  c.save(); c.translate(x, y); if (vertical) c.rotate(Math.PI / 2);
  box(c, -32, -7, 68, 27, 7, '#60814d28');
  box(c, -23, -15, 5, 40, 2, '#667d5b'); box(c, 20, -15, 5, 40, 2, '#667d5b');
  for (let i = 0; i < 3; i++) box(c, -32, -12 + i * 8, 65, 6, 2, i === 0 ? '#c89b64' : '#b78b58');
  c.restore();
}
function lamp(c: Ctx, x: number, y: number) {
  oval(c, x + 4, y + 4, 10, 5, '#5e794738');
  box(c, x - 2, y - 42, 4, 43, 2, '#57715c');
  box(c, x - 7, y - 50, 14, 16, 4, '#4c695a'); box(c, x - 4, y - 47, 8, 10, 2, '#f7e8b0');
}
function garden(c: Ctx, p: Place) {
  const x = p.x - p.width / 2, y = p.y;
  box(c, x - 19, y - 22, p.width + 38, p.height + 50, 18, '#91bc6d');
  box(c, x - 13, y - 16, p.width + 26, p.height + 38, 14, '#b2d27c');
  fence(c, x - 15, y + p.height + 10, p.width / 2 - 6);
  fence(c, p.x + 27, y + p.height + 10, p.width / 2 - 15);
  bush(c, x - 6, y + p.height - 4); bush(c, x + p.width + 4, y + p.height - 5);
  flowers(c, x + 25, y + p.height + 18, '#f6d9d1');
}
function window(c: Ctx, x: number, y: number, w = 21, h = 25) {
  box(c, x - 3, y - 3, w + 6, h + 6, 4, '#f9efd6');
  box(c, x, y, w, h, 2, '#8dc5d0');
  box(c, x + w / 2 - 1.5, y, 3, h, 0, '#eaf1d9'); box(c, x, y + h / 2 - 1, w, 2, 0, '#eaf1d9');
  box(c, x - 5, y + h + 1, w + 10, 7, 3, '#d2b790');
}
function building(c: Ctx, p: Place) {
  const x = p.x - p.width / 2, y = p.y, w = p.width, h = p.height, shop = !['home', 'school'].includes(p.kind);
  if (p.kind === 'park' || p.kind === 'camp') return;
  if (p.kind === 'home') garden(c, p);
  box(c, x + 13, y + 20, w + 1, h, 12, '#5f834b32');
  box(c, x + 7, y + 45, w - 14, h - 32, 7, '#d8c5a1');
  box(c, x, y + 36, w, h - 42, 6, '#fcf0d2');
  box(c, x, y + h - 13, w, 10, 3, '#e6d0a4');
  // The tile grid, ridge, and soft eave shadow make one small reusable house sprite.
  box(c, x - 10, y + 12, w + 20, h * .52, 9, '#766b4e26');
  box(c, x - 10, y, w + 20, h * .52, 9, p.color);
  c.save(); c.beginPath(); c.roundRect(x - 10, y, w + 20, h * .52, 9); c.clip();
  c.globalAlpha = .15;
  for (let row = 0; row < 4; row++) {
    const ry = y + row * 23;
    line(c, [{ x: x - 10, y: ry + 21 }, { x: x + w + 10, y: ry + 21 }], '#814d39', 3);
    for (let col = 0; col < 7; col++) line(c, [{ x: x + col * 30 + (row % 2) * 15, y: ry }, { x: x + col * 30 + (row % 2) * 15, y: ry + 20 }], '#814d39', 2);
  }
  c.restore();
  box(c, x - 7, y + 3, w + 14, 6, 3, '#fae7c440');
  if (p.kind === 'home') {
    box(c, x + w - 38, y - 9, 19, 30, 4, '#f6e4c5'); box(c, x + w - 34, y - 6, 11, 8, 2, '#b37d60');
    window(c, x + 17, y + h - 60); window(c, x + w - 40, y + h - 60);
    box(c, p.x - 14, y + h - 52, 28, 44, 4, '#b68155');
    box(c, p.x - 10, y + h - 47, 20, 34, 3, '#c88e60'); oval(c, p.x + 7, y + h - 28, 2, 2, '#f4d69a');
    box(c, p.x - 23, y + h - 8, 46, 11, 3, '#e1c492');
  } else if (shop) {
    const sign = { cafe: 'CAFÉ', bakery: 'BAKERY', grocer: 'GROCER', arcade: 'ARCADE', library: 'LIBRARY' }[p.kind as 'cafe'];
    box(c, p.x - w * .35, y + 22, w * .7, 31, 6, '#fff1d1'); label(c, sign, p.x, y + 38, p.kind === 'library' ? 17 : 19, '#425965');
    window(c, x + 17, y + h - 74, 36, 49); window(c, x + w - 53, y + h - 74, 36, 49);
    box(c, p.x - 17, y + h - 68, 34, 59, 4, '#b98860'); box(c, p.x - 12, y + h - 63, 24, 35, 2, '#8ebbc0');
    c.save(); c.fillStyle = p.color; c.fillRect(x - 9, y + h * .52 - 4, w + 18, 26);
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? p.color : '#fff0d3'; c.fillRect(x - 9 + i * (w + 18) / 9, y + h * .52 - 4, (w + 18) / 9, 24); }
    c.restore();
    for (let i = 0; i < 9; i++) box(c, x - 9 + i * (w + 18) / 9, y + h * .52 + 16, (w + 18) / 9, 12, 5, i % 2 ? p.color : '#fff0d3');
    bush(c, x - 5, y + h + 2); bush(c, x + w + 7, y + h + 2);
  } else {
    window(c, x + 25, y + h - 65, 29, 34); window(c, x + w - 54, y + h - 65, 29, 34);
    box(c, p.x - 22, y + h - 63, 44, 53, 5, '#ae835b');
    c.fillStyle = '#fff0d3'; c.beginPath(); c.moveTo(p.x - 40, y + 49); c.lineTo(p.x, y + 13); c.lineTo(p.x + 40, y + 49); c.closePath(); c.fill();
    oval(c, p.x, y + 45, 13, 13, '#ca9d6b'); oval(c, p.x, y + 45, 10, 10, '#f7edcf');
    line(c, [{ x: p.x, y: y + 38 }, { x: p.x, y: y + 45 }, { x: p.x + 6, y: y + 48 }], '#7b775e', 2);
  }
}
function bridge(c: Ctx, y: number, side: 'left' | 'right') {
  const x = riverX(y, side);
  box(c, x - 107, y - 38, 221, 89, 10, '#577c6040');
  box(c, x - 112, y - 37, 224, 74, 6, '#b89162');
  for (let i = -105; i < 110; i += 16) box(c, x + i, y - 34, 13, 68, 2, '#c8a26e');
  for (const dy of [-38, 35]) {
    box(c, x - 119, y + dy, 238, 7, 3, '#9b744f');
    for (let i = -114; i <= 114; i += 38) box(c, x + i, y + dy - 9, 9, 25, 3, '#a47c50');
  }
}
function pond(c: Ctx) {
  const path = new Path2D('M 460 1500 C 425 1360 530 1325 608 1360 C 695 1300 790 1385 761 1470 C 831 1560 730 1650 640 1600 C 544 1650 440 1600 460 1500 Z');
  c.strokeStyle = '#84b368'; c.lineWidth = 29; c.stroke(path);
  c.strokeStyle = '#e5d8a3'; c.lineWidth = 18; c.stroke(path);
  c.fillStyle = '#83cbd1'; c.fill(path); c.strokeStyle = '#afe0d4'; c.lineWidth = 8; c.stroke(path);
  for (const [x, y] of [[480, 1380], [749, 1535], [555, 1610]]) {
    for (let i = 0; i < 5; i++) line(c, [{ x: x + i * 5, y }, { x: x - 5 + i * 7, y: y - 24 - i % 2 * 10 }], '#759c58', 4);
  }
  for (const [x, y] of [[530, 1450], [690, 1545], [720, 1430]]) {
    oval(c, x, y, 13, 6, '#69a86b'); oval(c, x + 2, y - 2, 3, 3, '#f5cad0');
  }
}
function fountain(c: Ctx) {
  oval(c, 1500, 1280, 145, 145, '#e4c999'); oval(c, 1500, 1280, 136, 136, '#f3dcaf');
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    oval(c, 1500 + Math.cos(a) * 110, 1280 + Math.sin(a) * 110, 3, 3, '#d5bd92');
  }
  oval(c, 1505, 1291, 66, 60, '#9c9d7440'); oval(c, 1500, 1280, 65, 62, '#e5d8bb');
  oval(c, 1500, 1277, 53, 49, '#7fc3d3'); oval(c, 1500, 1272, 44, 38, '#a0d8db');
  box(c, 1493, 1232, 14, 44, 6, '#e9dfbe'); oval(c, 1500, 1232, 20, 9, '#f5e9cc');
  oval(c, 1500, 1228, 13, 6, '#93cdd4');
  for (const [x, y] of [[1358, 1168], [1642, 1168], [1358, 1392], [1642, 1392]]) { box(c, x - 14, y - 10, 28, 28, 5, '#c8a377'); bush(c, x, y - 7); flowers(c, x, y - 15, '#efb3b9'); }
}
function table(c: Ctx, x: number, y: number) {
  for (const dx of [-28, 28]) { box(c, x + dx - 9, y - 8, 18, 20, 6, '#ba9463'); box(c, x + dx - 10, y - 15, 20, 6, 2, '#ad8458'); }
  oval(c, x + 4, y + 10, 25, 18, '#5d765130'); oval(c, x, y, 25, 20, '#d7ac70'); oval(c, x, y - 3, 24, 19, '#e0bb83');
  oval(c, x + 7, y - 5, 4, 4, '#f8edcf'); oval(c, x + 7, y - 5, 2.4, 2.4, '#9c7752');
}
function tent(c: Ctx, x: number, y: number, color: string) {
  oval(c, x + 7, y + 24, 44, 17, '#5d804838');
  c.fillStyle = color; c.beginPath(); c.moveTo(x - 43, y + 23); c.lineTo(x - 2, y - 38); c.lineTo(x + 43, y + 23); c.closePath(); c.fill();
  c.fillStyle = '#806143'; c.beginPath(); c.moveTo(x - 19, y + 23); c.lineTo(x, y - 17); c.lineTo(x + 19, y + 23); c.closePath(); c.fill();
  line(c, [{ x: x - 2, y: y - 38 }, { x: x + 43, y: y + 23 }], '#f8dda3', 3);
}

export function createMap(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = WORLD.width; canvas.height = WORLD.height;
  const c = canvas.getContext('2d')!, rng = random(2026);
  c.fillStyle = '#9fc96e'; c.fillRect(0, 0, WORLD.width, WORLD.height);
  // Seeded ground details make the map stable across resets and zoom levels.
  for (let i = 0; i < 4800; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height;
    oval(c, x, y, 2 + rng() * 3, 2 + rng() * 4, i % 3 ? '#94bd6e55' : '#c6db8c70');
    if (i % 30 === 0) { line(c, [{ x, y }, { x: x - 2, y: y - 5 }], '#84b566', 2); line(c, [{ x: x + 4, y }, { x: x + 6, y: y - 6 }], '#84b566', 2); }
  }
  river(c, 'left'); river(c, 'right');
  for (const road of roads) { line(c, road.points, '#d9c697', road.width + 8); line(c, road.points, '#f3dcac', road.width); }
  for (const p of places.filter(p => p.kind !== 'park' && p.kind !== 'camp')) {
    line(c, [{ x: p.x, y: p.y + p.height }, { x: p.x, y: p.roadY }], '#e4ce9b', 35);
    line(c, [{ x: p.x, y: p.y + p.height }, { x: p.x, y: p.roadY }], '#f3dcac', 28);
  }
  for (let i = 0; i < 950; i++) {
    const road = roads[i % roads.length], segment = 1 + i % (road.points.length - 1), a = road.points[segment - 1], b = road.points[segment], t = rng();
    const length = Math.hypot(b.x - a.x, b.y - a.y), offset = (rng() - .5) * road.width * .8;
    oval(c, a.x + (b.x - a.x) * t - (b.y - a.y) / length * offset, a.y + (b.y - a.y) * t + (b.x - a.x) / length * offset, 1.4, 1, '#d1b78470');
  }
  pond(c); fountain(c);
  for (const y of [850, 1760]) bridge(c, y, 'right');
  // Small west-bank footpaths connect both river bridges to the town.
  for (const y of [440, 2140]) {
    line(c, [{ x: 0, y }, { x: 440, y }], '#e3cc9c', 54); line(c, [{ x: 0, y }, { x: 440, y }], '#f3dcac', 47); bridge(c, y, 'left');
  }
  // Community garden.
  box(c, 690, 1950, 225, 130, 12, '#95b66a');
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
    const x = 709 + col * 29, y = 1972 + row * 28;
    box(c, x - 10, y - 7, 22, 16, 4, '#b5905e'); oval(c, x - 2, y - 4, 7, 5, '#5d9a54'); oval(c, x + 4, y - 6, 6, 5, '#73ab59');
  }
  fence(c, 681, 2082, 243); fence(c, 681, 1930, 243);
  // School playground.
  box(c, 2335, 540, 95, 195, 20, '#d6ce91');
  for (const sx of [2360, 2405]) {
    line(c, [{ x: sx - 15, y: 622 }, { x: sx, y: 565 }, { x: sx + 17, y: 622 }], '#b68a5f', 7);
    line(c, [{ x: sx - 3, y: 569 }, { x: sx - 3, y: 606 }], '#8b9578', 2); box(c, sx - 12, 603, 25, 7, 2, '#e7b56b');
  }
  box(c, 2375, 650, 35, 19, 5, '#d2a864'); box(c, 2378, 668, 29, 48, 5, '#78b9c3');
  line(c, [{ x: 2375, y: 650 }, { x: 2375, y: 681 }, { x: 2365, y: 706 }], '#e4b869', 5);
  // Camp clearing and a few simple reusable tents.
  oval(c, 2950, 1185, 151, 295, '#bfd18d');
  for (const [x, y, color] of [[2875, 1050, '#e5b54e'], [3020, 1110, '#df936b'], [2920, 1390, '#7db4b6']] as const) tent(c, x, y, color);
  for (let i = 0; i < 8; i++) oval(c, 2950 + Math.cos(i * Math.PI / 4) * 35, 1230 + Math.sin(i * Math.PI / 4) * 26, 9, 7, '#a49d81');
  line(c, [{ x: 2935, y: 1220 }, { x: 2967, y: 1240 }], '#9e744b', 9); line(c, [{ x: 2967, y: 1220 }, { x: 2935, y: 1240 }], '#9e744b', 9);
  for (const [x, y] of [[2890, 1235], [3000, 1270], [2950, 1175]]) oval(c, x, y, 17, 12, '#b99362');
  // Draw trees and houses in ground order so their silhouettes overlap naturally.
  const objects: { y: number; draw: () => void }[] = places.map(p => ({ y: p.y + p.height, draw: () => building(c, p) }));
  for (let y = 85; y < WORLD.height - 50; y += 115) for (let x = 55; x < WORLD.width - 30; x += 115) {
    const p = { x: x + (rng() - .5) * 65, y: y + (rng() - .5) * 65 };
    if (rng() < .2 || Math.abs(p.x - riverX(p.y, 'left')) < 125 || Math.abs(p.x - riverX(p.y, 'right')) < 125) continue;
    if (places.some(b => p.x > b.x - b.width / 2 - 55 && p.x < b.x + b.width / 2 + 55 && p.y > b.y - 65 && p.y < b.y + b.height + 60)) continue;
    if (roads.some(r => r.points.some((b, i) => i && distanceToSegment(p, r.points[i - 1], b) < r.width / 2 + 37))) continue;
    if (Math.hypot((p.x - 620) / 1.15, p.y - 1490) < 220 || Math.hypot(p.x - 1500, p.y - 1280) < 205 || (p.x > 675 && p.x < 940 && p.y > 1930 && p.y < 2120) || (p.x > 2360 && p.x < 2590 && p.y > 510 && p.y < 750)) continue;
    const size = .78 + rng() * .6, seed = Math.floor(rng() * 10000);
    objects.push({ y: p.y, draw: () => tree(c, p.x, p.y, size, seed) });
  }
  // Deliberate shade trees around the pond, where the procedural pass leaves open space.
  for (const [x, y] of [[390, 1380], [435, 1710], [780, 1690], [815, 1370], [600, 1250], [820, 1865]]) objects.push({ y, draw: () => tree(c, x, y, 1.05, x) });
  objects.sort((a, b) => a.y - b.y).forEach(o => o.draw());
  for (const [x, y, vertical] of [[390, 1500, true], [550, 1700, false], [830, 1510, true], [750, 1230, false], [1330, 1310, true], [1680, 1360, true], [2310, 1375, false], [2100, 2030, false]] as const) bench(c, x, y, vertical);
  for (const [x, y] of [[1630, 1225], [1730, 1230], [1790, 1195]]) table(c, x, y);
  for (const road of roads.slice(0, 5)) {
    const [a, b] = road.points;
    for (let x = a.x + 110; x < b.x; x += 390) lamp(c, x, a.y - road.width / 2 - 12);
  }
  for (let i = 0; i < 155; i++) {
    const p = { x: 300 + rng() * 2300, y: 140 + rng() * 2110 };
    if (places.some(b => p.x > b.x - b.width / 2 - 20 && p.x < b.x + b.width / 2 + 20 && p.y > b.y - 10 && p.y < b.y + b.height + 25)) continue;
    if (roads.some(r => r.points.some((b, j) => j && distanceToSegment(p, r.points[j - 1], b) < r.width / 2 + 8))) continue;
    if (Math.hypot(p.x - 620, p.y - 1490) < 200) continue;
    flowers(c, p.x, p.y, i % 4 ? '#fff0cb' : '#eeb5be');
  }
  label(c, 'MAPLE LANE', 1290, 380, 15, '#6f8a55');
  label(c, 'WILLOW PARK', 620, 1800, 17, '#6b8551');
  label(c, 'RIVERSIDE CAMP', 2950, 1510, 15, '#74895a');
  label(c, 'COMMUNITY GARDEN', 800, 1908, 13, '#74895a');
  label(c, 'LITTLE OAK SCHOOL', 2230, 790, 14, '#74895a');
  return canvas;
}

export function drawResident(c: Ctx, p: Resident, time: number, selected: boolean, moving: boolean) {
  const bounce = moving ? Math.sin(time * 8 + p.step) * 1.5 : 0;
  oval(c, p.x + 3, p.y + 5, 13, 6, '#4e745740');
  if (selected) { c.strokeStyle = '#fff8df'; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y + 1, 20, 13, 0, 0, Math.PI * 2); c.stroke(); }
  c.save(); c.translate(p.x, p.y + bounce);
  box(c, -8, -6, 6, 13, 3, '#566267'); box(c, 3, -6, 6, 13, 3, '#566267');
  oval(c, 0, -7, 12, 12, p.color); oval(c, 0, -18, 10, 11, p.skin);
  oval(c, -1, -23, 10, 7, p.hair);
  if (Number(p.id.split('-')[1]) % 3 === 0) oval(c, 0, -32, 6, 6, p.hair);
  c.restore();
}

export function drawWorld(c: Ctx, map: HTMLCanvasElement, camera: Camera, viewport: Viewport, residents: Resident[], time: number, selected: string | null, hover: string | null, closed: Set<string>, weather: TownWeather, moving: boolean) {
  c.fillStyle = '#9fc96e'; c.fillRect(0, 0, viewport.width, viewport.height);
  c.save(); c.translate(viewport.width / 2, viewport.height / 2); c.scale(camera.zoom, camera.zoom); c.translate(-camera.x, -camera.y);
  c.drawImage(map, 0, 0);
  // Ripples and ducks provide small, inexpensive signs of life.
  c.lineWidth = 2; c.strokeStyle = '#d0eee480';
  for (const side of ['left', 'right'] as const) for (let i = 0; i < 25; i++) {
    const y = (i * 103 + time * 4) % WORLD.height, x = riverX(y, side) + Math.sin(i * 5.2) * 35;
    line(c, [{ x: x - 9, y }, { x, y: y + 2 }, { x: x + 11, y }], '#c1e9de80', 2);
  }
  for (let i = 0; i < 3; i++) {
    const x = 540 + i * 61 + Math.sin(time * .2 + i) * 16, y = 1445 + i % 2 * 60;
    oval(c, x, y + 4, 13, 5, '#5caebc40'); oval(c, x, y, 9, 6, '#fcf2d2'); oval(c, x + 5, y - 4, 5, 5, '#fcf2d2'); oval(c, x + 10, y - 3, 3, 2, '#e6aa52');
  }
  // Highlight actual map objects, rather than a flattened background image.
  for (const p of places) {
    if (p.id === selected || p.id === hover) {
      c.strokeStyle = p.id === selected ? '#fff7dd' : '#fff7ddaa'; c.lineWidth = 3 / camera.zoom;
      c.setLineDash(p.id === selected ? [] : [7 / camera.zoom, 5 / camera.zoom]);
      c.beginPath(); c.roundRect(p.x - p.width / 2 - 13, p.y - 13, p.width + 26, p.height + 26, 16); c.stroke(); c.setLineDash([]);
    }
    if (closed.has(p.id)) {
      box(c, p.x - p.width / 2, p.y, p.width, p.height, 9, '#586a6c44');
      box(c, p.x - 44, p.y + p.height - 24, 88, 29, 7, '#d37e70'); label(c, 'CLOSED', p.x, p.y + p.height - 9, 13, '#fff0d3');
    }
  }
  const followed = residents.find(p => p.id === selected);
  if (followed?.plan && !followed.plan.arrived) {
    c.setLineDash([6 / camera.zoom, 5 / camera.zoom]);
    line(c, [followed, ...followed.plan.waypoints], '#fff3d9', 3 / camera.zoom);
    c.setLineDash([]);
  }
  for (const p of [...residents].sort((a, b) => a.y - b.y)) drawResident(c, p, time, p.id === selected, moving && !p.waiting && !p.plan?.arrived);
  // Draw names above every head at a readable size regardless of map zoom.
  for (const p of residents) {
    c.save(); c.translate(p.x, p.y - 40); c.scale(1 / camera.zoom, 1 / camera.zoom);
    c.font = '700 10px "Avenir Next", "Segoe UI", sans-serif';
    const width = c.measureText(p.name).width + 12, active = p.id === selected;
    box(c, -width / 2, -19, width, 16, 6, active ? '#425b54' : '#fff3d9eb');
    label(c, p.name, 0, -10, 10, active ? '#fff3d9' : '#425b54');
    c.restore();
  }
  c.restore();
  if (weather !== 'clear') {
    const storm = weather === 'storm';
    c.fillStyle = storm ? '#26394f66' : '#44658b24'; c.fillRect(0, 0, viewport.width, viewport.height);
    c.strokeStyle = '#e4f1ed90'; c.lineWidth = 1.2; c.beginPath();
    const drops = random(481), width = viewport.width + 80, height = viewport.height + 80;
    for (let i = 0; i < (storm ? 280 : 160); i++) {
      const x = ((drops() * width - time * (storm ? 210 : 85)) % width + width) % width, y = (drops() * height + time * (storm ? 650 : 470)) % height;
      c.moveTo(x, y); c.lineTo(x - (storm ? 12 : 5), y + (storm ? 23 : 15));
    }
    c.stroke();
  }
}

export function hitPlace(p: Point) {
  return [...places].reverse().find(b => p.x >= b.x - b.width / 2 && p.x <= b.x + b.width / 2 && p.y >= b.y && p.y <= b.y + b.height);
}

export function clampCamera(camera: Camera, viewport: Viewport) {
  const halfW = viewport.width / camera.zoom / 2, halfH = viewport.height / camera.zoom / 2;
  camera.x = halfW >= WORLD.width / 2 ? WORLD.width / 2 : Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
  camera.y = halfH >= WORLD.height / 2 ? WORLD.height / 2 : Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
  return camera;
}
