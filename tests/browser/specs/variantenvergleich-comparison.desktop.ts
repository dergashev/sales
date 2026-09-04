import { test, expect } from '../fixtures'
import {
  COMPARISON, DEMO_PROJECT_TITLE, KONFIGURATOR_GATE, NAV, OPPORTUNITY,
} from '../anchors'
import { saveBuildingScope } from '../journey'

/**
 * Variantenvergleich sticky-column occlusion regression.
 *
 * Release & Pipeline Tooling Fixes ticket: the R2 P1 comparison defect
 * involved blank / falsely "0 €" / truncated money values at horizontally
 * scrolled positions — the sticky first (row-label) column visually paints
 * an opaque box over whatever scrolled content sits under its own
 * footprint, and at a resting position where a column's LEFT portion (and,
 * sometimes, its whole right-aligned money text) fell under that footprint,
 * the value was erased on screen while `textContent`/`aria-label` stayed
 * correct — a purely visual defect no DOM assertion alone can catch.
 *
 * The shipped fix (design-system/components.css, "Frontend rework round 3")
 * is CSS `scroll-snap-type: x mandatory` on `.a3-comparison-scroll` with
 * `scroll-snap-align: end` on every option column header — every scroll
 * gesture (both nav buttons, wheel, drag) is forced to come to rest with
 * SOME column's right edge flush against the scrollport's right edge,
 * which keeps that column's right-aligned money text clear of the sticky
 * column's left-edge footprint. There is therefore no reachable arbitrary
 * `scrollLeft` (including 0) — only per-column snap positions — and this
 * spec asserts accordingly: it never asserts an exact `scrollLeft`, only
 * that the position has settled, then checks per-column exposure at
 * whatever position each real interaction actually lands on.
 *
 * Occlusion evidence is the ticket's "minimum acceptable" tier
 * (bounding-box + elementsFromPoint), not a screenshot diff: for a money
 * cell whose bounding box has scrolled clear of the sticky column (its
 * left edge is at/after the sticky column's right edge) this spec asserts:
 *   (a) geometric — `elementFromPoint` at the cell's own text midpoint
 *       resolves inside that cell, i.e. nothing else paints over it;
 *   (b) value fidelity — its rendered text is byte-identical to the text
 *       captured once as a baseline (via `textContent`, which is scroll-
 *       position-independent and therefore unaffected by the occlusion
 *       bug itself — exactly the DOM-is-correct/paint-is-wrong split the
 *       original defect exploited).
 * A value that goes blank, becomes a false "0 €", or gets truncated under
 * scroll fails (b); a value actually hidden under the sticky column but
 * wrongly asserted "exposed" fails (a). By the end of the scenario every
 * one of the four option columns must have been confirmed this way at
 * least once via the real interaction paths below — the test fails if the
 * table never actually required scrolling to expose all four (which would
 * make the regression guard vacuous).
 *
 * Interaction paths exercised (never only programmatic `scrollLeft`):
 * the real "Zum Zeilenende" button, a real wheel/trackpad-equivalent
 * gesture, and the real "Zum Zeilenanfang" button.
 */

const VIEWPORTS = [
  { label: '1440x900', viewport: { width: 1440, height: 900 } },
  { label: '1280x800', viewport: { width: 1280, height: 800 } },
] as const

const MOTION_STATES = [
  { label: 'normal motion', reducedMotion: 'no-preference' as const },
  { label: 'reduced motion', reducedMotion: 'reduce' as const },
]

const OPTION_COUNT = 4

