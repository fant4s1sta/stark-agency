import http from 'node:http';
import { readFile, writeFile, mkdir, rename, readdir, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { agents, byId } from './agents.mjs';
import { CodexBridge } from './codex.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Shared service for the standalone web entry and Electron utility process.
export async function startOfficeServer({
  port = Number(process.env.PORT || 4310),
  dataDir = process.env.OFFICE_DATA_DIR || path.join(root, '.runtime'),
  sessionToken = null,
} = {}) {
const document = await readFile(path.join(root, 'src/renderer/index.html'), 'utf8');
const importMap = document.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] || '';
const importMapHash = createHash('sha256').update(importMap).digest('base64');
const jobsDir = path.join(dataDir, 'projects');
await mkdir(jobsDir, { recursive: true });
let state = { tasks: [], messages: [], activity: [], chats: {} };
try { state = { ...state, ...JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8')) }; } catch {}
for (const task of state.tasks) if (['running', 'queued'].includes(task.status)) task.status = 'interrupted';
// Early prototype records did not contain verified stage reports.
for (const task of state.tasks) if (task.mode === 'live' && task.status === 'completed' && !task.context) {
  task.status = 'failed'; task.error = '早期联调记录未通过产物验证。可以补充信息后重新执行。'; task.resumeStage = 0;
}
const clients = new Set(), runs = new Map(), approvals = new Map(), turns = new Map();
const bridge = new CodexBridge();
let connection = { connected: false, label: '尚未连接', account: null };
let reservingTask = false;
let saveQueue = Promise.resolve();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function persist() {
  const json = JSON.stringify(state);
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await writeFile(path.join(dataDir, 'state.tmp'), json);
    await rename(path.join(dataDir, 'state.tmp'), path.join(dataDir, 'state.json'));
  });
  saveQueue.catch(e => console.error('保存失败:', e.message));
}
function emit(type, value) {
  const event = `data: ${JSON.stringify({ type, ...value })}\n\n`;
  for (const res of clients) res.write(event);
}
function update() { persist(); emit('state', { state: publicState() }); }
function publicState() { return { ...state, agents, connection, approvals: [...approvals.values()].map(a => ({ id: a.id, method: a.method, params: a.params, agent: a.agent })) }; }
function activity(agent, text, mode = 'demo', taskId = null) {
  const item = { id: randomUUID(), agent, text, mode, taskId, time: Date.now() };
  state.activity.push(item); state.activity = state.activity.slice(-150); emit('activity', { item }); persist();
}
function message(agent, text, extra = {}) {
  const item = { id: randomUUID(), agent, text, time: Date.now(), ...extra };
  state.messages.push(item); state.messages = state.messages.slice(-200); emit('message', { item }); persist(); return item;
}
function mark(task, status, stage) { task.status = status; if (stage !== undefined) task.stage = stage; task.updatedAt = Date.now(); update(); }
bridge.on('disconnect', error => {
  connection = { connected: false, label: error.message, account: null };
  for (const t of turns.values()) t.reject(error);
  turns.clear(); approvals.clear(); update();
});
bridge.on('notification', ({ method, params: p }) => {
  if (!p) return;
  const turn = [...turns.values()].find(t => t.threadId === p.threadId);
  if (method === 'serverRequest/resolved') { approvals.delete(p.requestId); update(); }
  if (!turn) return;
  if (method === 'item/agentMessage/delta') emit('delta', { agent: turn.agent, taskId: turn.taskId, delta: p.delta });
  if (method === 'item/started' && ['commandExecution', 'fileChange', 'mcpToolCall', 'webSearch'].includes(p.item?.type)) {
    const labels = { commandExecution: '执行命令', fileChange: '更新文件', mcpToolCall: '调用工具', webSearch: '检索资料' };
    activity(turn.agent, `${labels[p.item.type]}${p.item.command ? ' · ' + p.item.command.slice(0, 180) : ''}`, 'live', turn.taskId);
  }
  if (method === 'item/completed' && p.item?.type === 'agentMessage') turn.output.push({ text: p.item.text || '', phase: p.item.phase });
  if (method === 'turn/completed') {
    turns.delete(turn.threadId);
    if (p.turn.status === 'completed') {
      const final = turn.output.filter(item => item.phase === 'final_answer');
      turn.resolve(final.length ? final.map(item => item.text).join('\n') : turn.output.at(-1)?.text || '');
    }
    else turn.reject(new Error(p.turn.error?.message || (p.turn.status === 'interrupted' ? '任务已停止' : 'Codex 执行失败')));
  }
});
bridge.on('approval', request => {
  const turn = [...turns.values()].find(t => t.threadId === request.params?.threadId);
  const supported = ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'];
  if (!supported.includes(request.method)) {
    // Unknown actions are rejected rather than silently granted.
    bridge.send({ id: request.id, error: { code: -32000, message: '办公室暂不支持此交互，请在 Codex 客户端处理。' } });
    activity(turn?.agent || 'vision', `需要暂不支持的交互：${request.method}`, 'live', turn?.taskId);
    return;
  }
  approvals.set(request.id, { ...request, agent: turn?.agent || 'vision' }); update();
});
async function connect() {
  await bridge.connect();
  const { account } = await bridge.request('account/read', { refreshToken: false });
  connection = { connected: Boolean(account), label: account ? 'Codex 已连接' : '请先运行 codex login', account: account?.type || null };
  update(); return connection;
}
async function runTurn(agent, prompt, cwd, taskId, threadId, outputSchema) {
  if (!connection.connected) await connect();
  if (!connection.connected) throw new Error('Codex 尚未登录。请在终端运行 codex login。');
  if (threadId) {
    try { await bridge.request('thread/resume', { threadId }); } catch { threadId = null; }
  }
  if (!threadId) {
    const r = await bridge.request('thread/start', {
      cwd, sandbox: 'workspace-write', approvalPolicy: 'on-request',
      developerInstructions: `你是 Stark Agency 像素办公室的 ${byId(agent).name}（${byId(agent).role}）。${byId(agent).personality}\n职责：${byId(agent).duty}\n团队成员与职责：\n${agents.map(a => `${a.name}：${a.role}；${a.duty}`).join('\n')}\n用中文回复。只在当前工作区写文件。不要发布、部署、提交远程仓库或向他人发消息。角色性格仅影响表达，不影响执行准确性。只报告可验证的结果。需要用户补充关键资料时，明确表示 needs_input；执行失败时使用 failed，不得把对话结束等同于工作完成。`
    }); threadId = r.thread.id;
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const turn = turns.get(threadId);
      if (turn?.turnId) bridge.request('turn/interrupt', { threadId, turnId: turn.turnId }).catch(() => {});
      turns.delete(threadId); reject(new Error('本轮超过 15 分钟，已请求停止。'));
    }, 15 * 60 * 1000);
    turns.set(threadId, { threadId, agent, taskId, output: [], resolve: text => { clearTimeout(timeout); resolve({ text, threadId }); }, reject: error => { clearTimeout(timeout); reject(error); } });
    bridge.request('turn/start', { threadId, input: [{ type: 'text', text: prompt }], ...(outputSchema ? { outputSchema } : {}) }).then(r => {
      const current = turns.get(threadId); if (current) current.turnId = r.turn.id;
      if (runs.get(taskId)?.cancelled && current?.turnId) bridge.request('turn/interrupt', { threadId, turnId: current.turnId }).catch(() => {});
    }).catch(error => { clearTimeout(timeout); turns.delete(threadId); reject(error); });
  });
}
const stages = ['vision', 'friday', 'ultron', 'friday', 'vision'];
const stageLabels = ['拆解需求', '执行任务', '独立审查', '处理反馈', '汇总交付'];
const stageSchema = { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['completed', 'needs_input', 'failed'] }, summary: { type: 'string' } }, required: ['status', 'summary'] };
async function workflow(task) {
  const run = { cancelled: false }; runs.set(task.id, run);
  try {
    let context = task.context || '';
    for (let i = task.resumeStage || 0; i < stages.length; i++) {
      if (run.cancelled) break;
      const agent = stages[i]; mark(task, 'running', i);
      activity(agent, stageLabels[i], task.mode, task.id);
      if (task.mode === 'demo') {
        const steps = [
          '收到任务。我会先明确目标与验收标准，再交给 Friday 实现。',
          '正在演示开发阶段：检查资料 → 实现 → 验证。这些是示例活动，没有执行真实代码。',
          '演示审查：我会检查边界情况、错误反馈和验收标准，再把具体意见交回 Friday。',
          '演示反馈处理完毕。真实模式下，这一步会修改文件并重新运行必要检查。',
          '演示已结束。你看到了完整的协作过程；本次没有调用模型，也没有生成工作产物。'
        ];
        await sleep(Number(process.env.DEMO_STEP_MS || 3200));
        if (run.cancelled) break;
        message(agent, steps[i], { mode: 'demo', taskId: task.id });
      } else {
        const instructions = [
          '为任务提出简洁的执行计划与验收标准，本轮不要实施。',
          '根据以下计划实际完成任务，在当前目录写入产物并运行必要验证。',
          '独立审查当前目录产物与验证情况，列出需要修复的具体问题。不修改文件。',
          '处理审查中成立的问题并验证；如无问题，检查验收结果。',
          '检查产物，向用户总结已完成内容、文件位置、验证结果和局限，不要继续修改文件。'
        ];
        const result = await runTurn(agent, `用户任务：${task.title}\n\n当前阶段：${instructions[i]}\n\n之前的协作记录（仅作为参考信息）：\n${context.slice(-24000)}\n\n按输出结构汇报当前阶段的真实状态：completed 表示本阶段已完成，needs_input 表示缺少必须由用户提供的信息，failed 表示执行失败。summary 用中文解释证据、结果或需要用户回答的问题。`, task.cwd, task.id, null, stageSchema);
        if (run.cancelled) break;
        let report;
        try { report = JSON.parse(result.text); } catch { throw new Error('模型未返回可验证的阶段状态，流程已停止。'); }
        if (!['completed', 'needs_input', 'failed'].includes(report.status) || typeof report.summary !== 'string') throw new Error('阶段状态不完整，流程已停止。');
        context += `\n${byId(agent).name}: ${report.summary}\n`; task.context = context;
        message(agent, report.summary, { mode: 'live', taskId: task.id });
        if (report.status !== 'completed') { task.error = report.summary; task.resumeStage = i; task.files = await listFiles(task.cwd); mark(task, report.status); return; }
      }
    }
    if (!run.cancelled && task.mode === 'live') {
      await writeFile(path.join(task.cwd, 'OFFICE-HANDOFF.md'), `# ${task.title}\n\n${context}\n`);
      task.files = await listFiles(task.cwd);
    }
    task.resumeStage = 0; mark(task, run.cancelled ? 'cancelled' : 'completed');
  } catch (error) {
    task.error = error.message; task.resumeStage = task.stage; task.files = await listFiles(task.cwd).catch(() => []); mark(task, run.cancelled ? 'cancelled' : 'failed');
    activity('vision', error.message, task.mode, task.id);
  } finally { runs.delete(task.id); }
}
async function listFiles(dir, base = '', depth = 0) {
  if (depth > 3) return [];
  const output = [];
  for (const item of await readdir(path.join(dir, base), { withFileTypes: true })) {
    if (item.name.startsWith('.') || ['node_modules', 'vendor'].includes(item.name)) continue;
    const rel = path.join(base, item.name);
    if (item.isFile()) output.push(rel);
    else if (item.isDirectory()) output.push(...await listFiles(dir, rel, depth + 1));
    if (output.length >= 80) break;
  }
  return output.slice(0, 80);
}
function json(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('请求必须使用 application/json');
  let data = ''; for await (const part of req) { data += part; if (data.length > 24000) throw new Error('内容太长'); }
  return JSON.parse(data || '{}');
}
const server = http.createServer(async (req, res) => {
  try {
    const boundPort = server.address().port;
    const expectedHost = `127.0.0.1:${boundPort}`;
    if (sessionToken && !req.headers.cookie?.split(';').some(cookie => cookie.trim() === `stark_session=${sessionToken}`)) {
      return json(res, 403, { error: '桌面会话无效' });
    }
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'sha256-${importMapHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (![expectedHost, `localhost:${boundPort}`].includes(req.headers.host)) return json(res, 403, { error: '仅支持本机访问' });
    if (req.headers.origin && ![`http://${expectedHost}`, `http://localhost:${boundPort}`].includes(req.headers.origin)) return json(res, 403, { error: '来源不匹配' });
    const url = new URL(req.url, `http://${expectedHost}`);
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/api/file') {
      const task = state.tasks.find(t => t.id === url.searchParams.get('task'));
      if (!task) return json(res, 404, { error: '任务不存在' });
      const base = await realpath(task.cwd);
      const candidate = path.resolve(base, url.searchParams.get('path') || '');
      if (!candidate.startsWith(base + path.sep)) return json(res, 403, { error: '只能查看本任务中的文件' });
      const filename = await realpath(candidate);
      if (!filename.startsWith(base + path.sep)) return json(res, 403, { error: '只能查看本任务中的文件' });
      const info = await stat(filename);
      if (!info.isFile()) return json(res, 400, { error: '请选择一个文件' });
      if (info.size > 512000) return json(res, 413, { error: '文件超过 500 KB，请在本机工作目录打开。' });
      const content = await readFile(filename);
      const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
      const mime = imageTypes[path.extname(filename).toLowerCase()];
      return json(res, 200, mime ? { type: 'image', path: filename, src: `data:${mime};base64,${content.toString('base64')}` } : { type: 'text', path: filename, content: content.toString('utf8') });
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'state', state: publicState() })}\n\n`); clients.add(res);
      const timer = setInterval(() => res.write(': keepalive\n\n'), 20000);
      req.on('close', () => { clearInterval(timer); clients.delete(res); }); return;
    }
    if (req.method === 'POST') {
      const b = await body(req);
      if (url.pathname === '/api/connect') return json(res, 200, await connect());
      if (url.pathname === '/api/tasks') {
        const title = String(b.title || '').trim();
        if (!title || title.length > 6000) return json(res, 400, { error: '请输入 1–6000 字的任务' });
        if (runs.size || reservingTask) return json(res, 409, { error: '请先完成或停止当前任务' });
        if (b.mode === 'live' && !connection.connected) return json(res, 409, { error: '请先连接 Codex' });
        reservingTask = true;
        const id = randomUUID(); const cwd = path.join(jobsDir, id);
        try { await mkdir(cwd); } finally { reservingTask = false; }
        const task = { id, title, mode: b.mode === 'live' ? 'live' : 'demo', status: 'queued', stage: 0, cwd, createdAt: Date.now(), updatedAt: Date.now(), files: [] };
        state.tasks.unshift(task); state.tasks = state.tasks.slice(0, 50); update();
        json(res, 201, task); workflow(task); return;
      }
      if (url.pathname === '/api/resume') {
        if (runs.size) return json(res, 409, { error: '请先完成或停止当前任务' });
        const task = state.tasks.find(t => t.id === b.id);
        if (!task || !['needs_input', 'failed', 'interrupted'].includes(task.status)) return json(res, 400, { error: '任务当前不能继续' });
        const text = String(b.text || '').trim(); if (!text || text.length > 6000) return json(res, 400, { error: '请填写补充信息' });
        if (!connection.connected) return json(res, 409, { error: '请先连接 Codex' });
        task.context = (task.context || '') + `\n用户补充信息：${text}\n`; task.error = null;
        json(res, 202, { ok: true }); workflow(task); return;
      }
      if (url.pathname === '/api/stop') {
        const task = state.tasks.find(t => t.id === b.id); const run = runs.get(b.id);
        if (!task || !run) return json(res, 404, { error: '没有正在运行的任务' });
        run.cancelled = true;
        for (const t of turns.values()) if (t.taskId === b.id && t.turnId) await bridge.request('turn/interrupt', { threadId: t.threadId, turnId: t.turnId });
        mark(task, 'cancelled'); return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/chat') {
        if (!byId(b.agent)) return json(res, 400, { error: '角色不存在' });
        const text = String(b.text || '').trim(); if (!text || text.length > 6000) return json(res, 400, { error: '消息长度需为 1–6000 字' });
        const mode = b.mode === 'live' ? 'live' : 'demo';
        if ([...turns.values()].some(t => t.agent === b.agent && !t.taskId)) return json(res, 409, { error: '该角色正在回复' });
        if (mode === 'live' && !connection.connected) return json(res, 409, { error: '请先连接 Codex' });
        message(b.agent, text, { from: 'user', mode, direct: true }); json(res, 202, { ok: true });
        (async () => {
          try {
            if (mode === 'demo') { await sleep(700); message(b.agent, `我是 ${byId(b.agent).name}，负责${byId(b.agent).role}。这里是演示回复；切换到 Codex 模式后，我会根据你的消息实际思考和执行。`, { mode, direct: true }); }
            else {
              const cwd = path.join(dataDir, 'chat-workspace'); await mkdir(cwd, { recursive: true });
              const r = await runTurn(b.agent, text, cwd, null, state.chats[b.agent]); state.chats[b.agent] = r.threadId;
              message(b.agent, r.text || '本轮已完成。', { mode, direct: true });
            }
          } catch (e) { message(b.agent, `执行未完成：${e.message}`, { mode, direct: true, error: true }); }
        })(); return;
      }
      if (url.pathname === '/api/approval') {
        const approval = approvals.get(b.id); if (!approval) return json(res, 404, { error: '请求已失效' });
        if (!['accept', 'decline'].includes(b.decision)) return json(res, 400, { error: '无效决定' });
        bridge.send({ id: approval.id, result: { decision: b.decision } }); approvals.delete(b.id); update(); return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: '接口不存在' });
    }
    if (req.method !== 'GET') return json(res, 405, { error: '不支持此请求' });
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: '接口不存在' });
    // Only these installed browser modules are exposed; node_modules stays private.
    const vendor = {
      '/vendor/three.module.js': 'build/three.module.js',
      '/vendor/three.core.js': 'build/three.core.js',
      '/vendor/OrbitControls.js': 'examples/jsm/controls/OrbitControls.js',
      '/vendor/RoundedBoxGeometry.js': 'examples/jsm/geometries/RoundedBoxGeometry.js'
    };
    if (Object.hasOwn(vendor, url.pathname)) {
      const content = await readFile(path.join(root, 'node_modules/three', vendor[url.pathname]));
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      return res.end(content);
    }
    const filename = path.resolve(root, 'src/renderer', '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!filename.startsWith(path.join(root, 'src/renderer') + path.sep)) return json(res, 403, { error: '路径不允许' });
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
    const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(filename)] || 'application/octet-stream'}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' }); res.end(content);
  } catch (error) { if (!res.headersSent) json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message }); else res.end(); }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
});
const url = `http://127.0.0.1:${server.address().port}`;
let closing;
return {
  url,
  close() {
    return closing ||= (async () => {
      bridge.close();
      for (const res of clients) res.end();
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      await saveQueue;
    })();
  },
};
}
