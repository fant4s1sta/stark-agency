import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { CodexBridge } from '../src/backend/codex.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'tests/fake-codex.mjs');
let child, dataDir;
const port = 14310, base = `http://127.0.0.1:${port}`;
const request = async (endpoint, body, headers = {}) => {
  const r = await fetch(base + endpoint, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const waitFor = async check => {
  const limit = Date.now() + 8000;
  while (Date.now() < limit) { const value = await check(); if (value) return value; await new Promise(r => setTimeout(r, 30)); }
  throw new Error('Timed out waiting for state');
};
before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'stark-agency-test-')); await chmod(fixture, 0o755);
  child = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), OFFICE_DATA_DIR: dataDir, DEMO_STEP_MS: '60', CODEX_BIN: fixture }, stdio: ['ignore', 'pipe', 'pipe'] });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Server failed to start'); })]);
});
after(async () => { if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } });

test('seven unique agents and application assets are served', async () => {
  const r = await request('/api/state'); assert.equal(r.status, 200); assert.equal(new Set(r.body.agents.map(a => a.id)).size, 7);
  const home = await fetch(base); assert.match(await home.text(), /Stark Agency/);
  for (const file of ['three.module.js', 'three.core.js', 'OrbitControls.js', 'RoundedBoxGeometry.js']) { const r = await fetch(`${base}/vendor/${file}`); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /javascript/); }
  assert.equal((await fetch(`${base}/node_modules/three/package.json`)).status, 404);
  for (const asset of ['office.png', 'characters.png']) { const r = await fetch(`${base}/assets/${asset}`); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /image\/png/); }
});
test('cross-origin mutations and malformed requests are rejected', async () => {
  assert.equal((await request('/api/tasks', { title: 'x' }, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request('/api/tasks', { title: '' })).status, 400);
  assert.equal((await request('/api/tasks', { title: 'x', mode: 'live' })).status, 409);
  assert.equal((await request('/api/chat', { agent: 'missing', text: 'hi' })).status, 400);
});
test('demo completes all five phases, rejects concurrent jobs, and claims no real files', async () => {
  const r = await request('/api/tasks', { title: '体验协作', mode: 'demo' }); assert.equal(r.status, 201);
  assert.equal((await request('/api/tasks', { title: 'another' })).status, 409);
  const result = await waitFor(async () => { const s = (await request('/api/state')).body; return s.tasks.find(t => t.id === r.body.id)?.status === 'completed' && s; });
  const messages = result.messages.filter(m => m.taskId === r.body.id);
  assert.deepEqual(messages.map(m => m.agent), ['vision', 'friday', 'ultron', 'friday', 'vision']);
  assert.match(messages.at(-1).text, /没有调用模型/); assert.deepEqual(result.tasks.find(t => t.id === r.body.id).files, []);
});
test('stopping a demo prevents subsequent work', async () => {
  const r = await request('/api/tasks', { title: '停止验证', mode: 'demo' });
  assert.equal((await request('/api/stop', { id: r.body.id })).status, 200);
  await new Promise(r => setTimeout(r, 130));
  const s = (await request('/api/state')).body; assert.equal(s.tasks.find(t => t.id === r.body.id).status, 'cancelled'); assert.equal(s.messages.filter(m => m.taskId === r.body.id).length, 0);
});
test('Codex protocol fixture verifies live pipeline and persisted artifacts', async () => {
  assert.equal((await request('/api/connect', {})).body.connected, true);
  const r = await request('/api/tasks', { title: '协议测试', mode: 'live' }); assert.equal(r.status, 201);
  const s = await waitFor(async () => { const s = (await request('/api/state')).body; const t = s.tasks.find(t => t.id === r.body.id); return t?.files?.includes('OFFICE-HANDOFF.md') && s; });
  const task = s.tasks.find(t => t.id === r.body.id); assert.equal(task.status, 'completed'); assert.ok(task.files.includes('fixture-result.md'));
  assert.match(await readFile(path.join(task.cwd, 'OFFICE-HANDOFF.md'), 'utf8'), /协议验证成功/);
  assert.equal(s.messages.filter(m => m.taskId === task.id).length, 5);
  const file = await fetch(`${base}/api/file?task=${task.id}&path=fixture-result.md`);
  assert.equal(file.status, 200); assert.match((await file.json()).content, /Fixture output/);
  const outside = await fetch(`${base}/api/file?task=${task.id}&path=${encodeURIComponent('../../../state.json')}`);
  assert.equal(outside.status, 403);
  await waitFor(async () => { const saved = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8')); return saved.tasks.find(t => t.id === task.id)?.files?.length === 2; });
});
test('demo direct messages are labeled and remembered', async () => {
  assert.equal((await request('/api/chat', { agent: 'jarvis', text: '你好', mode: 'demo' })).status, 202);
  const s = await waitFor(async () => { const s = (await request('/api/state')).body; return s.messages.some(m => m.direct && m.from !== 'user') && s; });
  const replies = s.messages.filter(m => m.direct && m.agent === 'jarvis'); assert.equal(replies.length, 2); assert.match(replies[1].text, /演示回复/);
});
test('a needs-input stage stops the workflow rather than claiming delivery', async () => {
  const r = await request('/api/tasks', { title: 'NEEDS_INPUT_FIXTURE', mode: 'live' }); assert.equal(r.status, 201);
  const s = await waitFor(async () => { const s = (await request('/api/state')).body; return s.tasks.find(t => t.id === r.body.id)?.status === 'needs_input' && s; });
  const task = s.tasks.find(t => t.id === r.body.id); assert.equal(task.stage, 0); assert.equal(task.files.length, 0);
  assert.equal(s.messages.filter(m => m.taskId === task.id).length, 1);
  assert.equal((await request('/api/resume', { id: task.id, text: '' })).status, 400);
  assert.equal((await request('/api/resume', { id: task.id, text: '补充信息' })).status, 202);
  await waitFor(async () => { const s = (await request('/api/state')).body; return s.messages.filter(m => m.taskId === task.id).length === 2; });
});
test('bridge surfaces RPC errors and notifications without treating requests as replies', async () => {
  const b = new CodexBridge({ command: fixture }); await b.connect();
  try { await assert.rejects(b.request('unknown', {}), /Unsupported/); const approval = once(b, 'approval'); b.receive({ id: 999, method: 'item/fileChange/requestApproval', params: {} }); assert.equal((await approval)[0].id, 999); }
  finally { b.close(); }
});
