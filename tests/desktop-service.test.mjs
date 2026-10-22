import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startOfficeServer } from '../src/backend/server.mjs';

test('desktop service allocates its own port and authenticates API and static requests', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'stark-desktop-service-'));
  let office;
  try {
    office = await startOfficeServer({ port: 0, dataDir, sessionToken: 'test-session' });
    assert.match(office.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal((await fetch(office.url + '/api/state')).status, 403);
    assert.equal((await fetch(office.url + '/', { headers: { Cookie: 'stark_session=wrong' } })).status, 403);
    const headers = { Cookie: 'stark_session=test-session' };
    const response = await fetch(office.url, { headers });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self' 'sha256-/);
    assert.match(await response.text(), /Stark Agency/);
    const state = await fetch(office.url + '/api/state', { headers }).then(r => r.json());
    assert.equal(state.agents.length, 7);
    const foreign = await fetch(office.url + '/api/tasks', {
      method: 'POST', headers: { ...headers, Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'must not run', mode: 'demo' }),
    });
    assert.equal(foreign.status, 403);
    await office.close();
    await office.close();
    await assert.rejects(fetch(office.url + '/api/state'));
  } finally {
    await office?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
