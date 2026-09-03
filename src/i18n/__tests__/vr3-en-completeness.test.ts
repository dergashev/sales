import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { translateText } from '../index'
import manifest from '../../../design-system/assets/projects/manifest.json'

/**
 * VR3-01 — the EN path of the surfaces this ticket owns, checked as a CLASS
 * rather than string by string.
 *
 * QA-01 was one instance of a silent failure mode: `useTx()` is a BRIDGE for
 * German text the generated Codex delivery already carries, not a
 * translator. Hand it a German literal that delivery never had and it
 * returns the German unchanged — no error, no warning, no failing test. The
 * rename control on the Option card shipped that way and only a human
 * switching the language in a browser caught it.
 *
 * So this file does not assert "Umbenennen is translated". It asserts that
 * NO string on these surfaces can reach the EN path untranslated, by three
 * independent routes:
 *
 *   1. every static `tx('…')` literal actually resolves to English;
 *   2. every registered media asset names an alt key that exists in both
 *      dictionaries;
 *   3. every `vr3.*` key the surfaces reference has BOTH a DE and an EN row.
 *
 * The dictionaries are read from source rather than imported, because
 * `de`/`en` are intentionally not exported and the question here is
 * literally "does this file contain a row for this key".
 */

const ROOT = path.resolve(__dirname, '..', '..', '..')

/** Surfaces VR3-01 owns. A new one belongs in this list. */
const OWNED_SURFACES = [
  'src/screens/ProjectHome.tsx',
  'src/screens/ProjectOptions.tsx',
  'src/screens/OpportunityList.tsx',
  'src/design-system/SemanticStatus.tsx',
  'src/design-system/AuthorityTrace.tsx',
  'src/design-system/ProcessingJob.tsx',
  'src/design-system/ActionGate.tsx',
  'src/design-system/ConflictResolver.tsx',
  'src/design-system/QuestionQueue.tsx',
  // VR3-02 — the Option building scope and the Konfigurator gate.
  'src/screens/BuildingScope.tsx',
  'src/screens/KonfiguratorGate.tsx',
  'src/design-system/BuildingScopePanel.tsx',
  'src/components/WorkflowSpine.tsx',
  // VR3-03 — the unified Konfigurator. Every product-owned string on these
  // surfaces is a dictionary key with a DE and an EN row; the KG catalogue's
  // own domain copy is bilingual in the fixture, following the released
  // `scope-catalog.json` precedent for a large domain catalogue.
  'src/screens/Leistungsabgrenzung.tsx',
  'src/screens/KgChapter.tsx',
  'src/design-system/ScopeDecisionLedger.tsx',
  'src/design-system/KGConfiguration.tsx',
  'src/design-system/CommercialRail.tsx',
  'src/design-system/ChoiceGroup.tsx',
  // VR3-04 — the schedule stage, the long review and the explicit save.
  //
  // ADDED IN CYCLE 2, and the reason is worth recording: the cycle-1 change
  // manifest CLAIMED these five surfaces were already listed here. They were
  // not. Every key they reference did have both a DE and an EN row (that was
  // checked by hand), so the substance held — but the machine guard that was
  // said to prove it did not exist, and QA reasonably relied on the claim
  // instead of re-driving a full DE/EN sweep. A guard that is asserted in
  // prose and absent from the suite is worse than an acknowledged gap.
  'src/screens/ScheduleStage.tsx',
  'src/screens/FinalValidation.tsx',
  'src/design-system/ScheduleEditor.tsx',
  'src/design-system/ValidationReview.tsx',
  'src/design-system/SaveReceipt.tsx',
]

function source(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8')
}

/**
 * Comments are prose, not code. `tools/verify.py` masks them before every
 * static scan for the same reason: without this, a docstring that QUOTES a
 * key as an example (this file's own subject does) is reported as a live
 * reference, and a scanner that flags prose is a scanner people learn to
 * ignore. Replaced with spaces rather than removed so line numbers survive.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (line, lead) => lead + ' '.repeat(line.length - lead.length))
}

/**
 * The rows of one dictionary object in `src/i18n/index.ts`, by the same
 * literal shape `tools/check_i18n_ascii.py` relies on: `const de = {` … `}
 * as const`, one `'key': 'value',` per line.
 */
