import { test as base, expect } from '@playwright/test'

/**
 * Shared "no fatal runtime error" fixture (smoke coverage item 7).
 *
 * Every spec in this suite imports `test`/`expect` from here instead of
 * `@playwright/test` directly, so console/page errors fail the test even if
 * the spec's own assertions all pass. `console.warn` is recorded but does
 * NOT fail the run — the Visuelt Pro runtime font-load check
 * (`document.fonts.check(...)`) warns by design (CLAUDE.md rule 3), and
 * treating warnings as fatal would make that intentional diagnostic a
 * permanent red herring.
 */
export const test = base.extend<{ failOnRuntimeErrors: void }>({
  failOnRuntimeErrors: [async ({ page }, use) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []

    page.on('pageerror', (error) => {
      pageErrors.push(error.stack ?? error.message)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await use()

    expect(pageErrors, 'uncaught page error(s) during the scenario').toEqual([])
    expect(consoleErrors, 'console.error call(s) during the scenario').toEqual([])
  }, { auto: true }],
})

export { expect }
