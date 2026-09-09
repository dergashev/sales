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
  // VR3-TGA-UX-00 — the friendly KG 400 configurator and the interim
  // Schnittstellen & Verantwortung step.
  'src/screens/KgSystemChapter.tsx',
  'src/screens/ResponsibilityStage.tsx',
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
  // VR3-05 — the client presentation, its scenarios and its outputs.
  //
  // Added for the same reason the VR3-04 block above was: this ticket puts
  // four NEW product-owned surfaces in front of a client and the guard that
  // proves their EN path exists did not cover a single one of them. The
  // client narrative is the one place where a German string leaking into an
  // English presentation is visible to the CUSTOMER rather than to us.
  'src/components/PresentationShell.tsx',
  'src/components/ClientNarrative.tsx',
  'src/components/ClientScenario.tsx',
  'src/components/ClientOutputs.tsx',
  // VR3-CP-00: the ten-chapter proposal narrative. The chapters render ONE
  // declared client projection, so the projection module is an owned
  // surface too — it is where the client's strings are now resolved.
  'src/components/ClientCommercial.tsx',
  'src/components/ClientClosing.tsx',
  'src/state/clientProposal.ts',
  // Documents workspace rebuild — the two canonical additions the accepted
  // 2026-09-05 audit required, plus the register they are composed into.
  'src/design-system/WorkflowNavigator.tsx',
  'src/design-system/Pagination.tsx',
  // Project → Option → Configurator IA rebuild (accepted 2026-09-06 audit):
  // the two workspaces' own surfaces. Every product-owned string on them is
  // a dictionary key with a DE and an EN row — the ONE bridge call is the
  // engine-composed Declared Pricing Scope label named in the next test,
  // which is the accepted class rather than a new exemption.
  'src/components/OptionContextHeader.tsx',
  'src/components/OptionCreation.tsx',
  'src/components/optionLabels.ts',
  'src/screens/PraesentierenStage.tsx',
  // B2 · ACCEPT-01. The Option card's commercial summary MOVED into this
  // canonical component, and the surface that used to render the coverage
  // caption kept its place on this list while the render that replaced it
  // did not — so the guard went on passing over a file that no longer
  // contained the thing it was guarding. A component that renders a
  // product-owned string is a product surface, wherever it is filed.
  'src/design-system/OptionMetricSummary.tsx',
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
      // The VR2-07/VR2-08 offer-climax, send-review and delivered screens
      // print the same engine-composed labels `ProjectOptions.tsx` already
      // bridges below — a total naming its Declared Pricing Scope (R-18) and
      // a lead rate naming its norm. Both are asserted to bridge to English
      // by the next test in this file, so this is the accepted class and not
      // a second exemption. The VR3-05 CLIENT NARRATIVE itself bridges
      // nothing: it is fully keyed.
      // The CLIENT hero's Declared Pricing Scope (R-18), same engine-composed
      // label as the offer screens below and asserted to bridge by the next
      // test. Rendered raw it left "GESAMT NETTO · GRUNDLEISTUNG ALL3"
      // standing over an English presentation's largest number (QA-01's
      // family, cycle 2).
      // VR3-CP-00 moved BOTH of those calls into the one client projection
      // (`clientProposal.ts`): the stage and the sheet render the same
      // already-bridged `signature`, so neither can forget the bridge.
      // The rounding disclosure is the same class — engine-composed German
      // with a dictionary row — bridged once, in the same place.
      'src/components/PresentationShell.tsx: tx(p.leadRate.denominatorLabel)',
      'src/components/PresentationShell.tsx: tx(p.result.totalLabel)',
      'src/components/PresentationShell.tsx: tx(p.result.totalLabel)',
      'src/components/PresentationShell.tsx: tx(p.result.totalLabel)',
      'src/components/PresentationShell.tsx: tx(p.result.totalLabel)',
      'src/components/PresentationShell.tsx: tx(snapshot.totalLabel)',
      'src/design-system/WorkflowStepper.tsx: tx(key)',
      /**
       * B2 · requirement 9 — Validate now reviews the Option's applicable
       * area metrics, so it bridges the SAME engine-composed denominator
       * label `PresentationShell` already bridges above
       * (`p.leadRate.denominatorLabel`). It is the accepted class, not a new
       * exemption: `DENOMINATOR_LABEL` is German by contract because the
       * norm belongs to the metric's name (rule 31), every one of its values
       * has an EN row in the delivery, and the next test in this file proves
       * each one resolves. A segment with no denominator prints the same
       * label beside `nicht ermittelt`, which is the second call.
       */
      'src/screens/FinalValidation.tsx: tx(gap.denominatorLabel)',
      'src/screens/FinalValidation.tsx: tx(metric.rate.denominatorLabel)',
      /**
       * ACCEPT-01, second and third sites. Validate's review row and the
       * save receipt's row BOTH handed the engine's German coverage caption
       * to a `label:` property, which the old bare-render sweep could not
       * see because it only looked for a JSX interpolation. They are the
       * same accepted class as every `totalLabel` entry around them — an
       * R-18 qualifier with an EN row in the delivery — and they are now
       * bridged like the rest. Recorded here rather than exempted: this
       * list exists so a bridge call cannot appear without someone saying
       * which German string it is for.
       */
      'src/screens/FinalValidation.tsx: tx(result.totalLabel)',
      'src/screens/FinalValidation.tsx: tx(saved.result.totalLabel)',
      // The Option card's metric is the SAVED version's total, and a saved
      // total carries the same engine-composed German label every other
      // surface bridges (R-18). The live-projection call it replaces was
      // this same accepted class; the receipt on the Präsentieren stage is
      // the same label once more, on the stage that presents it.
      'src/screens/PraesentierenStage.tsx: tx(saved.result.totalLabel)',
      'src/screens/ProjectOptions.tsx: tx(saved.result.totalLabel)',
      'src/state/clientProposal.ts: tx(result.total.disclosure)',
      'src/state/clientProposal.ts: tx(result.totalLabel)',
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

