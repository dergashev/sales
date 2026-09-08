import { test, expect, type Page } from '../fixtures'
import {
  BUILDING_SCOPE,
  DEMO_COMPLEX_PROJECT_ID,
  DEMO_COMPLEX_PROJECT_NAME,
  KONFIGURATOR_GATE,
} from '../anchors'
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * B2 · unified Option preparation and decision truth.
 *
 * WHY THESE ASSERTIONS ARE BROWSER ASSERTIONS.
 *
 * Four of this ticket's requirements are GEOMETRIC or paint-level, and jsdom
 * reports every box as zero, so all four passed the unit suite while being
 * wrong on screen:
 *
 * - requirement 11 asks that inclusion be UNMISTAKABLE. "Unmistakable" is a
 *   measurement — of the control's size, of the card's own treatment, and of
 *   whether the state is carried by more than colour.
 * - requirement 12 asks that a blocker stay BESIDE its action at 1440 and
 *   immediately ABOVE it at 1280. That is two viewport-dependent layouts,
 *   and only a layout engine can tell them apart.
 * - requirement 15 asks the secondary progression to stay contiguous at both
 *   widths with no rotated or clipped text.
 * - requirement 1/2 ask that only applicable, explicitly denominated metrics
 *   are shown — which is about what is PAINTED, not only what is in the DOM.
 *
 * The complex project is used throughout: three buildings, mixed use, and
 * therefore the only fixture that can show two segment metrics at once.
 */

const VIEWPORTS = [
  { label: '1440x900', viewport: { width: 1440, height: 900 } },
  { label: '1280x800', viewport: { width: 1280, height: 800 } },
] as const

const BUILDINGS = [
  { mark: 'A', name: 'Kontorhaus' },
  { mark: 'B', name: 'Hofhaus' },
  { mark: 'C', name: 'Stadthaus' },
] as const

const identity = (i: number) =>
  BUILDING_SCOPE.building(BUILDINGS[i]!.mark, BUILDINGS[i]!.name)