function dictionaryKeys(which: 'de' | 'en'): Set<string> {
  const text = source('src/i18n/index.ts')
  const pattern = which === 'de'
    ? /^const de = \{$([\s\S]*?)^\} as const$/m
    : /^const en: Partial<Record<MessageKey, string>> = \{$([\s\S]*?)^\}$/m
  const block = text.match(pattern)
  expect(block, `the ${which} dictionary must keep its literal declaration shape`)
    .not.toBeNull()
  const keys = new Set<string>()
  const row = /^\s*'([^']+)':/gm
  let match: RegExpExecArray | null
  while ((match = row.exec(block![1]!)) !== null) keys.add(match[1]!)
  return keys
}

/** One dictionary row's value, by the same literal shape. */
function dictionaryRow(which: 'de' | 'en', key: string): string {
  const text = source('src/i18n/index.ts')
  const start = which === 'de'
    ? text.indexOf('const de = {')
    : text.indexOf('const en: Partial<Record<MessageKey, string>> = {')
  expect(start, `the ${which} dictionary must keep its literal declaration shape`)
    .toBeGreaterThan(-1)
  const block = text.slice(start)
  const row = new RegExp(`^\\s*'${key.replace(/\./g, '\\.')}':\\s*'([^']*)',`, 'm')
  const match = block.match(row)
  expect(match, `${which} must carry a row for ${key}`).not.toBeNull()
  return match![1]!
}

/** Static single-quoted or double-quoted arguments to `tx(...)`. */
function staticBridgeLiterals(text: string): string[] {
  const found: string[] = []
  const rx = /\btx\(\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1\s*\)/g
  let match: RegExpExecArray | null
  while ((match = rx.exec(text)) !== null) found.push(match[2]!)
  return found
}

