import { TILE, WIDTH, HEIGHT, objects, stations, gathering, createGrid, findPath, nearestFree, key, depth } from './world.js';
import { sprite, background, drawObject, drawCharacter } from './pixel-art.js';

const actions = { idle: '歇一会', walk: '走动中', work: '工作中', planning: '整理想法', repair: '整理工具', read: '阅读中', coffee: '喝咖啡', water: '照料绿植', talk: '交流中', rest: '休息中' };
export function portrait(id, className = '') {
  const c = document.createElement('canvas'); c.width = 64; c.height = 80; c.className = className;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(sprite(id), 0, 0, 64, 80); return c;
}
export class OfficeScene {
  constructor(agents, onSelect, onAmbient, view = null) {
    this.view = view; this.grid = createGrid(); this.bg = view ? null : background(); this.canvas = document.querySelector('#office-game'); this.ctx = view ? null : this.canvas.getContext('2d');
    this.canvas.width = WIDTH; this.canvas.height = HEIGHT;
    this.onAmbient = onAmbient; this.selected = 'vision'; this.zoom = 1; this.busy = null; this.time = 0; this.last = 0;
    this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches; this.nextSocial = 25; this.socialIndex = 0;
    this.people = agents.map((a, i) => {
      const s = stations[a.id], el = document.createElement('button'); el.type = 'button'; el.className = 'actor game-actor'; el.setAttribute('aria-label', `${a.name} · ${a.role}`);
      el.onclick = e => { e.stopPropagation(); onSelect(a.id); }; document.querySelector('#actors').append(el);
      return { ...a, kind: 'actor', el, tile: { x: s.x, y: s.y }, x: s.x * TILE + 16, y: s.y * TILE + 16, facing: s.facing, action: s.action, goal: null, path: [], next: null, walkClock: 0, nextDecision: 3 + i * 2, routine: i, bubbleEnd: 0 };
    });
    if (view) view.bind(this, onSelect);
    if (!view) this.canvas.addEventListener('click', e => this.click(e));
    if (!view) this.canvas.addEventListener('pointermove', e => { const point = this.point(e); this.hover = this.objectAt(point); this.canvas.style.cursor = this.hover ? 'pointer' : 'crosshair'; });
    this.canvas.addEventListener('pointerleave', () => { this.hover = null; });
    this.canvas.addEventListener('keydown', e => {
      const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (!delta) return; e.preventDefault(); const p = this.people.find(p => p.id === this.selected);
      this.command(p, { x: (p.next || p.tile).x + delta[0], y: (p.next || p.tile).y + delta[1], action: 'idle', facing: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key] });
    });
    document.querySelector('#gather').onclick = () => this.gather();
    document.querySelector('#go-home').onclick = () => { this.social = null; this.people.forEach(p => this.go(p, stations[p.id], 15)); this.hint('伙伴们正沿走道返回各自的工位'); };
    requestAnimationFrame(t => this.tick(t));
  }
  hint(text) { document.querySelector('#game-hint').textContent = text; }
  point(e) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * WIDTH, y: (e.clientY - r.top) / r.height * HEIGHT }; }
  objectAt(point) { return [...objects].sort((a, b) => depth(b) - depth(a)).find(o => point.x >= o.x * TILE && point.x < (o.x + o.w) * TILE && point.y >= o.y * TILE - 24 && point.y < (o.y + o.h) * TILE); }
  click(e) {
    const point = this.point(e), object = this.objectAt(point), p = this.people.find(p => p.id === this.selected);
    let goal = object && Object.values(stations).find(s => s.object === object.id);
    if (!goal && object) { const tile = nearestFree(this.grid, { x: object.x, y: object.y + object.h }, this.blocked(p)); goal = tile && { ...tile, action: object.type === 'plant' ? 'water' : 'idle', facing: 'up', label: '观察办公室里的小物件' }; }
    if (!object) goal = { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE), action: 'idle', label: '走到这里' };
    if (goal) this.command(p, goal);
  }
  command(p, goal) {
    if (p.id === this.busy) { this.hint(`${p.name} 正在执行任务，完成后再活动`); return; }
    if (this.paused) { this.hint('生活已暂停，点击「继续生活」后角色会行动'); }
    this.social = null; p.manualUntil = this.time + 40;
    if (this.go(p, goal, 18)) { this.hint(`${p.name} · ${goal.label || '沿走道前往目的地'}`); this.destination = { ...p.goal, until: this.time + 18 }; }
    else this.hint('这里暂时无法到达，试试空地或另一件家具');
  }
  blocked(person, reserveGoals = false) {
    const occupied = new Set();
    for (const p of this.people) if (p !== person) {
      occupied.add(key(p.tile.x, p.tile.y)); if (p.next) occupied.add(key(p.next.x, p.next.y));
      if (reserveGoals && p.goal) occupied.add(key(p.goal.x, p.goal.y));
    }
    return occupied;
  }
  go(p, goal, hold = 9) {
    const blocked = this.blocked(p, true), start = p.next || p.tile;
    // Keep a furniture interaction at its actual station; never animate drinking at a remote tile.
    if (blocked.has(key(goal.x, goal.y))) return false;
    const path = findPath(this.grid, start, goal, blocked); if (!path) return false;
    p.goal = { ...goal }; p.path = path; p.hold = hold; p.nextDecision = Infinity; p.retryAt = 0;
    if (!p.next && !path.length) this.arrive(p);
    return true;
  }
  arrive(p) {
    const goal = p.goal; p.action = goal?.action || 'idle'; if (goal?.facing) p.facing = goal.facing;
    p.nextDecision = this.time + (p.hold || 9); p.goal = null;
  }
  setSelected(id) { this.selected = id; this.people.forEach(p => p.el.classList.toggle('is-selected', p.id === id)); }
  setBusy(id) {
    if (this.busy === id) return; this.busy = id; this.social = null;
    this.people.forEach(p => { p.el.classList.toggle('working', p.id === id); if (p.id === id) { this.go(p, stations[id], 12); p.nextDecision = this.time; } });
  }
  say(id, text, duration = 6500) {
    const p = this.people.find(p => p.id === id); if (!p) return;
    p.el.querySelector('.speech')?.remove(); const bubble = document.createElement('span'); bubble.className = 'speech'; bubble.textContent = text.slice(0, 54); p.el.append(bubble); p.bubbleEnd = this.time + duration / 1000;
  }
  setPaused(value) { this.paused = value; }
  setZoom(value) { if (this.view) return this.view.setZoom(value); this.zoom = Math.max(1, Math.min(2, value)); document.querySelector('#scene').style.width = `${this.zoom * 100}%`; return Math.round(this.zoom * 100); }
  gather() {
    this.social = null; let count = 0;
    this.people.forEach((p, i) => { p.manualUntil = this.time + 45; if (p.id !== this.busy && this.go(p, { ...gathering[i], action: 'talk' }, 25)) count++; });
    this.hint(`${count} 位伙伴前往讨论桌，工作中的伙伴会留在工位`);
  }
  startSocial() {
    const free = this.people.filter(p => p.id !== this.busy && !p.goal && !p.next && !(p.manualUntil > this.time));
    if (free.length < 2) return;
    const a = free[this.socialIndex++ % free.length], b = free[(free.indexOf(a) + 1) % free.length];
    if (this.go(a, { x: 11, y: 9, facing: 'right', action: 'talk' }, 15) && this.go(b, { x: 12, y: 9, facing: 'left', action: 'talk' }, 15)) this.social = { a, b, phase: 0 };
  }
  update(p, dt) {
    if (p.next) {
      const x = p.next.x * TILE + 16, y = p.next.y * TILE + 16, dx = x - p.x, dy = y - p.y, distance = Math.hypot(dx, dy), step = dt * 53;
      p.action = 'walk'; p.walkClock += dt; p.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
      if (distance <= step) { p.x = x; p.y = y; p.tile = p.next; p.next = null; if (!p.path.length) this.arrive(p); }
      else { p.x += dx / distance * step; p.y += dy / distance * step; }
    } else if (p.path.length && this.time >= p.retryAt) {
      const blocked = this.blocked(p), first = p.path[0];
      if (blocked.has(key(first.x, first.y))) {
        p.path = findPath(this.grid, p.tile, p.goal, blocked) || p.path; p.retryAt = this.time + .35; p.action = 'idle';
      } else p.next = p.path.shift();
    } else if (!p.goal && this.time >= p.nextDecision) {
      if (p.id === this.busy) {
        const home = stations[p.id]; if (p.tile.x === home.x && p.tile.y === home.y) { p.action = home.action; p.facing = home.facing; p.nextDecision = this.time + 3; }
        else if (!this.go(p, home)) p.nextDecision = this.time + 1;
      } else {
        const routine = [stations[p.id], stations.coffee, stations[p.id], stations.books, stations.lounge, stations[p.id], stations.plants];
        const target = routine[(++p.routine) % routine.length];
        if (!this.go(p, target, 6 + this.people.indexOf(p))) p.nextDecision = this.time + 2;
      }
    }
  }
  tick(now) {
    const dt = this.last ? Math.min((now - this.last) / 1000, .05) : 0; this.last = now;
    if (!this.paused) {
      this.time += dt; for (const p of this.people) this.update(p, dt);
      if (this.time > this.nextSocial) { this.nextSocial = this.time + 35; this.startSocial(); }
      const s = this.social;
      if (s && !s.a.goal && !s.b.goal && !s.a.next && !s.b.next) {
        if (s.phase === 0) { const text = '过来聊聊：下一步先解决哪个问题？'; this.say(s.a.id, text); this.onAmbient(s.a.id, text); s.phase = 1; s.replyAt = this.time + 4; }
        else if (this.time > s.replyAt) { const text = '先把目标拆小，再一起检查结果。'; this.say(s.b.id, text); this.onAmbient(s.b.id, text); this.social = null; }
      }
    }
    this.render(); requestAnimationFrame(t => this.tick(t));
  }
  render() {
    if (this.view) { this.view.render(this); return; }
    const c = this.ctx; c.imageSmoothingEnabled = false; c.drawImage(this.bg, 0, 0);
    const selected = this.people.find(p => p.id === this.selected);
    if (selected.goal) { c.fillStyle = '#fff2bd88'; for (const tile of selected.path) c.fillRect(tile.x * TILE + 14, tile.y * TILE + 14, 4, 4); }
    if (this.destination && this.destination.until > this.time) { c.strokeStyle = '#faf0b9'; c.lineWidth = 2; c.strokeRect(this.destination.x * TILE + 6, this.destination.y * TILE + 6, 20, 20); }
    c.strokeStyle = '#f6e8ac'; c.lineWidth = 2; c.beginPath(); c.ellipse(selected.x, selected.y, 17, 6, 0, 0, Math.PI * 2); c.stroke();
    for (const entity of [...objects, ...this.people].sort((a, b) => depth(a) - depth(b))) {
      if (entity.kind === 'actor') drawCharacter(c, entity, this.time);
      else drawObject(c, entity, this.time, this.people.some(p => p.action !== 'walk' && stations[p.id]?.object === entity.id && p.tile.x === stations[p.id].x && p.tile.y === stations[p.id].y), this.hover === entity);
    }
    for (const p of this.people) {
      p.el.style.left = `${p.x / WIDTH * 100}%`; p.el.style.top = `${p.y / HEIGHT * 100}%`;
      p.el.style.zIndex = Math.round(p.y); p.el.dataset.action = p.action; p.el.dataset.tile = key(p.tile.x, p.tile.y); p.el.dataset.facing = p.facing;
      p.el.title = `${p.name} · ${actions[p.action]}`;
      if (p.bubbleEnd && this.time > p.bubbleEnd) { p.el.querySelector('.speech')?.remove(); p.bubbleEnd = 0; }
    }
  }
}
