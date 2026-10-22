#!/usr/bin/env node
// Local protocol fixture: never calls a model or accesses user credentials.
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const threads = new Map(); let next = 0;
createInterface({ input: process.stdin }).on('line', async line => {
  const m = JSON.parse(line); if (m.id == null) return;
  const respond = result => send({ id: m.id, result });
  if (m.method === 'initialize') return respond({ userAgent: 'fixture' });
  if (m.method === 'account/read') return respond({ account: { type: 'chatgpt' } });
  if (m.method === 'thread/start') { const id = `fixture-thread-${++next}`; threads.set(id, m.params); return respond({ thread: { id } }); }
  if (m.method === 'thread/resume') return respond({ thread: { id: m.params.threadId } });
  if (m.method === 'turn/start') {
    const threadId = m.params.threadId, turnId = `fixture-turn-${++next}`;
    respond({ turn: { id: turnId } });
    setTimeout(async () => {
      const thread = threads.get(threadId);
      if (thread?.developerInstructions.startsWith('你是 Stark Agency 像素办公室的 Friday（')) await writeFile(path.join(thread.cwd, 'fixture-result.md'), '# Fixture output\n');
      const params = { threadId, turnId };
      send({ method: 'item/agentMessage/delta', params: { ...params, delta: '协议验证成功。' } });
      send({ method: 'item/completed', params: { ...params, item: { type: 'agentMessage', phase: 'commentary', text: '正在检查当前目录。' } } });
      const text = m.params.outputSchema ? JSON.stringify({ status: m.params.input[0].text.includes('NEEDS_INPUT_FIXTURE') ? 'needs_input' : 'completed', summary: '协议验证成功。' }) : '协议验证成功。';
      send({ method: 'item/completed', params: { ...params, item: { type: 'agentMessage', phase: 'final_answer', text } } });
      send({ method: 'turn/completed', params: { ...params, turn: { id: turnId, status: 'completed' } } });
    }, 30);
    return;
  }
  if (m.method === 'turn/interrupt') return respond({});
  send({ id: m.id, error: { code: -32601, message: 'Unsupported fixture method' } });
});
