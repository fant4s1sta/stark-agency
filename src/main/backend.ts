import { utilityProcess, type UtilityProcess } from 'electron';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

export interface Backend {
  url: string;
  token: string;
  process: UtilityProcess;
  stop(): Promise<void>;
}

export async function startBackend(appRoot: string, dataDir: string): Promise<Backend> {
  await mkdir(dataDir, { recursive: true });
  const token = randomBytes(32).toString('hex');
  const child = utilityProcess.fork(path.join(appRoot, 'src/backend/desktop-entry.mjs'), [], {
    serviceName: 'Stark Agency Backend',
    // appRoot is an ASAR archive after packaging, not a usable process cwd.
    cwd: dataDir,
    env: { ...process.env, OFFICE_DATA_DIR: dataDir, OFFICE_SESSION_TOKEN: token },
    stdio: 'pipe',
  });
  child.stdout?.on('data', chunk => console.log(String(chunk).trimEnd()));
  child.stderr?.on('data', chunk => console.error(String(chunk).trimEnd()));
  let stopping: Promise<void> | undefined;
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('后台服务启动超时')), 20_000);
      const onExit = (code: number) => finish(new Error(`后台服务启动失败（${code}）`));
      const onMessage = (message: { type?: string; url?: string; message?: string }) => {
        if (message.type === 'error') finish(new Error(message.message || '后台服务启动失败'));
        if (message.type === 'ready' && message.url) {
          try {
            const parsed = new URL(message.url);
            if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port) throw new Error('无效的后台服务地址');
            finish(undefined, parsed.origin);
          } catch (error) { finish(error as Error); }
        }
      };
      function finish(error?: Error, url?: string) {
        clearTimeout(timer);
        child.off('exit', onExit);
        child.off('message', onMessage);
        if (error) reject(error); else resolve(url!);
      }
      child.once('exit', onExit);
      child.on('message', onMessage);
    });
    return {
      url, token, process: child,
      stop() {
        return stopping ||= new Promise<void>(resolve => {
          if (!child.pid) { resolve(); return; }
          const timer = setTimeout(() => { child.kill(); resolve(); }, 5_000);
          child.once('exit', () => { clearTimeout(timer); resolve(); });
          child.postMessage({ type: 'shutdown' });
        });
      },
    };
  } catch (error) { child.kill(); throw error; }
}
