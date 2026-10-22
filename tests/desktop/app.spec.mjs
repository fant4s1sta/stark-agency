import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('desktop starts its service, isolates Node, blocks external windows and shuts down cleanly', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'stark-desktop-ui-'));
  let application;
  let url;
  try {
    application = await electron.launch({
      ...(process.env.STARK_DESKTOP_EXECUTABLE ? { executablePath: process.env.STARK_DESKTOP_EXECUTABLE } : {}),
      args: [...(process.env.STARK_DESKTOP_EXECUTABLE ? [] : ['.']), `--user-data-dir=${path.join(dataDir, 'electron')}`, ...(process.platform === 'darwin' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
      env: { ...process.env, OFFICE_DATA_DIR: dataDir, DEMO_STEP_MS: '20' },
    });
    const page = await application.firstWindow();
    await expect(page.locator('.page-footer')).toContainText('桌面版');
    await expect(page.locator('#office-game')).toHaveAttribute('data-view', '3d');
    url = page.url();
    expect(new URL(url).hostname).toBe('127.0.0.1');
    expect((await fetch(url + 'api/state')).status).toBe(403);
    expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
    expect(await page.evaluate(() => typeof window.process)).toBe('undefined');
    expect(await page.evaluate(() => Object.keys(window.starkDesktop))).toEqual(['toggleFullscreen', 'onFullscreenChange', 'getInfo']);
    expect((await page.evaluate(() => window.starkDesktop.getInfo())).version).toBe('0.1.0');
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 600));
    await expect.poll(() => page.evaluate(() => {
      const rect = document.querySelector('#game-shell').getBoundingClientRect();
      return Math.abs(rect.width / rect.height - 1.6) < .001 && rect.bottom <= innerHeight + 1;
    })).toBe(true);
    await page.locator('#fullscreen-toggle').click();
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
    await expect(page.locator('#fullscreen-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(1000); // Native macOS Space transition must finish before leaving.
    await page.keyboard.press('Escape');
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false);
    await expect(page.locator('#fullscreen-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#mission-toggle').click();
    await page.locator('#task-input').fill('桌面演示验证');
    await page.locator('#submit-task').click();
    await expect.poll(() => page.evaluate(async () => (await fetch('/api/state').then(r => r.json())).tasks[0]?.status)).toBe('completed');
    await page.evaluate(() => window.open('https://example.com'));
    expect(application.windows()).toHaveLength(1);
    const serviceUrl = url;
    await application.close();
    application = null;
    await expect.poll(async () => {
      try { await fetch(serviceUrl); return false; } catch { return true; }
    }).toBe(true);
  } finally {
    await application?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
