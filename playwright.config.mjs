import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:14311', viewport: { width: 1440, height: 1050 },
    launchOptions: { ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'node tests/browser-server.mjs', url: 'http://127.0.0.1:14311', reuseExistingServer: false }
});
