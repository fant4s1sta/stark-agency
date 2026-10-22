// Standalone web entry; desktop startup is managed by src/main/index.ts.
import { startOfficeServer } from './src/backend/server.mjs';
const office = await startOfficeServer();
console.log(`Stark Agency → ${office.url}`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => office.close().then(() => process.exit(0), error => {
    console.error(error); process.exit(1);
  }));
}