/**
 * THE NEGATIVE CASE — the gap that let the same defect ship three times.
 *
 * Every guard above scans for something PRESENT and checks it resolves:
 * a `tx('…')` literal, a `vr3.*` key. None of them can see something
 * ABSENT. An engine-composed German label rendered as a bare
 * `{result.totalLabel}` is invisible to all of them, which is exactly how
 * this shipped:
 *
 *   cycle 1 — the client hero's `totalLabel` rendered raw, so
 *             "GESAMT NETTO · GRUNDLEISTUNG ALL3" stood over an English
 *             presentation's largest number;
 *   cycle 2 — fixed the hero, and missed the identical string in
 *             `ClientPrintDocument` one file over, in the same commit;
 *   cycle 3 — QA found it on the artefact the client keeps (QA-02).
 *
 * Three passes, one mistake, because the detector could only confirm what
 * had already been done rather than find what had not. So this asserts the
 * INVERSE: on an owned surface, an engine-composed German label is never
 * rendered bare. It reads the same sources the guards above read, and it
 * fails on an unwrapped render rather than on a missing dictionary row.
 *
 * `denominatorLabel` is the DECLARED EXCEPTION and is asserted as one:
 * LOCALE-009 keeps normative denominators (`BGF oberirdisch`,
 * `WFL nach WoFlV`, `NUF nach DIN 277`) out of machine translation on
 * purpose — and stating that here is what stops a future reader from
 * "fixing" it.
 *
 * ACCEPT-03 changed the SHAPE of that exception, not the rule. The client
 * investment tile used to render `{result.leadRate.denominatorLabel}` bare
 * as its term and the bare `display` as its value, which is how a €/m² rate
 * came to stand under an area label with no unit at all. The denominator
 * now reaches the client beside the engine's own composers — `rateUnit()`
 * attaches the `≈` and the `€/m²` to the number, `rateLabel()` adds the
 * denominator name for the wide surfaces that print it inline — so the
 * exception is no longer "a bare JSX interpolation exists" but "a composer
 * is what carries the unit, and the normative name is never handed to a
 * translator", and that is what the companion assertion pins.
 */
