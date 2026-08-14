import { defineConfig } from '@playwright/test'

/**
 * Desktop browser smoke suite — Engineering Architecture handoff
 * (run-1786721843348-gs3s56, node n-agent-1786467989610-pquv).
 *
 * This config is deliberately NOT discovered by Vitest: specs live under
 * `tests/browser/specs/**` and are named `*.desktop.ts`, which matches
 * neither Vitest's default `**\/*.{test,spec}.?(c|m)[jt]s?(x)` include nor
 * `vitest.config.ts`'s explicit excludes (belt-and-braces, see there too).
 * It is also outside the single `tsconfig.json`'s `include` array, so
 * `tsc -b` (typecheck/build) never sees this directory.
 *
 * The server is never started by Playwright itself — `run-desktop-smoke.mjs`
 * owns the full build → serve → provenance-verify lifecycle and passes the
 * live, provenance-checked URL in via `A3_BASE_URL`. Starting our own server
 * here would reintroduce exactly the "stale/foreign runtime" risk the
 * runner exists to eliminate.
 */
const width = Number(process.env.A3_VIEWPORT_WIDTH ?? 1440)
const height = Number(process.env.A3_VIEWPORT_HEIGHT ?? 900)
const baseURL = process.env.A3_BASE_URL

if (!baseURL) {
  throw new Error(
    'A3_BASE_URL is required. This config must be launched by ' +
    'tests/browser/run-desktop-smoke.mjs, which owns candidate provenance ' +
    '— it must never be invoked directly against an unverified server.',
  )
}

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.desktop.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../.artifacts/browser-desktop/html', open: 'never' }],
    ['json', { outputFile: '../../.artifacts/browser-desktop/report.json' }],
  ],
  outputDir: '../../.artifacts/browser-desktop/test-results',
  use: {
    baseURL,
    viewport: { width, height },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // No storageState: every test run gets a fresh, empty browser context.
    // The app persists proposal state to localStorage on every store
    // transition (all3.proposal.v1.DEMO-0001) and restores it before mount
    // — a carried-over profile would silently change the entry screen
    // (Architecture handoff F6 / C3).
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
