import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';

// JSON-RPC over the official Codex app-server stdio transport.
export class CodexBridge extends EventEmitter {
  constructor({ command = process.env.CODEX_BIN || 'codex' } = {}) {
    super(); this.command = command; this.pending = new Map(); this.nextId = 1; this.child = null;
  }
  async connect() {
    if (this.ready) return this.ready;
    this.ready = this.initialize().catch(error => { this.ready = null; throw error; });
    return this.ready;
  }
  async initialize() {
    this.child = spawn(this.command, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stderr.on('data', () => {});
    createInterface({ input: this.child.stdout }).on('line', line => {
      let message; try { message = JSON.parse(line); } catch { return; }
      this.receive(message);
    });
    this.child.on('error', error => this.disconnected(error));
    this.child.on('exit', () => this.disconnected(new Error('Codex 连接已关闭')));
    const info = await this.request('initialize', { clientInfo: { name: 'stark_agency', title: 'Stark Agency', version: '0.1.0' }, capabilities: { experimentalApi: true } });
    this.send({ method: 'initialized' });
    return info;
  }
  receive(message) {
    if (message.method) {
      this.emit(message.id != null ? 'approval' : 'notification', message);
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  }
  disconnected(error) {
    this.child = null; this.ready = null;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear(); this.emit('disconnect', error);
  }
  send(message) {
    if (!this.child?.stdin.writable) throw new Error('Codex 未连接');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} 请求超时`)); }, 45000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }
  close() { this.child?.kill(); }
}
