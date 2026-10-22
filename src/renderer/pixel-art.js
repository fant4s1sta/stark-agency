import { TILE, WIDTH, HEIGHT } from './world.js';

const palettes = {
  vision: { skin: '#e7e8dc', shade: '#b9c8bf', hair: '#d7e0ce', coat: '#f1eee0', dark: '#737d71', accent: '#e7b849', pants: '#68786d' },
  jarvis: { skin: '#e9b98c', shade: '#c88f70', hair: '#a6ac9d', coat: '#566984', dark: '#334558', accent: '#e3c5a2', pants: '#394c66' },
  friday: { skin: '#f5c799', shade: '#dba077', hair: '#a3482e', coat: '#61a68b', dark: '#346b65', accent: '#f4e1ac', pants: '#3d736b' },
  ultron: { skin: '#a7b8be', shade: '#768e9c', hair: '#8197a4', coat: '#899eab', dark: '#47586b', accent: '#f06e60', pants: '#586e7e' },
  edith: { skin: '#eac4a1', shade: '#c4967d', hair: '#42394b', coat: '#a66686', dark: '#674760', accent: '#b7ddcf', pants: '#634b63' },
  dume: { skin: '#929c9d', shade: '#515e63', hair: '#69767a', coat: '#667378', dark: '#303c43', accent: '#d7b34c', pants: '#39454b' },
  u: { skin: '#c2c9bf', shade: '#7e8b89', hair: '#9da9a2', coat: '#a4b0a9', dark: '#414e50', accent: '#d4b451', pants: '#56635f' }
};
const atlas = new Map();
const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function outline(ctx, x, y, w, h, color, line = '#464553') { rect(ctx, x, y, w, h, line); rect(ctx, x + 1, y + 1, w - 2, h - 2, color); }
// Integer steps keep diagonal metal links crisp at the native sprite resolution.
function pixelLink(c, a, b, width, color) {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    rect(c, a[0] + (b[0] - a[0]) * t - Math.floor(width / 2), a[1] + (b[1] - a[1]) * t - Math.floor(width / 2), width, width, color);
  }
}
function armJoint(c, x, y, size, cap, p) {
  const r = Math.floor(size / 2);
  rect(c, x - r + 1, y - r, size - 2, size, p.dark);
  rect(c, x - r, y - r + 1, size, size - 2, p.dark);
  rect(c, x - r + 1, y - r + 1, size - 2, size - 2, cap);
  rect(c, x - r + 2, y - r + 1, size - 4, 1, '#d2d4b3');
}
function mechanicalArm(c, id, side, back, action, frame, p) {
  const large = id === 'dume', rolling = action === 'walk';
  const active = ['repair', 'work', 'planning', 'talk', 'water'].includes(action);
  const lift = active ? frame % 2 : 0;
  // DUM-E has a heavy tracked chassis; U uses a smaller low wheeled plinth.
  const bx = large ? 3 : 6, bw = large ? 26 : 21;
  outline(c, bx, 32, bw, 5, p.pants, p.dark);
  rect(c, bx + 2, 32, bw - 4, 1, p.skin);
  for (let x = bx + 2; x < bx + bw - 2; x += 5) {
    outline(c, x, 34, 4, 4, p.dark, '#283238');
    rect(c, x + 1, 35 + (rolling ? frame % 2 : 0), 2, 1, p.shade);
  }
  outline(c, large ? 11 : 13, large ? 23 : 26, large ? 10 : 8, large ? 10 : 7, p.coat, p.dark);
  rect(c, large ? 12 : 14, large ? 24 : 27, 2, large ? 7 : 4, p.skin);
  rect(c, large ? 13 : 15, 31, large ? 10 : 8, 2, p.shade);
  // Folded elbow and long forearm are distinct silhouettes, with no head or camera.
  const shoulder = large ? [16, 24] : [18, 27];
  const elbow = large ? (side ? [10, 15] : [11, 16]) : (side ? [24, 18] : [22, 19]);
  const wrist = large ? (side ? [24, 5 - lift] : [22, 6 - lift]) : (side ? [11, 14 - lift] : [12, 14 - lift]);
  // Rear counterweight and exposed cable loop, drawn behind the structural links.
  outline(c, large ? 5 : 22, large ? 20 : 23, large ? 8 : 6, 6, p.shade, p.dark);
  pixelLink(c, [shoulder[0] + 3, shoulder[1] - 1], [elbow[0] + 4, elbow[1] + 1], 1, '#27353b');
  pixelLink(c, [elbow[0] + 4, elbow[1] + 1], [wrist[0] + 2, wrist[1] + 4], 1, '#27353b');
  pixelLink(c, [wrist[0] + 2, wrist[1] + 4], wrist, 1, '#27353b');
  pixelLink(c, shoulder, elbow, large ? 7 : 5, p.dark);
  pixelLink(c, [shoulder[0] - 1, shoulder[1] - 1], [elbow[0] - 1, elbow[1]], large ? 4 : 3, p.coat);
  // A bright narrow hydraulic piston runs alongside the upper arm.
  pixelLink(c, [shoulder[0] + 4, shoulder[1] - 1], [elbow[0] + 3, elbow[1] + 3], 2, p.skin);
  pixelLink(c, elbow, wrist, large ? 4 : 3, p.dark);
  pixelLink(c, [elbow[0], elbow[1] - 1], [wrist[0], wrist[1] - 1], 1, p.skin);
  armJoint(c, ...elbow, large ? 6 : 5, p.shade, p);
  armJoint(c, ...shoulder, large ? 9 : 7, back ? p.shade : p.accent, p);
  if (back) rect(c, shoulder[0] - 1, shoulder[1] - 1, 2, 2, p.dark);
  armJoint(c, ...wrist, 5, p.coat, p);
  // Split metal pincers open and close instead of a humanoid hand animation.
  const spread = active && frame % 2 ? 3 : 2, wx = wrist[0], wy = wrist[1];
  if (large) {
    pixelLink(c, [wx - 1, wy - 2], [wx - spread, wy - 4], 1, p.skin);
    pixelLink(c, [wx + 1, wy - 2], [wx + spread, wy - 4], 1, p.skin);
    rect(c, wx - spread, wy - 4, 2, 1, p.skin); rect(c, wx + spread - 1, wy - 4, 2, 1, p.skin);
  } else {
    pixelLink(c, [wx - 2, wy - 1], [wx - 5, wy - spread], 1, p.skin);
    pixelLink(c, [wx - 2, wy + 1], [wx - 5, wy + spread], 1, p.skin);
    rect(c, wx - 5, wy - spread, 1, 2, p.skin); rect(c, wx - 5, wy + spread - 1, 1, 2, p.skin);
  }
  rect(c, bx + bw - 5, 33, 2, 1, large ? '#d7b34c' : '#a4c4ab');
}
export function sprite(id, direction = 'down', action = 'idle', frame = 0) {
  const cacheKey = [id, direction, action, frame].join(':');
  if (atlas.has(cacheKey)) return atlas.get(cacheKey);
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 40;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  const p = palettes[id] || palettes.vision, side = direction === 'left' || direction === 'right', back = direction === 'up';
  const walk = action === 'walk', stride = walk ? [0, 2, 0, -2][frame % 4] : 0;
  const sit = ['work', 'rest', 'read'].includes(action), bob = walk && frame % 2 ? -1 : 0;
  c.save(); if (direction === 'left') { c.translate(32, 0); c.scale(-1, 1); }
  c.translate(0, ['dume', 'u'].includes(id) ? 0 : bob + (sit ? 2 : 0));
  if (id === 'dume' || id === 'u') {
    mechanicalArm(c, id, side, back, action, frame, p);
  } else {
    // Sixteen hand-authored directional walk poses: feet and arms alternate,
    // side silhouettes and back-of-head art change with heading.
    const headX = side ? 10 : 8, headW = side ? 15 : 17;
    const legY = sit ? 30 : 29;
    if (!sit) {
      outline(c, side ? 12 : 10, legY + Math.max(0, stride), 5, 7 - Math.abs(stride), p.pants);
      outline(c, side ? 18 : 18, legY + Math.max(0, -stride), 5, 7 - Math.abs(stride), p.pants);
      rect(c, side ? 11 : 9, 35 + Math.max(0, stride) / 2, 6, 2, '#3f414d');
      rect(c, 18, 35 + Math.max(0, -stride) / 2, 6, 2, '#3f414d');
    } else { rect(c, 10, 30, 13, 4, p.pants); rect(c, 9, 33, 5, 2, '#3f414d'); rect(c, 20, 33, 5, 2, '#3f414d'); }
    outline(c, side ? 11 : 9, 21, side ? 13 : 15, sit ? 10 : 11, p.coat);
    rect(c, side ? 12 : 10, 22, 2, 8, p.dark); rect(c, 21, 23, 2, 7, p.dark);
    if (!back) { rect(c, 16, 22, 2, 8, p.accent); rect(c, 15, 22, 4, 2, '#f1ead3'); }
    const armY = 22 + stride / 2;
    if (!side) { outline(c, 6, armY, 4, 8, p.coat); rect(c, 7, armY + 6, 2, 3, p.skin); }
    outline(c, side ? 15 : 24, 22 - stride / 2, 4, 8, p.coat); rect(c, side ? 16 : 25, 28 - stride / 2, 2, 3, p.skin);
    outline(c, headX, 6, headW, 16, p.skin); rect(c, headX + 1, 8, 2, 10, p.shade); rect(c, headX + 3, 20, headW - 5, 2, p.shade);
    if (id === 'vision') {
      rect(c, headX + 2, 5, headW - 4, 2, '#c6d9c4'); rect(c, headX + 2, 9, 1, 8, '#91b1a5');
      if (!back) { rect(c, side ? 22 : 15, 7, 3, 4, '#e8c261'); rect(c, side ? 23 : 16, 8, 1, 2, '#fff0ad'); }
    } else if (id === 'ultron') {
      rect(c, headX + 2, 5, headW - 4, 3, p.hair); rect(c, headX + 5, 7, 2, 6, '#d0d7cf'); rect(c, headX + 1, 17, headW - 2, 3, p.dark);
      if (!back) { rect(c, side ? 21 : 11, 13, side ? 3 : 4, 2, p.accent); if (!side) rect(c, 19, 13, 4, 2, p.accent); rect(c, side ? 21 : 15, 18, 3, 1, '#b4c9c7'); }
      rect(c, 16, 25, 3, 3, '#f0826c');
    } else {
      rect(c, headX, 5, headW, 5, p.hair); rect(c, headX + 2, 3, headW - 4, 3, p.hair);
      rect(c, headX, 9, 3, id === 'edith' ? 13 : 6, p.hair); rect(c, headX + headW - 3, 9, 3, id === 'edith' ? 13 : 4, p.hair);
      rect(c, headX + 3, 5, headW - 7, 2, id === 'friday' ? '#cd6a3e' : id === 'jarvis' ? '#d0d0b6' : '#665165');
      if (id === 'friday') { outline(c, side ? 5 : 21, 4, 6, 7, p.hair); rect(c, 9, 9, 6, 2, p.hair); }
      if (back) { rect(c, headX + 1, 8, headW - 2, id === 'jarvis' ? 10 : 13, p.hair); rect(c, headX + 3, 8, 2, 8, id === 'friday' ? '#bd5b36' : '#77767d'); }
    }
    if (!back && id !== 'ultron') {
      if (side) { rect(c, 22, 13, 2, 3, '#3b4149'); rect(c, 24, 16, 2, 2, p.skin); rect(c, 22, 19, 2, 1, p.shade); }
      else { rect(c, 12, 13, 2, 3, '#3b4149'); rect(c, 20, 13, 2, 3, '#3b4149'); rect(c, 12, 13, 1, 1, '#fff8dc'); rect(c, 20, 13, 1, 1, '#fff8dc'); rect(c, 16, 19, 3, 1, p.shade); }
      if (id === 'edith') {
        // Draw pupils after the lenses so the lens fill cannot erase either eye.
        const frame = '#555166', eye = '#303744', lens = '#f3d6b5';
        if (side) {
          rect(c, 16, 13, 5, 1, frame);
          outline(c, 20, 12, 6, 6, lens, frame);
          rect(c, 23, 14, 2, 3, eye);
          rect(c, 21, 13, 1, 1, '#fff4d9');
        } else {
          outline(c, 10, 12, 6, 6, lens, frame);
          outline(c, 18, 12, 6, 6, lens, frame);
          rect(c, 16, 14, 2, 1, frame);
          for (const x of [12, 20]) {
            rect(c, x, 14, 2, 3, eye);
            rect(c, x - 1, 13, 1, 1, '#fff4d9');
          }
        }
      }
    }
    if (action === 'coffee') { const lift = frame % 2 ? 6 : 0; outline(c, 22, 26 - lift, 6, 6, '#eee6c4'); rect(c, 23, 26 - lift, 4, 1, '#825647'); rect(c, 28, 28 - lift, 2, 3, '#eee6c4'); }
    if (action === 'read') { outline(c, 11, 27, 14, 7, '#d3b78e'); rect(c, 12, 27, 5, 5, '#f5e9c8'); rect(c, 19, 27, 5, 5, '#e7d6ae'); rect(c, 17 + frame % 2, 28, 1, 5, '#a08065'); }
    if (action === 'planning' || action === 'talk') { const handY = frame % 2 ? 20 : 23; rect(c, 25, handY, 3, 4, p.skin); if (action === 'planning') rect(c, 27, handY - 4, 1, 6, '#627e84'); }
    if (action === 'water') { outline(c, 23, 27, 7, 5, '#6a9fa7'); rect(c, 29, 25, 3, 2, '#98c3bf'); if (frame % 2) rect(c, 30, 30, 1, 3, '#aadad0'); }
    if (action === 'work') { rect(c, 9 + frame % 2, 26, 3, 3, p.skin); rect(c, 22 - frame % 2, 26, 3, 3, p.skin); }
  }
  c.restore(); atlas.set(cacheKey, canvas); return canvas;
}
export function drawCharacter(ctx, person, time) {
  const frame = person.action === 'walk' ? Math.floor(person.walkClock * 9) % 4 : Math.floor(time * 2) % 2;
  const image = sprite(person.id, person.facing, person.action, frame);
  rect(ctx, person.x - 13, person.y - 3, 26, 5, '#373c3a25'); rect(ctx, person.x - 9, person.y + 2, 18, 2, '#373c3a18');
  ctx.drawImage(image, Math.round(person.x - 24), Math.round(person.y - 57), 48, 60);
}
function grain(c, x, y, w, h, seed = 0) {
  for (let i = 0; i < 8; i++) rect(c, x + (i * 23 + seed * 7) % Math.max(1, w - 12), y + (i * 13 + seed) % Math.max(1, h - 2), 4 + i % 9, 1, '#805d4926');
}
function label(c, text, x, y, color = '#7d7965') { c.fillStyle = color; c.font = '8px monospace'; c.textAlign = 'center'; c.fillText(text, Math.round(x), Math.round(y)); }
export function background() {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  rect(c, 0, 0, WIDTH, HEIGHT, '#d5d9c5');
  // Exterior shadow and thick cutaway walls frame the room.
  rect(c, 27, 72, WIDTH - 40, HEIGHT - 84, '#8c977e'); rect(c, 24, 16, WIDTH - 48, HEIGHT - 40, '#665a54');
  rect(c, 32, 24, WIDTH - 64, 75, '#dfd1af');
  for (let x = 32; x < WIDTH - 32; x += 16) rect(c, x, 26, 1, 65, '#b6ae8d40');
  rect(c, 32, 81, WIDTH - 64, 17, '#8c7761'); rect(c, 32, 81, WIDTH - 64, 3, '#b29b76');
  for (let y = 3; y < 17; y++) for (let x = 1; x < 25; x++) {
    const px = x * TILE, py = y * TILE;
    rect(c, px, py, 32, 32, ['#c7a67f', '#caaa82', '#c3a078', '#d0ae85'][(x * 3 + y * 7) % 4]);
    rect(c, px, py + 31, 32, 1, '#aa8a69'); rect(c, px, py, 32, 1, '#ddbf94');
    const cut = y % 2 ? 14 : 0; rect(c, px + cut, py + 1, 1, 30, '#b39370');
    grain(c, px + 2, py + 5, 27, 23, x + y);
  }
  // Four individually drawn windows with sky, distant rooftops and crossbars.
  for (const x of [76, 260, 490, 680]) {
    outline(c, x - 4, 27, 106, 53, '#9d805f', '#6b6355'); rect(c, x, 30, 98, 43, '#9bbec4'); rect(c, x, 30, 98, 16, '#aacbd1');
    for (let i = 0; i < 7; i++) { const h = 8 + (i * 13) % 22; rect(c, x + i * 14, 73 - h, 12, h, i % 2 ? '#87a8ad' : '#799ca6'); rect(c, x + i * 14 + 3, 75 - h, 2, 3, '#c8d6b6'); }
    rect(c, x + 6, 34, 20, 4, '#e7e9d4'); rect(c, x + 10, 31, 12, 3, '#e7e9d4');
    rect(c, x + 47, 30, 4, 43, '#f0dfbb'); rect(c, x, 51, 98, 3, '#f0dfbb'); rect(c, x - 5, 75, 108, 5, '#efdebd');
    rect(c, x - 8, 29, 5, 46, '#a0a98b'); rect(c, x + 102, 29, 5, 46, '#a0a98b');
  }
  // Rugs are ground layers: actors and furniture remain correctly above them.
  rug(c, 1.6 * TILE, 10.5 * TILE, 5.2 * TILE, 4.4 * TILE, '#779b92', '#b2bfa0');
  rug(c, 13.4 * TILE, 10 * TILE, 6.7 * TILE, 4.5 * TILE, '#8a8f9b', '#c2bea3');
  rect(c, 32, 96, 4, HEIGHT - 128, '#8a7661'); rect(c, WIDTH - 36, 96, 4, HEIGHT - 128, '#8a7661');
  rect(c, 24, HEIGHT - 32, WIDTH - 48, 8, '#766853'); rect(c, 24, HEIGHT - 32, WIDTH - 48, 3, '#ead3a7');
  rect(c, WIDTH / 2 - 38, HEIGHT - 32, 76, 8, '#c6aa83');
  for (const [id, s] of Object.entries({ ultron: [3, 7], friday: [8, 7], edith: [16, 7], jarvis: [9, 13] })) drawChair(c, s[0] * TILE + 16, s[1] * TILE + 16);
  // Small floor details make every zone feel inhabited.
  label(c, 'THE WORKSHOP', 23.3 * TILE, 5.35 * TILE, '#8d765b');
  label(c, 'IDEAS & COFFEE', 15.7 * TILE, 15.5 * TILE, '#9a856a');
  return canvas;
}
function rug(c, x, y, w, h, color, trim) {
  rect(c, x, y, w, h, '#7c6a5622'); rect(c, x + 3, y + 2, w - 6, h - 4, color); rect(c, x + 7, y + 6, w - 14, h - 12, trim); rect(c, x + 10, y + 9, w - 20, h - 18, color);
  for (let py = y + 17; py < y + h - 12; py += 18) for (let px = x + 18; px < x + w - 12; px += 18) { rect(c, px, py, 2, 2, trim); rect(c, px - 2, py + 2, 6, 2, trim); rect(c, px, py + 4, 2, 2, trim); }
  for (let px = x + 5; px < x + w - 4; px += 5) { rect(c, px, y - 2, 2, 4, trim); rect(c, px, y + h - 1, 2, 4, trim); }
}
function drawChair(c, x, y) {
  rect(c, x - 10, y - 7, 23, 16, '#4d5f64'); rect(c, x - 8, y - 7, 19, 10, '#7a9290'); rect(c, x - 10, y + 2, 23, 5, '#526a6d');
  rect(c, x - 12, y + 9, 27, 3, '#586468'); rect(c, x, y + 7, 3, 7, '#586468'); rect(c, x - 12, y + 12, 4, 3, '#485357'); rect(c, x + 11, y + 12, 4, 3, '#485357');
}
function pot(c, x, y, big = false) {
  const s = big ? 1.3 : 1; c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s, s);
  outline(c, -9, -11, 18, 13, '#b98563', '#79614e'); rect(c, -7, -9, 14, 3, '#d1aa7a'); rect(c, -6, 1, 12, 3, '#936c54');
  rect(c, -1, -29, 3, 20, '#628062');
  for (const [px, py, w, h, color] of [[-13, -26, 12, 6, '#5b8967'], [1, -32, 12, 7, '#698f69'], [-9, -36, 10, 7, '#85aa74'], [2, -21, 13, 6, '#456f59'], [-15, -18, 14, 6, '#729767'], [-5, -29, 11, 8, '#739d6d'], [-3, -41, 7, 8, '#8daf78']]) { rect(c, px, py, w, h, color); rect(c, px + 2, py - 1, w - 4, 2, '#a2b985'); }
  c.restore();
}
function mug(c, x, y, color = '#eee4bf') { outline(c, x, y, 9, 10, color, '#8a7158'); rect(c, x + 9, y + 2, 3, 5, color); rect(c, x + 2, y + 1, 5, 2, '#785644'); }
function monitor(c, x, y, accent, time, active) {
  rect(c, x + 15, y + 30, 5, 10, '#566670'); rect(c, x + 8, y + 39, 20, 3, '#55616a');
  outline(c, x, y, 36, 30, '#455a66', '#4e575c'); rect(c, x + 3, y + 3, 30, 22, '#294854'); rect(c, x + 4, y + 4, 28, 3, '#3b6471');
  for (let i = 0; i < 5; i++) { rect(c, x + 6, y + 9 + i * 3, 4 + (i * 9) % 21, 1, i % 2 ? '#91beae' : accent); }
  if (active) rect(c, x + 21 + Math.floor(time * 2) % 3 * 3, y + 21, 3, 2, '#ecdb99');
  rect(c, x + 30, y + 27, 2, 1, '#a9cc9d');
}
export function drawObject(c, o, time = 0, occupied = false, hover = false) {
  const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
  c.save(); c.imageSmoothingEnabled = false;
  rect(c, x + 5, y + h - 4, w, 9, '#655c4c25');
  if (hover) { c.strokeStyle = '#f5e2a2'; c.lineWidth = 2; c.strokeRect(x - 2, y - 22, w + 4, h + 23); }
  if (o.type === 'desk' || o.type === 'tools' || o.type === 'coffee') {
    rect(c, x + 5, y + h - 10, 6, 12, '#80654f'); rect(c, x + w - 11, y + h - 10, 6, 12, '#80654f');
    outline(c, x, y - 8, w, h + 1, '#b08b63', '#7d6854'); rect(c, x + 2, y - 8, w - 4, h - 8, '#e0bb89'); rect(c, x + 2, y - 7, w - 4, 2, '#f4d4a2');
    grain(c, x + 5, y - 3, w - 10, h - 13, o.x);
    if (o.type === 'desk') {
      if (!o.paper) { monitor(c, x + 25, y - 27, o.color, time, occupied); outline(c, x + 27, y + 15, 35, 8, '#b7b9a1', '#7b8277'); for (let i = 0; i < 6; i++) rect(c, x + 30 + i * 5, y + 17, 3, 2, '#ece6c8'); rect(c, x + 69, y + 16, 6, 7, '#81918d'); }
      else { outline(c, x + 27, y - 6, 41, 25, '#f3e7c5', '#a68b65'); rect(c, x + 47, y - 4, 2, 21, '#bbab87'); for (let i = 0; i < 4; i++) { rect(c, x + 31, y + i * 4, 12, 1, '#a5ac94'); rect(c, x + 52, y + i * 4, 12, 1, '#a5ac94'); } }
      mug(c, x + 9, y + 4); rect(c, x + 77, y - 3, 13, 17, o.color); rect(c, x + 79, y - 1, 9, 1, '#e9dfbd');
      rect(c, x + w - 21, y + 24, 15, 2, '#d5b482');
    } else if (o.type === 'coffee') {
      outline(c, x + 9, y - 29, 32, 41, '#6a7776', '#505856'); rect(c, x + 12, y - 26, 26, 6, '#abb3a4'); rect(c, x + 14, y - 14, 21, 22, '#424c4c'); rect(c, x + 19, y - 8, 11, 4, '#c1bba2'); mug(c, x + 20, y + 1);
      mug(c, x + 55, y + 4); mug(c, x + 70, y + 2, '#a8b6a0');
      if (Math.floor(time * 2) % 2) { rect(c, x + 24, y - 3, 1, 3, '#d8e2cc'); rect(c, x + 60, y - 3, 1, 3, '#f2e5c8'); }
    } else {
      outline(c, x + 7, y - 39, w - 14, 30, '#c9a779', '#8a7259');
      for (let i = 0; i < 7; i++) { rect(c, x + 14 + i * 10, y - 32, 3, 17, i % 2 ? '#6d7b7b' : '#8e6661'); rect(c, x + 12 + i * 10, y - 34, 7, 4, '#aab5a7'); }
      outline(c, x + 14, y + 1, 29, 16, '#768d81', '#5e7067'); rect(c, x + 20, y - 2, 16, 4, '#667267'); rect(c, x + 63, y + 1, 18, 13, '#c7ac6b');
    }
  } else if (o.type === 'board') {
    rect(c, x + 10, y - 7, 5, h + 5, '#707b70'); rect(c, x + w - 15, y - 7, 5, h + 5, '#707b70');
    outline(c, x, y - 39, w, 61, '#a48f6a', '#716c58'); rect(c, x + 4, y - 35, w - 8, 51, '#eee9d4'); rect(c, x + 6, y - 33, w - 12, 2, '#faf4dd');
    for (const [dx, dy] of [[16, 1], [51, -21], [88, 2]]) { outline(c, x + dx, y + dy, 24, 12, '#e8e6ca', '#8caba1'); rect(c, x + dx + 4, y + dy + 4, 15, 1, '#819891'); }
    rect(c, x + 62, y - 8, 1, 9, '#91a49a'); rect(c, x + 27, y - 1, 73, 1, '#91a49a'); rect(c, x + 26, y - 1, 1, 3, '#91a49a'); rect(c, x + 99, y - 1, 1, 3, '#91a49a');
    rect(c, x + 16, y - 25, 15, 15, '#e7ca78'); rect(c, x + 96, y - 28, 15, 15, '#d8a891'); rect(c, x + 5, y + 19, w - 10, 5, '#a39773');
  } else if (o.type === 'books' || o.type === 'cabinet') {
    const top = y - (o.type === 'books' ? 47 : 25);
    outline(c, x, top, w, y + h - top, '#9c7d5f', '#73634f'); rect(c, x + 4, top + 4, w - 8, y + h - top - 10, '#6d6252');
    if (o.type === 'books') for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 11; i++) { const bh = 12 + i * 3 % 8; const bx = x + 7 + i * 7, by = top + 23 + row * 23 - bh; rect(c, bx, by, 5, bh, ['#a7b4a0', '#b38371', '#9ba8b4', '#d2bc84'][i % 4]); rect(c, bx + 1, by + 3, 3, 1, '#ebd8ac'); }
      rect(c, x + 4, top + 23 + row * 23, w - 8, 4, '#b49b74');
    } else for (let row = 0; row < 3; row++) { outline(c, x + 4, top + 5 + row * 26, w - 8, 24, '#b29770', '#8b765b'); rect(c, x + w / 2 - 5, top + 13 + row * 26, 10, 3, '#dac59b'); }
  } else if (o.type === 'server') {
    outline(c, x + 2, y - 49, w - 4, h + 48, '#5b6c6c', '#475452'); rect(c, x + 7, y - 44, w - 14, h + 35, '#354b50');
    for (let i = 0; i < 8; i++) { rect(c, x + 11, y - 39 + i * 8, w - 22, 5, '#566e70'); rect(c, x + 14, y - 38 + i * 8, 14, 1, '#889994'); rect(c, x + w - 19, y - 38 + i * 8, 3, 2, (Math.floor(time * 2) + i) % 3 ? '#8bc4b7' : '#d6c47e'); }
  } else if (o.type === 'plant') pot(c, x + 16, y + 25, true);
  else if (o.type === 'sofa') {
    outline(c, x, y - 23, w, h + 23, '#637e7e', '#536568'); rect(c, x + 5, y - 20, w - 10, 24, '#91aaa0');
    for (let i = 0; i < 3; i++) { outline(c, x + 9 + i * 37, y + 3, 35, 20, '#a8bca8', '#718f87'); rect(c, x + 12 + i * 37, y + 5, 29, 2, '#c0cdb2'); }
    outline(c, x - 4, y - 9, 12, 35, '#829e92', '#586f6c'); outline(c, x + w - 8, y - 9, 12, 35, '#829e92', '#586f6c'); rect(c, x + 10, y + 28, 8, 4, '#74634e'); rect(c, x + w - 18, y + 28, 8, 4, '#74634e');
    outline(c, x + 12, y - 11, 21, 20, '#d7b98b', '#a98e70'); outline(c, x + 87, y - 10, 22, 21, '#789fa0', '#587a7d');
  } else if (o.type === 'meeting' || o.type === 'lowtable') {
    const top = o.type === 'meeting' ? y - 14 : y - 6;
    rect(c, x + 7, y + h - 12, 6, 14, '#8e7357'); rect(c, x + w - 13, y + h - 12, 6, 14, '#8e7357');
    outline(c, x, top, w, h + (y - top) - 10, '#bd9c72', '#8d775a'); rect(c, x + 3, top + 2, w - 6, h + (y - top) - 19, '#e1c598'); grain(c, x + 6, top + 4, w - 12, h - 6, 8);
    if (o.type === 'meeting') { rect(c, x + 12, top + 12, 26, 18, '#f2e6bf'); rect(c, x + 17, top + 16, 16, 1, '#9eac95'); rect(c, x + 17, top + 20, 12, 1, '#9eac95'); mug(c, x + w - 25, top + 15); outline(c, x + 52, top + 27, 26, 17, '#6f8d83', '#55716e'); rect(c, x + 55, top + 29, 20, 10, '#3d6267'); }
    else { rect(c, x + 8, top + 9, 19, 13, '#ab7e6b'); rect(c, x + 10, top + 11, 15, 2, '#e5cda2'); mug(c, x + 38, top + 8); }
  }
  c.restore();
}
export { palettes };
