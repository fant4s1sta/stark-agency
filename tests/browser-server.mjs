import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PORT='14311';process.env.OFFICE_DATA_DIR=await mkdtemp(path.join(tmpdir(),'stark-3d-test-'));
await import('../server.mjs');
