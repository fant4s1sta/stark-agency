import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, findPath, stations, gathering, objects, key, depth } from '../src/renderer/world.js';
import { OfficeScene } from '../src/renderer/scene.js';
const grid = createGrid();
test('every activity and meeting position is reachable without crossing furniture', () => {
  for (const target of [...Object.values(stations), ...gathering]) {
    const start = { x: 12, y: 16 }, path = findPath(grid, start, target);
    assert.ok(path, JSON.stringify(target)); let last = start;
    for (const p of path) { assert.ok(grid[p.y][p.x]); assert.equal(Math.abs(p.x - last.x) + Math.abs(p.y - last.y), 1); last = p; }
    assert.deepEqual(last, { x: target.x, y: target.y });
  }
  for (const o of objects) assert.equal(findPath(grid, { x: 12, y: 16 }, o), null);
});
test('path routes around occupied tiles, rejects walls and sorts furniture by feet', () => {
  const occupied = new Set(['12,15', '13,15']);
  const path = findPath(grid, { x: 12, y: 16 }, { x: 12, y: 14 }, occupied);
  assert.ok(path.length > 2); assert.ok(path.every(p => !occupied.has(key(p.x, p.y))));
  assert.equal(findPath(grid, { x: 1, y: 4 }, { x: 0, y: 4 }), null);
  assert.ok(depth({kind:'actor',y:350}) < depth(objects.find(o => o.id === 'meeting')));
  assert.ok(depth({kind:'actor',y:432}) > depth(objects.find(o => o.id === 'meeting')));
});
function element() {
  return { style: {}, dataset: {}, classList: { toggle() {} }, children: [], append(e) { this.children.push(e); }, setAttribute() {}, addEventListener() {}, querySelector() { return null; }, getContext() { return new Proxy({}, { get: (_, name) => name === 'measureText' ? () => ({width:20}) : () => {} }); } };
}
function setup() {
  globalThis.document = { createElement: element, querySelector: () => element() };
  globalThis.matchMedia = () => ({matches:false}); globalThis.requestAnimationFrame = () => {};
  return new OfficeScene(['vision','jarvis','friday','ultron','edith','dume','u'].map(id => ({id,name:id})), () => {}, () => {});
}
function advance(scene, seconds) {
  for (let i = 0; i < seconds * 60; i++) {
    scene.time += 1/60;
    for (const p of scene.people) scene.update(p, 1/60);
    const reserved = new Set();
    for (const p of scene.people) {
      for (const t of [p.tile, ...(p.next ? [p.next] : [])]) { assert.ok(grid[t.y][t.x], `${p.id} entered furniture`); const k = key(t.x,t.y); assert.ok(!reserved.has(k), `actors overlap at ${k}`); reserved.add(k); }
    }
  }
}
test('seven actors gather, return to work, and avoid each other for three simulated minutes', () => {
  const scene = setup(); scene.gather(); advance(scene, 20);
  scene.people.forEach((p,i) => { assert.deepEqual(p.tile, {x:gathering[i].x,y:gathering[i].y}); assert.equal(p.action,'talk'); });
  scene.people.forEach(p => scene.go(p, stations[p.id], 100)); advance(scene, 25);
  scene.people.forEach(p => assert.deepEqual(p.tile,{x:stations[p.id].x,y:stations[p.id].y}));
  scene.people.forEach(p => p.nextDecision=scene.time); advance(scene,180);
});
test('walking reaches an interaction, busy goes home, and pause freezes positions', () => {
  const scene = setup(), p = scene.people[0]; scene.people.forEach(p => p.nextDecision=Infinity);
  assert.ok(scene.go(p,stations.coffee,100)); advance(scene,8); assert.equal(p.action,'coffee');
  scene.setBusy('vision'); advance(scene,8); assert.deepEqual(p.tile,{x:7,y:4}); assert.equal(p.action,'planning');
  scene.setBusy(null); scene.command(p,{x:12,y:9,action:'idle'}); scene.setPaused(true);
  const before=scene.people.map(p=>[p.x,p.y]); scene.tick(1000); scene.tick(1050); assert.deepEqual(scene.people.map(p=>[p.x,p.y]),before);
});
