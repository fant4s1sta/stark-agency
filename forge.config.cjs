// Forge is the packaging tool recommended in Electron's distribution tutorial.
module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'stark-agency',
    ignore: [
      /^\/\./,
      /^\/(?:\.git|\.runtime|\.agents|\.aws|\.codex|tests|test-results|playwright-report|output|out|docs|scripts)(?:\/|$)/,
      /^\/src\/(?:main|preload)(?:\/|$)/,
      /^\/(?:tsconfig\.json|playwright(?:\.desktop)?\.config\.mjs|forge\.config\.cjs|\.DS_Store)$/,
    ],
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { name: 'stark_agency' } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'linux', 'win32'] },
    { name: '@electron-forge/maker-deb', platforms: ['linux'], config: { options: { categories: ['Development'] } } },
  ],
};