describe('VR3 · an engine-composed German label is never rendered bare', () => {
  /** The client presentation, which is the surface VR3-05 owns. */
  const CLIENT_SURFACES = [
    'src/components/ClientNarrative.tsx',
    'src/components/ClientScenario.tsx',
    'src/components/ClientOutputs.tsx',
    'src/components/ClientCommercial.tsx',
    'src/components/ClientClosing.tsx',
    'src/state/clientProposal.ts',
  ]
  /** Fields the engine composes in German by contract. */
  const BRIDGED_LABELS = ['totalLabel']
  /** Fields that must stay German (LOCALE-009). Bare is CORRECT here. */
  const DELIBERATELY_BARE = ['denominatorLabel']

  /**
   * The two shapes that count as bridging an engine-composed German label:
   * the product's hook (`tx`, from `useTx()`) and the pure function behind
   * it (`translateText(x, language)`), which is what a canonical Design
   * System component must use — a primitive that reaches into the store
   * cannot be rendered by the gallery (D-28).
   */
  const BRIDGE_CALL = String.raw`(?:tx|translateText)\(\s*`

  it('never lets an engine-composed label reach a surface unbridged', () => {
    /**
     * ACCEPT-01 CHANGED WHAT THIS SWEEP LOOKS AT, and the reason is the
     * whole point of the describe block above it.
     *
     * The previous version matched one shape — a JSX interpolation,
     * `{x.totalLabel}` — and therefore proved something much narrower than
     * it read as. `B2` moved the Option card's caption into
     * `OptionMetricSummary`, a file this list did not name, and rendered it
     * as `{projection.totalLabel}`: invisible to the sweep because the file
     * was not scanned. In the same candidate `FinalValidation` handed the
     * same field to a row as `label: result.totalLabel`: invisible because
     * a property is not a JSX interpolation. One guard, two blind spots,
     * both of the same kind — the pattern enumerated the shapes a defect
     * had taken BEFORE, so every new shape was a new hole.
     *
     * So it no longer enumerates shapes. On an owned surface the field may
     * appear ONLY inside a bridge call. Property, prop, interpolation,
     * template literal, argument, array element — all the same rule, and a
     * shape nobody has thought of yet is covered by construction.
     */
    const bare: string[] = []
    for (const surface of OWNED_SURFACES) {
      const text = withoutComments(source(surface))
      for (const field of BRIDGED_LABELS) {
        const pattern = new RegExp(String.raw`\.${field}\b`, 'g')
        for (const match of text.matchAll(pattern)) {
          const before = text.slice(0, match.index)
          // The bridge must open immediately before the expression: the
          // call, then the identifier chain this `.field` terminates.
          const bridged = new RegExp(BRIDGE_CALL + String.raw`[A-Za-z_$][\w$.?]*$`)
            .test(before)
          if (!bridged) {
            const line = text.slice(0, match.index).split('\n').length
            bare.push(`${surface}:${line}: .${field} is not bridged`)
          }
        }
      }
    }
    expect(bare).toEqual([])
  })

  it('still finds the fields at all, so the sweep proves something', () => {
    // A guard that silently matches nothing is worse than no guard: it
    // reports success forever. This pins that the fields are really there.
    let bridged = 0
    let composed = 0
    for (const surface of OWNED_SURFACES) {
      const text = withoutComments(source(surface))
      bridged += [...text.matchAll(
        new RegExp(BRIDGE_CALL + String.raw`[A-Za-z_$][\w$.?]*\.totalLabel\b`, 'g'),
      )].length
      composed += [...text.matchAll(/\brate(?:Label|Unit)\(/g)].length
    }
    // One per owned render site. A number, not a boolean: if a site is
    // deleted or a whole surface drops out of the list, this notices.
    expect(bridged).toBeGreaterThanOrEqual(10)
    // The normative denominator reaches the client through the engine's own
    // composer, which is the state this suite asserts is CORRECT: it is
    // what keeps the unit attached to the number (ACCEPT-03) while keeping
    // the normative name out of translation.
    expect(composed).toBeGreaterThan(0)
  })

  it('never hands a normative denominator to a translator, on the client surfaces', () => {
    // The inverse of ACCEPT-03's fix, and the one a future reader is most
    // likely to get wrong: seeing German inside an English presentation and
    // wrapping it. `BGF oberirdisch` / `WFL nach WoFlV` / `NUF nach DIN 277`
    // name a NORM, and a translated norm cites nothing.
    //
    // SCOPED DELIBERATELY to the client presentation, which is the surface
    // VR3-05 owns. The same `tx(…denominatorLabel)` pattern exists on four
    // sites of three VR2 surfaces (`PresentationShell`'s offer climax,
    // `OfferPanel`, `S4Vergleich`). It is inert TODAY — `translateText`
    // matches whole dictionary VALUES and no denominator name is one — so it
    // has never mistranslated anything, and widening this guard would either
    // ship red or force an unrelated cross-ticket edit into an acceptance
    // remediation. It is reported instead, with its own ticket.
    const translated: string[] = []
    for (const surface of CLIENT_SURFACES) {
      const text = withoutComments(source(surface))
      for (const field of DELIBERATELY_BARE) {
        const pattern = new RegExp(
          String.raw`\b(?:t|tx)\(\s*[A-Za-z_$][\w$.?]*\.${field}\b`, 'g',
        )
        for (const match of text.matchAll(pattern)) {
          translated.push(`${surface}: ${match[0]} — a normative denominator is not translated`)
        }
      }
    }
    expect(translated).toEqual([])
  })

  /**
   * The keys the FIXTURE composes, which no static scan can see.
   *
   * The surfaces above resolve several key families by interpolation —
   * `t(`vr3.docType.${doc.documentType}`)` and its siblings — so the value
   * that completes the key lives in `src/fixtures/*.json`, not in the
   * source. The static sweep therefore cannot check them, and it did not:
   * replacing Leipzig's document pack introduced four document types
   * (`sectionElevation`, `interfaces`, `schedule`, `planningRequirements`)
   * that had no row in EITHER dictionary, and the register rendered the raw
   * key `vr3.docType.sectionElevation` as its document type — in German, on
   * the surface this ticket exists to make truthful. Nothing failed. A
   * person looking at a browser found it.
   *
   * So the fixture is enumerated and every key it can compose is required
   * in BOTH dictionaries. A new family belongs in `FIXTURE_KEY_FAMILIES`,
   * and a new fixture value is then covered automatically — which is the
   * whole point, because a fixture value is exactly what nobody remembers
   * to translate.
   */
  const FIXTURE_KEY_FAMILIES: Array<{
    prefix: string
    values: (project: FixtureLike) => string[]
  }> = [
    {
      prefix: 'vr3.docType.',
      values: (p) => p.documents.map((d) => d.documentType),
    },
    {
      prefix: 'vr3.sourceAuthority.',
      values: (p) => p.documents.map((d) => d.sourceAuthority),
    },
    {
      prefix: 'vr3.recognition.',
      values: (p) => p.documents.map((d) => d.recognitionQuality),
    },
    {
      prefix: 'vr3.medium.',
      values: (p) => p.documents.map((d) => d.recognitionMedium),
    },
    {
      prefix: 'vr3.building.underground.',
      values: (p) => p.buildings.map((b) => b.undergroundLevel),
    },
    {
      prefix: 'vr3.evidence.state.',
      // Only the states that REACH the key. `AuthorityTrace` asks for a
      // stale reason only when the item is stale or contradicted
      // (`evidenceAuthorityTrace`), so `current` composes no key and must
      // not be demanded of the dictionary — requiring a row for a sentence
      // nothing can print is how a guard starts producing work instead of
      // catching defects.
      values: (p) => p.evidence
        .map((e) => e.state)
        .filter((state) => state === 'stale' || state === 'conflict'),
    },
  ]

  /**
   * Only the fields these families read. `Record<string, unknown>` would
   * push the narrowing into every accessor; naming the fields keeps the
   * families one line each and makes a missing fixture field a type error
   * rather than an `undefined` that silently composes `vr3.docType.
   * undefined` and passes.
   */
  type FixtureLike = {
    id: string
    documents: Array<{
      documentType: string
      sourceAuthority: string
      recognitionQuality: string
      recognitionMedium: string
    }>
    buildings: Array<{ undergroundLevel: string }>
    evidence: Array<{ state: string }>
  }

  it('every key the demonstration fixtures compose has a DE and an EN row', () => {
    const de = dictionaryKeys('de')
    const en = dictionaryKeys('en')
    const fixture = JSON.parse(
      source('src/fixtures/vr3-demo-projects.json'),
    ) as { projects: FixtureLike[] }

    const missing: string[] = []
    let checked = 0
    for (const project of fixture.projects) {
      for (const family of FIXTURE_KEY_FAMILIES) {
        for (const value of new Set(family.values(project))) {
          const key = `${family.prefix}${value}`
          checked += 1
          if (!de.has(key)) missing.push(`${project.id}: ${key} — no DE row`)
          if (!en.has(key)) missing.push(`${project.id}: ${key} — no EN row`)
        }
      }
    }
    expect(missing).toEqual([])
    // A sweep that matched nothing would report success forever.
    expect(checked).toBeGreaterThan(FIXTURE_KEY_FAMILIES.length)
  })

  it('every literal dictionary key STORED in a fixture resolves in both languages', () => {
    // The other half of the same class: fields like `labelKey`,
    // `conceptKey`, `issueKey` and `requirementKey` hold a WHOLE key, so a
    // fixture can name a row that was never written. Walking the file finds
    // them without a list of field names to keep up to date.
    const de = dictionaryKeys('de')
    const en = dictionaryKeys('en')
    const missing: string[] = []
    let checked = 0
    const walk = (node: unknown) => {
      if (typeof node === 'string') {
        if (!/^vr3\.[a-zA-Z][\w.]*$/.test(node)) return
        // Only strings that are USED as keys: a value that merely looks like
        // one but names no row would otherwise be reported as a defect of
        // the dictionary rather than of the fixture. Both dictionaries
        // missing it IS the defect; one of them missing it is too.
        if (!de.has(node) && !en.has(node)) return
        checked += 1
        if (!de.has(node)) missing.push(`${node} — no DE row`)
        if (!en.has(node)) missing.push(`${node} — no EN row`)
        return
      }
      if (Array.isArray(node)) { node.forEach(walk); return }
      if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(JSON.parse(source('src/fixtures/vr3-demo-projects.json')))
    expect(missing).toEqual([])
    expect(checked).toBeGreaterThan(50)
  })
})
