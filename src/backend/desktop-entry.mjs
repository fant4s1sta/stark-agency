import { startOfficeServer } from './server.mjs';

// Electron supplies a MessagePort to utility processes, separate from stdout.
const parent = process.parentPort;
if (!parent || !process.env.OFFICE_SESSION_TOKEN) throw new Error('Desktop launcher required');

try {
  const office = await startOfficeServer({ port: 0, sessionToken: process.env.OFFICE_SESSION_TOKEN });
  parent.on('message', async ({ data }) => {
    if (data?.type !== 'shutdown') return;
    try { await office.close(); process.exit(0); }
    catch (error) { console.error(error); process.exit(1); }
  });
  parent.postMessage({ type: 'ready', url: office.url });
} catch (error) {
  parent.postMessage({ type: 'error', message: error.message });
  process.exit(1);
}