/** No document-level horizontal overflow, at any width. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }))
  expect(overflow.doc, 'the document scrolls horizontally').toBeLessThanOrEqual(overflow.win)
}

async function reachComplexScope(page: Page) {
  await page.goto('/')
  await reachOptionWorkspace(page, DEMO_COMPLEX_PROJECT_NAME)
}

for (const { label: viewportLabel, viewport } of VIEWPORTS) {
  test.describe(`B2 · Option preparation — ${viewportLabel}`, () => {
    test.use({ viewport })

    test('building inclusion is unmistakable, keyboard-operable, and never colour alone', async ({ page }) => {
      await reachComplexScope(page)

      // THE CONTROL IS STILL A NATIVE CHECKBOX. Not a styled div, not a
      // switch — the platform's own checked semantics are what assistive
      // technology and forced colours rely on.
      const boxes = page.getByRole('checkbox', { name: /^Im Angebotsumfang führen · / })
      await expect(boxes).toHaveCount(3)

      for (let i = 0; i < 3; i += 1) {
        const box = page.getByRole('checkbox', {
          name: BUILDING_SCOPE.select(identity(i)),
        })
        await expect(box).toBeChecked()
        // Its own hit area is the whole selection row, so the target is the
        // decision rather than a 16 px square (requirement 11).
        const row = await box.evaluate((el) => {
          const label = el.closest('label')!
          const b = label.getBoundingClientRect()
          return { w: Math.round(b.width), h: Math.round(b.height) }
        })
        expect(row.h, 'the selection row is under the 44px target').toBeGreaterThanOrEqual(44)
        expect(row.w).toBeGreaterThan(120)
      }

      // FOUR CARRIERS AGREE, and the state is in WORDS. `Im Angebot` for an
      // included building; the state chip names the baseline's own state.
      const cards = page.locator('.a3-sbc')
      await expect(cards).toHaveCount(3)
      for (let i = 0; i < 3; i += 1) {
        const card = cards.nth(i)
        await expect(card).toHaveAttribute('data-scope-state', /included|confirmed|reviewRequired/)
        await expect(card).toContainText(/Im Angebot/)
      }

      // KEYBOARD: Space on the focused checkbox excludes the building, and
      // the card's own state follows in text.
      const third = page.getByRole('checkbox', { name: BUILDING_SCOPE.select(identity(2)) })
      await third.focus()
      await page.keyboard.press(' ')
      // Removing a building is a risky action and asks first (released
      // contract), so the confirmation is part of the keyboard path.
      const confirmRemoval = page.getByRole('button', { name: 'Aus dem Umfang nehmen' })
      if (await confirmRemoval.count() > 0) await confirmRemoval.first().click()
      await expect(third).not.toBeChecked()
      await expect(cards.nth(2)).toHaveAttribute('data-scope-state', 'excluded')
      await expect(cards.nth(2)).toContainText('Nicht im Angebot')

      await expectNoHorizontalOverflow(page)
    })

    test('zero included buildings blocks Save BESIDE the action, with a named recovery', async ({ page }) => {
      await reachComplexScope(page)

      for (let i = 0; i < 3; i += 1) {
        const box = page.getByRole('checkbox', { name: BUILDING_SCOPE.select(identity(i)) })
        await box.click();
        const confirmRemoval = page.getByRole('button', { name: 'Aus dem Umfang nehmen' })
        if (await confirmRemoval.count() > 0) await confirmRemoval.first().click()
      }

      const save = page.getByRole('button', { name: BUILDING_SCOPE.save })
      await expect(save).toHaveAttribute('aria-disabled', 'true')

      // The target's own words, and a ROUTE — the released build had the
      // sentence and nowhere to go.
      const gate = page.locator('.a3-gate')
      await expect(gate).toContainText('Mindestens ein Gebäude aufnehmen')
      const recovery = gate.getByRole('button', { name: 'Zur Gebäudeauswahl' })
      await expect(recovery).toBeVisible()

      // BESIDE the action at both widths: the gate and the button it
      // explains are in one composition, and the reason is on screen at the
      // moment the action is refused — which is exactly what the audit found
      // missing (both sat below the initial viewport).
      const geometry = await page.evaluate(() => {
        const g = document.querySelector('.a3-gate') as HTMLElement
        const b = g.getBoundingClientRect()
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }
      })
      expect(geometry.h, 'the gate is not rendered').toBeGreaterThan(0)

      // The recovery actually reaches the selection.
      await recovery.click()
      await expect(page.getByRole('checkbox', {
        name: BUILDING_SCOPE.select(identity(0)),
      })).toBeFocused()

      await expectNoHorizontalOverflow(page)
    })

    test('the Option summary states both segment metrics, each under its own norm', async ({ page }) => {
      await reachComplexScope(page)
      await saveBuildingScope(page)
      await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()

      // Put the six cost groups in scope so a price exists to divide.
      for (let pass = 0; pass < 8; pass += 1) {
        const index = await page.evaluate(() => {
          const radios = [...document.querySelectorAll('main input[type=radio]')]
          return radios.findIndex((r) => !(r as HTMLInputElement).checked
            && !(r as HTMLInputElement).disabled
            && /^\s*enthalten/.test((r.closest('label')?.textContent ?? '').replace(/^✓/, '')))
        })
        if (index < 0) break
        await page.locator('main input[type=radio]').nth(index)
          .locator('xpath=ancestor::label[1]').click()
      }

      const rail = page.locator('aside.a3-cockpit')
      await expect(rail).toBeVisible()

      // BOTH segment metrics, each naming its norm. This is the mixed-use
      // case the audit measured as absent everywhere.
      const wfl = rail.locator('[data-metric="wfl"]')
      const nuf = rail.locator('[data-metric="nuf"]')
      await expect(wfl).toContainText('WFL nach WoFlV')
      await expect(nuf).toContainText('NUF nach DIN 277')

      // NO BARE `€/m²`: every rate on screen is followed by its norm.
      const rates = await rail.evaluate((el) => [...el.querySelectorAll('[data-metric]')]
        .map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))
      expect(rates.length).toBeGreaterThanOrEqual(2)
      for (const rate of rates) {
        expect(rate, `a rate without its denominator: ${rate}`)
          .toMatch(/€\/m².*(WFL nach WoFlV|NUF nach DIN 277|BGF oberirdisch)/)
      }

      // …and NO blended denominator anywhere: `Σ WFL + Σ NUF` for Leipzig
      // would be 12.310 m², a number this Product must never publish.
      await expect(rail).not.toContainText('12.310')

      await expectNoHorizontalOverflow(page)
    })

    test('Scope decisions owns the three axes, and an unreachable certificate names its enabling action', async ({ page }) => {
      await reachComplexScope(page)
      await saveBuildingScope(page)
      await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()

      // All three axes, on the screen where they are DECIDED (requirement 14).
      await expect(page.getByRole('radiogroup', { name: 'Energieziel' })).toBeVisible()
      const qng = page.getByRole('radiogroup', { name: 'QNG-Siegel' })
      await expect(qng).toBeVisible()
      await expect(page.getByRole('radiogroup', { name: 'DGNB-Zertifikat' })).toBeVisible()

      // An unavailable choice carries its reason AND the action that enables
      // it — never a greyed-out control alone (rule 12).
      const plus = qng.getByRole('radio', { name: /QNG-PLUS/ })
      await expect(plus).toBeDisabled()
      const axis = page.locator('.a3-axis', { has: qng })
      await expect(axis).toContainText(/setzt Energieziel/i)
      const enable = page.getByRole('button', { name: /Energieziel auf .* setzen/ })
      await expect(enable).toBeVisible()
      await enable.click()
      await expect(qng.getByRole('radio', { name: /QNG-PLUS/ })).toBeEnabled()

      await expectNoHorizontalOverflow(page)
    })

    test('one secondary progression, contiguous, with All cost details inside Calculate', async ({ page }) => {
      await reachComplexScope(page)
      await saveBuildingScope(page)
      await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
      for (let pass = 0; pass < 8; pass += 1) {
        const index = await page.evaluate(() => {
          const radios = [...document.querySelectorAll('main input[type=radio]')]
          return radios.findIndex((r) => !(r as HTMLInputElement).checked
            && !(r as HTMLInputElement).disabled
            && /^\s*enthalten/.test((r.closest('label')?.textContent ?? '').replace(/^✓/, '')))
        })
        if (index < 0) break
        await page.locator('main input[type=radio]').nth(index)
          .locator('xpath=ancestor::label[1]').click()
      }
      await page.goto(`/projekt/${DEMO_COMPLEX_PROJECT_ID}/option/OPT-01/kalkulieren/kg300`)

      const progression = page.getByRole('list', { name: /· Kapitel$/ })
      await expect(progression).toBeVisible()
      const segments = progression.getByRole('listitem')
      // Nine members in the canonical order, All cost details among them.
      await expect(segments).toHaveCount(9)
      await expect(progression).toContainText('Kostendetails')

      // CONTIGUOUS and unrotated at both widths: every segment shares one
      // row, and no label is rotated or collapsed vertically.
      const layout = await progression.evaluate((el) => {
        const items = [...el.querySelectorAll('li')]
        return items.map((li) => {
          const b = li.getBoundingClientRect()
          const label = li.querySelector('.a3-wfn-seglabel') as HTMLElement | null
          const cs = label ? getComputedStyle(label) : null
          return {
            top: Math.round(b.top),
            h: Math.round(b.height),
            transform: cs?.transform ?? 'none',
            writingMode: cs?.writingMode ?? '',
          }
        })
      })
      const tops = new Set(layout.map((l) => l.top))
      expect(tops.size, 'the progression is not one contiguous row').toBe(1)
      for (const seg of layout) {
        expect(seg.h, 'a segment is under the 44px target').toBeGreaterThanOrEqual(44)
        expect(seg.transform, 'a segment label is rotated').toBe('none')
        expect(seg.writingMode).toMatch(/horizontal/)
      }

      // Opening the cost detail keeps CALCULATE current and its progression
      // on screen — the reported IA defect switched the rail to Configure.
      await progression.getByRole('button', { name: /Alle Kostendetails/ }).click()
      await expect(page).toHaveURL(/\/kalkulieren\/alle-kosten$/)
      const rail = page.getByRole('navigation', { name: /Option/ })
      await expect(rail.getByRole('button', { name: /Kalkulieren/ }))
        .toHaveAttribute('aria-current', 'step')
      await expect(page.getByRole('list', { name: /· Kapitel$/ })).toBeVisible()

      await expectNoHorizontalOverflow(page)
    })
  })
}
