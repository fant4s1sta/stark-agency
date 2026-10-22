import { OfficeScene, portrait } from './scene-3d.js';
const $ = q => document.querySelector(q);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = { agents: [], tasks: [], messages: [], activity: [], approvals: [], connection: { connected: false } };
let mode = 'demo', tab = 'feed', selected = 'vision', scene, toastTimer;
let ambient = [], busyChat = new Set(), streamText = new Map();
const phases = ['拆解需求', '执行任务', '独立审查', '处理反馈', '汇总交付'];
const stageAgents = ['vision', 'friday', 'ultron', 'friday', 'vision'];
const statuses = { queued: '等待开始', running: '协作中', completed: '已完成', needs_input: '等待补充', failed: '未完成', cancelled: '已停止', interrupted: '已中断' };
const agent = id => state.agents.find(a => a.id === id);
const timeOf = value => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const node = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text) e.textContent = text; return e; };
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4500); }
async function post(url, data) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await res.json(); if (!res.ok) throw new Error(result.error || '请求未完成'); return result;
}
function select(id) { selected = id; scene?.setSelected(id); setTab('profile'); renderRoster(); }
function setTab(value) { tab = value; document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); }); renderPanel(); $('#panel-content').scrollTop = 0; }
function renderRoster() {
  const roster = $('#roster'); roster.replaceChildren();
  const activeTask = state.tasks.find(t => t.status === 'running');
  for (const a of state.agents) {
    const button = node('button', `agent-card${selected === a.id ? ' active' : ''}${activeTask && stageAgents[activeTask.stage] === a.id ? ' busy' : ''}`);
    button.type = 'button'; button.setAttribute('aria-label', `${a.name} · ${a.role}`); button.setAttribute('aria-pressed', selected === a.id);
    const image = node('span', 'agent-avatar'); image.append(portrait(a.id)); button.append(image, node('strong', '', a.name), node('small', '', a.role), node('i', 'agent-dot'));
    button.addEventListener('click', () => select(a.id)); roster.append(button);
  }
}
function renderState() {
  const current = state.tasks.find(t => t.status === 'running');
  scene?.setBusy(current ? stageAgents[current.stage] : null);
  $('#office-status').textContent = current ? `${agent(stageAgents[current.stage])?.name} 正在${phases[current.stage]}${current.mode === 'demo' ? ' · 演示' : ''}` : '伙伴们正在享受办公室时光';
  $('#task-count').textContent = state.tasks.length;
  $('#submit-task').disabled = Boolean(current || state.tasks.some(t => t.status === 'queued'));
  $('#submit-task').innerHTML = current ? '团队协作中 <span>◌</span>' : '交给团队 <span>↗</span>';
  renderRoster(); renderPanel();
  renderSceneMode();
}
function renderSceneMode() {
  const task = state.tasks.find(t => t.status === 'running');
  const live = (task?.mode || mode) === 'live';
  $('#scene-mode').innerHTML = `<i></i> ${live ? (task ? 'Codex 正在工作' : 'Codex 已连接') : '演示空间'}`;
  $('#scene-mode').classList.toggle('real', live);
}
function feedItem(item) {
  const a = agent(item.agent) || state.agents[0];
  const row = node('div', 'feed-item'); row.style.setProperty('--agent-color', a.color);
  row.innerHTML = `<div class="feed-avatar">${esc(a.icon)}</div><div class="feed-body"><div class="feed-head"><strong>${esc(item.from === 'user' ? '你 → ' + a.name : a.name)}</strong>${item.mode === 'demo' ? '<span class="demo-badge">演示</span>' : item.mode === 'life' ? '<span class="demo-badge">生活</span>' : '<span class="demo-badge">Codex</span>'}<time>${timeOf(item.time)}</time></div></div>`;
  const text = node('div', `feed-text${item.text.length > 240 ? ' collapsed' : ''}`, item.text); row.querySelector('.feed-body').append(text);
  if (item.text.length > 240) { const more = node('button', 'expand-button', '展开全文 ↓'); more.addEventListener('click', () => { text.classList.toggle('collapsed'); more.textContent = text.classList.contains('collapsed') ? '展开全文 ↓' : '收起 ↑'; }); row.querySelector('.feed-body').append(more); }
  if (item.tag) row.querySelector('.feed-body').append(node('span', 'feed-tag', item.tag));
  return row;
}
function renderPanel() {
  if (!state.agents.length) return;
  const panel = $('#panel-content');
  // Do not replace the direct-message form while someone is typing.
  const typing = panel.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
  if (typing && tab === 'profile' && panel.dataset.agent === selected) { renderChat(); return; }
  panel.replaceChildren(); panel.dataset.agent = selected;
  for (const approval of state.approvals) {
    const banner = node('div', 'approval-banner', `${agent(approval.agent)?.name} 需要你的批准才能继续。`);
    const open = node('button', '', '查看请求 →'); open.onclick = () => showApproval(approval); banner.append(open); panel.append(banner);
  }
  if (tab === 'feed') {
    panel.append(node('div', 'feed-date', '今天 · 在这个小小的办公室里'));
    const entries = [...state.messages.filter(m => !m.direct), ...state.activity.map(a => ({ ...a, tag: '执行记录' })), ...ambient].sort((a, b) => b.time - a.time).slice(0, 65);
    const defaults = [
      { agent: 'vision', text: '欢迎来到 Stark Agency。给我们一个目标，让好想法从这里开始。', tag: '等待你的第一个目标' },
      { agent: 'friday', text: '开发环境已就位。点击下方示例，可以先体验一次团队协作。' },
      { agent: 'jarvis', text: '每一次讨论和任务记录都会保存在这台电脑上，随时可以回来查看。' }
    ].map((x, i) => ({ ...x, time: Date.now() - i * 60000, mode: 'demo' }));
    for (const item of entries.length ? entries : defaults) panel.append(feedItem(item));
    const current = state.tasks.find(t => t.status === 'running');
    if (current && streamText.has(stageAgents[current.stage])) {
      const item = feedItem({ agent: stageAgents[current.stage], text: streamText.get(stageAgents[current.stage]).slice(-1500), time: Date.now(), mode: 'live', tag: '正在回复…' }); panel.prepend(item);
    }
  } else if (tab === 'profile') {
    const a = agent(selected);
    const head = node('div', 'profile-head'); const image = node('div', 'profile-portrait'); image.append(portrait(a.id));
    const info = node('div'); info.innerHTML = `<h3>${esc(a.name)}</h3><span class="role-chip">${esc(a.role)}</span>`; head.append(image, info); panel.append(head);
    panel.append(node('p', 'profile-personality', a.personality), node('div', 'profile-label', '在团队里的工作'), node('p', 'profile-duty', a.duty));
    panel.append(node('div', 'profile-label', `与 ${a.name} 聊聊`)); const history = node('div', 'chat-history'); history.id = 'chat-history'; panel.append(history);
    const form = node('form', 'chat-form'); const input = node('input'); input.placeholder = '聊个想法，或者问个问题…'; input.maxLength = 6000; input.setAttribute('aria-label', `发消息给 ${a.name}`);
    const send = node('button', '', busyChat.has(selected) ? '…' : '↑'); send.type = 'submit'; send.setAttribute('aria-label', '发送消息'); send.disabled = busyChat.has(selected);
    form.append(input, send); form.addEventListener('submit', async e => {
      e.preventDefault(); const text = input.value.trim(); if (!text || busyChat.has(a.id)) return;
      busyChat.add(a.id); send.disabled = true; send.textContent = '…';
      try { await post('/api/chat', { agent: a.id, text, mode }); input.value = ''; }
      catch (e) { busyChat.delete(a.id); send.disabled = false; send.textContent = '↑'; toast(e.message); }
    }); panel.append(form, node('p', 'profile-note', mode === 'demo' ? '当前为演示回复。切换到 Codex 可进行真实对话。' : '真实 Codex 对话 · 每位伙伴保留自己的会话上下文。'));
    renderChat();
  } else {
    if (!state.tasks.length) panel.innerHTML += '<div class="empty-state"><span>▤</span>这里还没有任务<br>把第一个目标交给团队吧。</div>';
    for (const task of state.tasks) {
      const card = node('article', 'task-card');
      card.innerHTML = `<div class="task-meta"><span>${task.mode === 'demo' ? '◌ 演示任务' : '⌘ Codex 任务'}</span><span class="task-status ${task.status}">${statuses[task.status] || esc(task.status)}</span></div><h3>${esc(task.title)}</h3><div class="task-progress">${phases.map((_, i) => `<i class="${task.status === 'completed' || i <= task.stage ? 'done' : ''}"></i>`).join('')}</div><div class="task-stage">${esc(phases[task.stage])} · ${timeOf(task.createdAt)}</div>`;
      if (task.error) card.append(node('p', 'task-error', task.error));
      if (task.mode === 'live') { const files = node('div', 'task-files', `工作目录：${task.cwd}${task.files?.length ? '\n产物：' + task.files.join('、') : ''}`); card.append(files); }
      for (const file of task.files || []) {
        const button = node('button', 'file-button', `▤ ${file} ↗`);
        button.onclick = async () => {
          try {
            const response = await fetch(`/api/file?task=${encodeURIComponent(task.id)}&path=${encodeURIComponent(file)}`); const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            modal(file, `<p style="font-size:10px;overflow-wrap:anywhere">${esc(result.path)}</p>`);
            if (result.type === 'image') { const image = node('img'); image.src = result.src; image.alt = file; image.style.width = '100%'; $('#modal-body').append(image); }
            else { const pre = node('pre', '', result.content); pre.style.maxHeight = '55vh'; $('#modal-body').append(pre); }
          } catch (e) { toast(e.message); }
        }; card.append(button);
      }
      if (task.status === 'running' || task.status === 'queued') { const stop = node('button', 'stop-task', '停止任务'); stop.onclick = async () => { stop.disabled = true; try { await post('/api/stop', { id: task.id }); toast('已请求停止任务'); } catch (e) { toast(e.message); stop.disabled = false; } }; card.append(stop); }
      if (['needs_input', 'failed', 'interrupted'].includes(task.status) && task.mode === 'live') {
        const resume = node('button', 'secondary-button', '补充信息并继续'); resume.style.marginTop = '12px';
        resume.onclick = () => {
          modal('补充信息，继续这项任务', `<p>${esc(task.error || task.title)}</p><form id="resume-form"><label for="resume-text" class="profile-label">你的补充信息</label><textarea id="resume-text" maxlength="6000" required style="width:100%;min-height:100px;padding:10px;border:1px solid #dfe5d4;border-radius:7px;font:inherit;font-size:12px;background:#fffefa"></textarea><div class="modal-actions"><button class="primary-button" type="submit">继续任务 ↗</button></div></form>`);
          $('#resume-form').onsubmit = async e => { e.preventDefault(); try { await post('/api/resume', { id: task.id, text: $('#resume-text').value }); $('#modal').close(); toast('任务已继续，原有文件保留'); } catch (e) { toast(e.message); } };
        }; card.append(resume);
      }
      panel.append(card);
    }
  }
}
function renderChat() {
  const history = $('#chat-history'); if (!history) return; history.replaceChildren();
  const messages = state.messages.filter(m => m.direct && m.agent === selected).slice(-30);
  for (const m of messages) { const el = node('div', `chat-msg${m.from === 'user' ? ' mine' : ''}`); el.append(node('small', '', `${m.from === 'user' ? '你' : agent(selected).name} · ${m.mode === 'demo' ? '演示' : 'Codex'}`), document.createTextNode(m.text)); history.append(el); }
  if (busyChat.has(selected)) history.append(node('div', 'chat-msg', streamText.get(selected)?.slice(-1500) || '正在思考…'));
  history.scrollTop = history.scrollHeight;
  const send = $('.chat-form button'); if (send) { send.disabled = busyChat.has(selected); send.textContent = busyChat.has(selected) ? '…' : '↑'; }
}
function setMode(value) {
  if (value === 'live' && !state.connection.connected) { showSettings(); return; }
  mode = value;
  $('#demo-mode').classList.toggle('active', value === 'demo'); $('#live-mode').classList.toggle('active', value === 'live');
  $('#demo-mode').setAttribute('aria-pressed', value === 'demo'); $('#live-mode').setAttribute('aria-pressed', value === 'live');
  $('#mode-description').innerHTML = value === 'demo' ? '<i class="status-dot amber"></i> 演示模式 · 体验协作流程，不调用模型' : '<i class="status-dot"></i> Codex 已连接 · 将实际执行任务并生成文件';
  renderSceneMode(); renderPanel();
}
function modal(title, html) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; if (!$('#modal').open) $('#modal').showModal(); }
function showSettings() {
  modal('连接你的 Codex', `<div class="connection-status">${esc(state.connection.label || '尚未连接')} ${state.connection.connected ? '✓' : ''}</div><p>办公室通过本机 Codex App Server 工作，使用已登录的 Codex 账户和默认模型。每个任务在独立目录里执行。</p><p>如果尚未登录，先在终端运行 <code>codex login</code>，再点击连接。</p><p>命令与文件修改遵循 Codex 的权限设置。需要批准时，你会在办公室内看到具体请求。</p><div class="modal-actions"><button class="primary-button" id="connect-codex">${state.connection.connected ? '重新检查连接' : '连接本机 Codex'} <span>↗</span></button><button class="secondary-button" id="keep-demo">继续体验演示</button></div>`);
  $('#keep-demo').onclick = () => { $('#modal').close(); setMode('demo'); };
  $('#connect-codex').onclick = async () => {
    const button = $('#connect-codex'); button.disabled = true; button.textContent = '正在连接…';
    try { const connection = await post('/api/connect', {}); state.connection = connection; if (connection.connected) { $('#modal').close(); setMode('live'); toast('Codex 已连接，可以交给团队真实任务了'); } else { showSettings(); toast(connection.label); } }
    catch (e) { toast(e.message); button.disabled = false; button.textContent = '重试连接 ↗'; }
  };
}
function showApproval(approval) {
  modal(`${agent(approval.agent)?.name} 请求操作批准`, `<p>请检查以下具体操作。批准仅针对本次请求。</p><pre>${esc(JSON.stringify(approval.params, null, 2))}</pre><div class="modal-actions"><button class="primary-button" id="approve-action">批准本次操作</button><button class="secondary-button" id="decline-action">拒绝</button></div>`);
  for (const [id, decision] of [['approve-action', 'accept'], ['decline-action', 'decline']]) $(`#${id}`).onclick = async () => {
    try { await post('/api/approval', { id: approval.id, decision }); $('#modal').close(); } catch (e) { toast(e.message); }
  };
}
function clock() { const date = new Date(); $('#clock').textContent = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); $('#date').textContent = date.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' }).replace('日', '日 · '); }
clock(); setInterval(clock, 30000);
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('selected', x === b)); setTab(b.dataset.view === 'tasks' ? 'tasks' : b.dataset.view === 'team' ? 'profile' : 'feed'); });
$('#settings').onclick = showSettings;
$('#demo-mode').onclick = () => setMode('demo'); $('#live-mode').onclick = () => setMode('live');
$('#modal-close').onclick = () => $('#modal').close();
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) { const box = $('#modal').getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) $('#modal').close(); } });
$('#about').onclick = () => modal('一个会工作的 3D 工作室', '<p>Stark Agency 把 AI 的工作变成可以看见的协作：七位伙伴，有自己的职责，也共享一个目标。</p><p>生活动画由本地规则驱动，不消耗模型调用。演示模式提供明确标注的示例流程；Codex 模式会执行真实工作，并记录工具活动、回复和产物。</p><p>当前版本支持 Vision → Friday → Ultron → Friday → Vision 的任务流程，以及七个角色各自的真实对话。任务与对话保存在本机；关闭服务后正在执行的任务会中断。</p><p>办公室采用立体模型、柔和光影与避障寻路。拖动可以旋转场景，滚轮或双指可以缩放。选中伙伴后点击地面或家具，可以安排走动、阅读和喝咖啡；也可以召集大家到讨论桌。角色参考 VisionQuest 的 AI 人格化主题。</p>');
document.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => { $('#task-input').value = b.dataset.prompt; $('#task-input').focus(); });
$('#task-form').addEventListener('submit', async e => {
  e.preventDefault(); const title = $('#task-input').value.trim(); if (!title) { $('#task-input').focus(); return; }
  $('#submit-task').disabled = true;
  try { await post('/api/tasks', { title, mode }); $('#task-input').value = ''; streamText.clear(); setTab('tasks'); scene.say('vision', mode === 'demo' ? '开始一次协作演示。' : '收到，我们一起把它完成。'); }
  catch (e) { toast(e.message); $('#submit-task').disabled = false; }
});
$('#life-toggle').onclick = () => { scene.setPaused(!scene.paused); $('#life-toggle').textContent = scene.paused ? '▷ 继续生活' : 'Ⅱ 暂停生活'; $('#life-toggle').setAttribute('aria-pressed', scene.paused); toast(scene.paused ? '生活动画已暂停，后台任务继续运行' : '伙伴们继续活动'); };
$('#zoom-in').onclick = () => { $('#zoom-value').textContent = `${scene.setZoom(scene.zoom + .2)}%`; };
$('#zoom-out').onclick = () => { $('#zoom-value').textContent = `${scene.setZoom(scene.zoom - .2)}%`; };
async function init() {
  state = await fetch('/api/state').then(r => { if (!r.ok) throw new Error('办公室服务不可用'); return r.json(); });
  scene = new OfficeScene(state.agents, select, (id, text) => { ambient.push({ id: crypto.randomUUID(), agent: id, text, mode: 'life', time: Date.now() }); ambient = ambient.slice(-15); if (tab === 'feed') renderPanel(); });
  scene.setSelected(selected); renderState();
  if (scene.paused) { $('#life-toggle').textContent = '▷ 继续生活'; $('#life-toggle').setAttribute('aria-pressed', 'true'); }
  const events = new EventSource('/api/events');
  events.onmessage = e => {
    const event = JSON.parse(e.data);
    if (event.type === 'state') { state = event.state; renderState(); }
    if (event.type === 'activity') { state.activity.push(event.item); scene.say(event.item.agent, event.item.text); if (tab === 'feed') renderPanel(); }
    if (event.type === 'message') {
      state.messages.push(event.item); streamText.delete(event.item.agent);
      if (event.item.direct && event.item.from !== 'user') busyChat.delete(event.item.agent);
      if (event.item.from !== 'user') scene.say(event.item.agent, event.item.text);
      if (tab === 'feed' || (tab === 'profile' && event.item.agent === selected)) renderPanel();
    }
    if (event.type === 'delta') { streamText.set(event.agent, ((streamText.get(event.agent) || '') + event.delta).slice(-20000)); if ((tab === 'profile' && selected === event.agent) || tab === 'feed') scheduleStreamRender(); }
  };
  events.onerror = () => { $('#office-status').textContent = '正在重新连接办公室服务…'; };
}
let streamTimer;
function scheduleStreamRender() { if (!streamTimer) streamTimer = setTimeout(() => { streamTimer = null; if (tab === 'profile') renderChat(); else renderPanel(); }, 160); }
init().catch(e => { toast(e.message); $('#office-status').textContent = '服务连接失败，请刷新重试'; });

// Optional desktop bridge; the browser version uses the same renderer.
if (window.starkDesktop) {
  window.starkDesktop.getInfo().then(info => {
    const footer = document.querySelector('.page-footer > span:last-child');
    if (footer) footer.textContent = `Stark Agency · v${info.version} 桌面版`;
  }).catch(error => console.error('读取桌面信息失败', error));
}