/** `vr3.*` keys referenced anywhere in a surface. */
function referencedVr3Keys(text: string): string[] {
  return [...text.matchAll(/['"`](vr3\.[A-Za-z0-9_.-]+)['"`]/g)].map((m) => m[1]!)
}

describe('VR3-01 · nothing on the owned surfaces can reach EN untranslated', () => {
  it('every static tx() literal resolves to a genuinely English string', () => {
    const unresolved: string[] = []
    for (const surface of OWNED_SURFACES) {
      for (const literal of staticBridgeLiterals(withoutComments(source(surface)))) {
        const english = translateText(literal, 'en')
        if (english === literal) unresolved.push(`${surface}: tx("${literal}")`)
      }
    }
    // `useTx` returns its input unchanged when the delivery has no match —
    // which is exactly how QA-01 shipped. An empty list is the only pass.
    expect(unresolved).toEqual([])
  })

  it('the bridge is only used for text the delivery actually carries', () => {
    // Two dynamic bridge calls exist by design and are named here so a THIRD
    // one cannot appear unnoticed: the engine's own German total label
    // (`panel.netTotalCoreService` / `money.total.incomplete`, both with EN
    // rows in the delivery) and WorkflowStepper's key lookup, whose `tx`
    // is `useT` despite the variable name.
    const dynamic: string[] = []
    for (const surface of [...OWNED_SURFACES, 'src/design-system/WorkflowStepper.tsx']) {
      const text = withoutComments(source(surface))
      for (const match of text.matchAll(/\btx\(\s*([A-Za-z_$][\w$.?[\]]*)\s*\)/g)) {
        dynamic.push(`${surface}: tx(${match[1]})`)
      }
    }
    expect(dynamic.sort()).toEqual([
      'src/design-system/WorkflowStepper.tsx: tx(key)',
      'src/screens/ProjectOptions.tsx: tx(projection.result.totalLabel)',
    ])
  })

  it("the engine's German total labels both bridge to English", () => {
    // The engine composes these in German by contract: a total must name its
    // Declared Pricing Scope (R-18). The UI bridges them.
    expect(translateText('Gesamt netto · Grundleistung All3', 'en'))
      .toBe('Net total · All3 core service')
    expect(translateText('Zwischensumme der kalkulierten Positionen', 'en'))
      .toBe('Subtotal of calculated items')
  })

  it('every registered project asset has an alt key in both dictionaries', () => {
    const de = dictionaryKeys('de')
    const en = dictionaryKeys('en')
    const entries = manifest as Array<{ id: string; altKey?: string }>
    expect(entries.length).toBeGreaterThan(0)
    const missing: string[] = []
    for (const entry of entries) {
      if (!entry.altKey) { missing.push(`${entry.id}: no altKey`); continue }
      if (!de.has(entry.altKey)) missing.push(`${entry.altKey}: no DE row`)
      if (!en.has(entry.altKey)) missing.push(`${entry.altKey}: no EN row`)
    }
    expect(missing).toEqual([])
  })

  it('every journal event this ticket emits names a key with both rows', () => {
    const de = dictionaryKeys('de')
    const en = dictionaryKeys('en')
    const store = withoutComments(source('src/state/store.ts'))
    // Presentation keys the store hands to the DC-29 toast. The toast used
    // to render the journal's German `label` raw, which is how "Opportunity
    // Option «Option 1» angelegt" appeared under an otherwise English
    // screen in this candidate's own evidence capture.
    const keys = [...store.matchAll(/labelKey:\s*(?:\n\s*)?'([^']+)'/g)].map((m) => m[1]!)
    const ternary = [...store.matchAll(/\?\s*'(vr3\.journal\.[^']+)'\s*\n?\s*:\s*'(vr3\.journal\.[^']+)'/g)]
      .flatMap((m) => [m[1]!, m[2]!])
    const all = [...new Set([...keys, ...ternary])]
    // Every VR3-01 action that can raise a toast supplies one.
    expect(all.length).toBeGreaterThanOrEqual(9)
    const missing: string[] = []
    for (const key of all) {
      if (!de.has(key)) missing.push(`${key}: no DE row`)
      if (!en.has(key)) missing.push(`${key}: no EN row`)
    }
    expect(missing).toEqual([])
  })

  it('no accessible name on the owned surfaces is a hardcoded literal', () => {
    // An `aria-label="…"` string literal is the same silent-fallback class
    // as QA-01 with the evidence removed: it renders in ONE language on
    // BOTH locales, and no screenshot can ever show it. The Option section
    // shipped `aria-label="Opportunity Options"` beside a heading that
    // reads "Opportunity options" in EN.
    //
    // A region named by its own heading (`aria-labelledby`) is preferred
    // over any label at all — one source cannot drift from itself.
    const literals: string[] = []
    for (const surface of OWNED_SURFACES) {
      const text = withoutComments(source(surface))
      for (const match of text.matchAll(/aria-label=(["'])([^"'{]+)\1/g)) {
        literals.push(`${surface}: aria-label="${match[2]}"`)
      }
    }
    expect(literals).toEqual([])
  })

  it('every list-card action embeds its visible label in its accessible name', () => {
    // WCAG 2.5.3 Label in Name: the visible text must be CONTAINED in the
    // accessible name, not paraphrased by it. `{name} öffnen` announced
    // "… öffnen" on a card whose button reads "Projekt prüfen", so a
    // speech-input user saying the words on screen could not activate it.
    //
    // Checked as data rather than as a rendered assertion: the template and
    // both visible labels are dictionary rows, so the containment either
    // holds for every locale or fails here naming the locale.
    for (const locale of ['de', 'en'] as const) {
      const template = dictionaryRow(locale, 'vr3.list.card.actionOn')
      for (const labelKey of ['vr3.list.card.openProject', 'vr3.list.card.reviewProject']) {
        const visible = dictionaryRow(locale, labelKey)
        const rendered = template
          .replace('{action}', visible)
          .replace('{name}', 'Quartier Am Güterbogen')
        expect(rendered, `${locale}/${labelKey} must be contained in the accessible name`)
          .toContain(visible)
      }
    }
  })

  it('every vr3.* key the surfaces reference has both a DE and an EN row', () => {
    const de = dictionaryKeys('de')
    const en = dictionaryKeys('en')
    const missing: string[] = []
    const seen = new Set<string>()
    for (const surface of OWNED_SURFACES) {
      for (const key of referencedVr3Keys(withoutComments(source(surface)))) {
        if (seen.has(key)) continue
        seen.add(key)
        if (!de.has(key)) missing.push(`${key}: no DE row (${surface})`)
        if (!en.has(key)) missing.push(`${key}: no EN row (${surface})`)
      }
    }
    // Sanity: the sweep must actually find keys, or it proves nothing.
    expect(seen.size).toBeGreaterThan(50)
    expect(missing).toEqual([])
  })
})