for (const { label: viewportLabel, viewport } of VIEWPORTS) {
  for (const { label: motionLabel, reducedMotion } of MOTION_STATES) {
    test.describe(`Variantenvergleich comparison — ${viewportLabel}, ${motionLabel}`, () => {
      test.use({ viewport, reducedMotion })

      test('every option total stays visible, unoccluded and value-correct across both nav controls and a wheel gesture', async ({ page }) => {
        await page.goto('/')

        // ── Project list -> analysis -> readiness gate ───────────────
        //    VR3-01: the way to an open readiness gate is the journey.
        //    This spec creates several Options from that gate, so it walks
        //    the project half once and then stays on the project level.
        await page.getByRole('button', {
          name: OPPORTUNITY.configureCta(DEMO_PROJECT_TITLE),
        }).click()
        await page.getByRole('button', { name: OPPORTUNITY.startAnalysis }).click()
        await expect(
          page.getByRole('button', { name: OPPORTUNITY.createOption, exact: true }),
        ).toBeVisible({ timeout: 30_000 })

        // ── Create OPTION_COUNT real, independently-computed Options.
        //    Each gets a T0-fallback-derived config/projection immediately
        //    on creation (store.ts createOption -> defaultOptionConfig) —
        //    this regression targets RENDERING, not calculation, so no
        //    Building/Configurator walkthrough is needed for any of them. ─
        // `exact: true`: the workflow spine's own step 3 is also called
        // "Option anlegen" (its full accessible name carries the position
        // and state, "… Schritt 3 von 13 · aktueller Schritt"), and
        // Playwright's role-name match is substring by default.
        const createOption = page.getByRole('button', {
          name: OPPORTUNITY.createOption, exact: true,
        })
        const optionsRegion = page.getByRole('region', { name: 'Opportunity Options' })
        const openButtons = optionsRegion.getByRole('button', { name: OPPORTUNITY.openOption, exact: true })
        for (let i = 0; i < OPTION_COUNT; i++) {
          await expect(createOption).toBeEnabled()
          // OpportunityCard.tsx debounces rapid creation with a 500ms
          // guard (OPTION_CREATE_GUARD_MS, AUD-03 rapid-click protection) —
          // a click inside that window is a deliberate no-op, not a
          // failure. Retry the click itself (not just the assertion) until
          // one lands outside the guard window.
          await expect(async () => {
            await createOption.click()
            await expect(openButtons).toHaveCount(i + 1, { timeout: 200 })
          }).toPass({ timeout: 10_000 })
        }

        // ── Open the last-created Option. The pipeline-view gate
        //    (pipelineViewForBuildingGate) redirects ANY requested view —
        //    including Variantenvergleich — back to Building & Scope until
        //    the ACTIVE option's building is confirmed; the other three
        //    Options keep whatever config/projection they got at creation
        //    regardless (comparison reads per-option stored config, not the
        //    active editing gate), so only this one needs confirming. ────
        await openButtons.last().click()
        // VR3-02: the gate is the SAVED building scope, so the active
        // Option's baseline is confirmed and saved here — the same walk
        // `tests/browser/journey.ts` performs, on whichever buildings this
        // Option inherited.
        await saveBuildingScope(page)
        // Entering Leistungsabgrenzung is the transition that starts pricing;
        // this spec's subject is the comparison of priced Options.
        await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
        // DC-29's undo toast (8s, bottom-anchored) can visually overlap the
        // comparison table at narrower viewports and silently swallow the
        // wheel gesture below (it, not the scroll region, sits under the
        // pointer). Dismiss it explicitly rather than depending on timing.
        const undoToastClose = page.getByRole('button', { name: 'Schließen' })
        if (await undoToastClose.isVisible().catch(() => false)) await undoToastClose.click()
        await expect(page.getByRole('button', { name: NAV.items.vergleich })).toBeVisible()
        await page.getByRole('button', { name: NAV.items.vergleich }).click()

        // ACCEPTANCE REMEDIATION (cycle 2, ACCEPT-01): the H1 is now the
        // approved target's decision headline, not the nav label.
        await expect(page.getByRole('heading', { name: COMPARISON.headline })).toBeVisible()

        const scrollRegion = page.getByRole('region', { name: 'Horizontal scrollbarer Variantenvergleich' })
        await expect(scrollRegion).toBeVisible()
        const table = scrollRegion.locator('table.a3-cmp')
        // VR2-05: the total (+ its delta) now lives in the column HEADER,
        // directly under Option identity (DC-11 anatomy: `columnHeader →
        // cell → value.numeric → delta`) — one coherent price/consequence
        // scan path instead of a duplicate first body row. The sticky
        // first-column occlusion mechanism this spec guards against is
        // identical in `<thead>` (the SAME `.a3-comparison-scroll` sticky
        // rule applies to every row, header included — see
        // components.css:`.a3-comparison-scroll .a3-cmp tr:not(.a3-comparison-group)>:first-child`),
        // so this remains the same regression guard, just re-targeted to
        // where the money value actually renders now. `.a3-cmp-price` is a
        // stable selector hook (S4Vergleich.tsx) for exactly this value.
        const headerRow = table.locator('thead tr').first()
        const moneyCells = headerRow.locator('th.a3-num .a3-cmp-price')
        await expect(moneyCells).toHaveCount(OPTION_COUNT)
        const stickyCell = headerRow.locator(':scope > :first-child')

        async function readScrollLeft() {
          return scrollRegion.evaluate((el) => el.scrollLeft)
        }

        /** Waits for `scroll-snap` (native browser snap animation, or the
         *  app's own `scrollTo({behavior:'smooth'|'auto'})`) to finish
         *  settling: two consecutive reads 100ms apart must agree. There is
         *  no fixed target to assert (mandatory scroll-snap overrides any
         *  requested `scrollLeft`, including this app's own `0`/`scrollWidth`
         *  requests, to the nearest valid per-column snap point). */
        async function waitForScrollSettled(message: string) {
          let previous = await readScrollLeft()
          await expect.poll(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100))
            const current = await readScrollLeft()
            const settled = current === previous
            previous = current
            return settled
          }, { message, timeout: 5_000 }).toBe(true)
        }

        // ── Baseline: DOM text content is independent of scroll position
        //    (that independence is exactly what made the original defect a
        //    purely visual one) — capture each column's true value up
        //    front, with no scroll interaction at all. ────────────────────
        const baseline: string[] = []
        for (let i = 0; i < OPTION_COUNT; i++) {
          const text = (await moneyCells.nth(i).textContent())?.trim() ?? ''
          expect(text, `column ${i} baseline value must not be blank`).not.toBe('')
          baseline.push(text)
        }

        const confirmedExposed = new Set<number>()

        // Each option column is wider (420px, `--measure-band`) than the
        // scrollport itself can be at some viewports once combined with the
        // sticky label column's own width (220px, `--measure-conflict-column`)
        // — by design (see the "scroll-snap-type:x mandatory" CSS comment on
        // the comparison scroll container): only the RIGHT-ALIGNED MONEY
        // TEXT is guaranteed clear, never necessarily the whole padded
        // `<th>` box (Option name/badges/chips above it may sit under the
        // sticky footprint at a snapped position). `.a3-cmp-price` is its
        // OWN dedicated `<span>` containing nothing but the money text
        // (S4Vergleich.tsx — `moneyLabel(...)` is a plain string, no nested
        // markup), so its element bounding box IS the money text's box —
        // no text-node `Range` extraction needed (that was only required
        // for the old body `<td>` cell, which mixed a leading text node
        // with a trailing `.a3-d` delta sibling in the SAME node).
        async function textBoundingBox(cell: ReturnType<typeof moneyCells.nth>) {
          const box = await cell.boundingBox()
          if (!box || (box.width === 0 && box.height === 0)) return null
          return box
        }

        async function assertExposedColumnsMatchBaseline(checkpoint: string) {
          const stickyBox = await stickyCell.boundingBox()
          expect(stickyBox, `${checkpoint}: sticky column must have a bounding box`).not.toBeNull()
          const stickyRightEdge = stickyBox!.x + stickyBox!.width
          // The scroll REGION's own box, not the full page viewport, is
          // what actually clips visibility (`overflow-x:auto` on a
          // narrower-than-viewport middle column) — the surrounding page
          // layout (sidebar, calculation rail) is not part of this
          // regression and must not be misread as "exposed".
          const regionBox = (await scrollRegion.boundingBox())!

          for (let i = 0; i < OPTION_COUNT; i++) {
            const cell = moneyCells.nth(i)
            const textBox = await textBoundingBox(cell)
            if (!textBox) continue // detached/not rendered — nothing to claim here
            const withinScrollport = textBox.x >= regionBox.x - 1 && textBox.x + textBox.width <= regionBox.x + regionBox.width + 1
            const clearOfSticky = textBox.x >= stickyRightEdge - 1 // 1px rounding tolerance
            if (!withinScrollport || !clearOfSticky) continue // not claimed "exposed" at this checkpoint

            // (a) geometric occlusion evidence: nothing else paints over
            // the money TEXT's own midpoint (the sticky column, or
            // anything else, must not be the actual topmost element there).
            const centerX = textBox.x + textBox.width / 2
            const centerY = textBox.y + textBox.height / 2
            const isTopmost = await cell.evaluate((el, [x, y]) => {
              const hit = document.elementFromPoint(x, y)
              return hit !== null && (hit === el || el.contains(hit))
            }, [centerX, centerY] as const)
            expect(isTopmost, `${checkpoint}: column ${i} claimed exposed (text x=${textBox.x} >= sticky right edge ${stickyRightEdge}) but something else paints over its value's center point — occluded`).toBe(true)

            // (b) value fidelity: identical to the scroll-independent
            // baseline — catches blank / false "0 €" / truncation under scroll.
            const text = (await cell.textContent())?.trim() ?? ''
            expect(text, `${checkpoint}: column ${i} exposed but blank`).not.toBe('')
            expect(text, `${checkpoint}: column ${i} exposed value must match its baseline (no false blank/0/truncation)`).toBe(baseline[i])

            confirmedExposed.add(i)
          }
        }

        // ── Interaction path 1: the real "Zum Zeilenanfang" control ──────
        await page.getByRole('button', { name: 'Zum Zeilenanfang' }).click()
        await waitForScrollSettled('scroll must settle (snap) after "Zum Zeilenanfang"')
        const startPos = await readScrollLeft()
        await assertExposedColumnsMatchBaseline('after "Zum Zeilenanfang" (start)')

        // ── Interaction path 2: the real "Zum Zeilenende" control ────────
        await page.getByRole('button', { name: 'Zum Zeilenende' }).click()
        await waitForScrollSettled('scroll must settle (snap) after "Zum Zeilenende"')
        const endPos = await readScrollLeft()
        expect(endPos, '"Zum Zeilenende" must land on a genuinely different snap position than "Zum Zeilenanfang"').toBeGreaterThan(startPos)
        await assertExposedColumnsMatchBaseline('after "Zum Zeilenende" (end)')

        // The full-width Compare Shell shows three complete option columns
        // at 1440px, so its valid snap range has only start/end positions.
        // At 1280px it shows two and exposes one real intermediate snap.
        // Derive the count from the rendered option width instead of
        // assuming one snap per option at every viewport.
        const optionBox = await moneyCells.first().boundingBox()
        expect(optionBox, 'option cells must have a bounding box for snap validation').not.toBeNull()
        const snapPositionCount = Math.max(2, Math.round((endPos - startPos) / optionBox!.width) + 1)
        const intermediateSnapCount = Math.max(0, snapPositionCount - 2)

        // ── Interaction path 3: real wheel/trackpad-equivalent gestures,
        //    walking back one column-snap at a time from the end so every
        //    intermediate snap position (not just start/end) gets a real,
        //    independent checkpoint — a single arbitrary wheel jump could
        //    skip straight over a middle column entirely and leave the
        //    regression guard silently incomplete for it. ────────────────
        const scrollBox = (await scrollRegion.boundingBox())!
        await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2)
        const stepPx = (endPos - startPos) / (snapPositionCount - 1)
        let previousPos = endPos
        for (let step = 1; step <= intermediateSnapCount; step++) {
          // A single wheel tick close to the exact step distance can land
          // right on (or just short of) the snap midpoint and "rubber-band"
          // back to where it started — real trackpad/wheel scrolling is
          // rarely one discrete tick either. A couple of smaller ticks
          // summing to comfortably more than one column-step reproduces a
          // real gesture and reliably crosses the snap threshold.
          await page.mouse.wheel(-stepPx * 0.7, 0)
          await page.mouse.wheel(-stepPx * 0.7, 0)
          await waitForScrollSettled(`scroll must settle (snap) after wheel step ${step}`)
          const pos = await readScrollLeft()
          expect(pos, `wheel step ${step} must land on a genuinely different snap position than the previous checkpoint`).not.toBe(previousPos)
          previousPos = pos
          await assertExposedColumnsMatchBaseline(`after wheel gesture, step ${step} (intermediate snap position)`)
        }

        // ── The regression guard is only meaningful if scrolling was
        //    actually REQUIRED to expose every column at least once. ────
        expect(
          [...confirmedExposed].sort((a, b) => a - b),
          `all ${OPTION_COUNT} option columns must have been confirmed exposed+correct at some checkpoint — got only ${[...confirmedExposed]}`,
        ).toEqual(Array.from({ length: OPTION_COUNT }, (_, i) => i))
      })
    })
  }
}
