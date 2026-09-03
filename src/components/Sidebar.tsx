import type { RefObject } from 'react'
import { demoProject } from '../state/projectAnalysis'
import {
  pipelineViewForBuildingGate,
  useStore,
  clientModeLockReasonFor,
} from '../state/store'
import type { PipelineView } from '../state/store'
import { NNBSP } from '../engine/money'
import { useT, type MessageKey } from '../i18n'
import {
  isClientProjection,
  isClientVisiblePipelineView,
} from '../state/clientProjection'
import { OutputProfileSwitch, SelectField } from './designSystem'
import { OptionWorkflowSpine } from './WorkflowSpine'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

/**
 * Левый сайдбар — навигация оболочки.
 *
 * Экраны S1…S6 — верхний уровень; главы конфигуратора — второй уровень под
 * активным пунктом (DC-13 Workflow Stepper: нумерация — рекомендованный
 * маршрут, не принуждение; прыгать можно куда угодно, цена не теряется,
 * потому что правая панель постоянна).
 *
 * Активный пункт помечен бордером выделения и подписью — не только цветом
 * (правило 8); выделение несёт `--color-selection-border`, не бренд-оранжевый
 * (R-01/R-03).
 */

/**
 * Навигация КОНВЕЙЕРА — только то, что относится к работе над Option.
 *
 * «Projekte» и «Vorbereitung» отсюда убраны намеренно: список проектов —
 * это корень продукта (уровень выше, доступен крошкой в шапке), а
 * подготовка — уровень Opportunity. Пункт навигации, ведущий на другой
 * уровень иерархии, — не навигация, а телепорт: он ломает представление
 * пользователя о том, где он находится.
 */
/**
 * Acceptance remediation (cycle 4): the approved Workspace target shows ONE
 * numbered workflow list (Gebäude & Umfang / Konfigurator / Vergleich /
 * Angebot), not a numbered pair plus a separately-styled link plus a
 * separately-grouped "Ausgabe" item. `vergleich` and `export` are REAL,
 * already-released destinations (`Variantenvergleich` link, `Ausgabe`
 * group below) — this only unifies where they render, not what they do:
 * same `s.setPipelineView(id)` calls, same gating logic, same visible
 * label text (`nav.vergleich`/`nav.export`, unchanged) as before.
 */
const SCREENS: Array<{
  id: PipelineView
  labelKey: MessageKey
  hint: string
}> = [
  { id: 'buildingScope', labelKey: 'nav.buildingScope', hint: '1' },
  { id: 'konfigurator', labelKey: 'nav.konfigurator', hint: '2' },
  { id: 'vergleich', labelKey: 'nav.vergleich', hint: '3' },
  { id: 'export', labelKey: 'nav.export', hint: '4' },
]

const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export function Sidebar({ modeRef }: { modeRef: RefObject<HTMLButtonElement> }) {
  const s = useStore()
  const { reduced } = useSemanticMotion()
  const view = pipelineViewForBuildingGate(s, s.pipelineView)
  const option = s.options.find((o) => o.id === s.activeOptionId)
  // Acceptance remediation (cycle 5): the approved target's identity block
  // names the project underneath the Option, the same fact the global
  // breadcrumb already carries (F05 precedent: objects are always named by
  // their resolved display label, never a raw id) — reusing the SAME
  // lookup `AppHeader` (App.tsx) already does, not a second source.
// VR3-01: the project's display name now comes from the two-fixture
// project register (`state/projectAnalysis`). The eight-row
// `fixtures/opportunities.json` this used to read is gone with the
// portfolio it described.
  const currentOpportunity = demoProject(s.opportunityId)
  // VR3-01: the scope line below used to print a hardcoded retired fixture
  // row ("Musterprojekt Nordfeld · Haus A") on EVERY project, regardless of
  // which project or building was open. It now names the buildings actually
  // in the proposal, and the project's own name is already the line under
  // it — so this one carries the scope, not the identity.
  const scopeBuildings = Object.values(s.buildings)
    .map((building) => building.stableName)
    .filter(Boolean)
  const t = useT()
  const client = isClientProjection(s.mode)
  const buildingGateBlocked = !s.canBeginConfiguration()
  const configurationGateBlocked = !s.configurationModeChosen || s.configurationModeEditing
  /**
   * VR3-04 — the client-view switch waits for a SAVED BASELINE.
   *
   * The three reasons are ordered from earliest to latest in the journey, so
   * the sentence the user reads is about the step they are actually on: no
   * building scope, then no configuration, then no saved Option. The last
   * one is the new gate (audit F-002) and it is stated as its own reason —
   * "not yet confirmed" would have sent the user back to the configuration
   * they had already finished.
   */
  const clientBaselineBlocked = clientModeLockReasonFor(s, s.activeOptionId) !== null
  const modeBlocked = buildingGateBlocked || configurationGateBlocked
    || clientBaselineBlocked
  const modeBlockedReason = buildingGateBlocked
    ? t('shell.mode.blockedReason')
    : configurationGateBlocked
      ? t('configurator.mode.clientBlocked')
      : clientBaselineBlocked
        ? t('vr3.client.blockedReason')
        : undefined
  const gateOpen = s.canBeginConfiguration()
  /**
   * The pre-Konfigurator phase: Gebäude & Umfang, and the Konfigurator
   * stage while it is still showing its own gate rather than the
   * configurator. Both belong to the journey the spine describes.
   */
  /**
   * VR3-03: the spine now carries the whole Option phase, the Konfigurator
   * included.
   *
   * VR3-02 restored it for the pre-Konfigurator stages and deliberately let
   * the four-item workspace list return once the Konfigurator itself was the
   * surface, "where its chapter navigation belongs". That chapter navigation
   * is gone: the six cost groups ARE stages of the one journey now, with
   * their own current/complete/skipped states, so replacing the spine with a
   * four-item list at exactly the moment the user enters those stages would
   * lose the position it was restored to show.
   */
  const optionPhase = !client
    && (view === 'buildingScope' || view === 'konfigurator')
  // Task 03 (deep-coherence audit, F-16/PD-3, CPO-confirmed): the building
  // gate alone used to leave Export reachable at mode choice, before any
  // Configurator confirmation existed at all — a 0-€ or half-configured
  // offer was exportable. Export additionally requires the whole-option
  // confirm CTA (`configurationComplete`); the other pipeline items keep
  // using the plain building gate, unaffected.
  const exportGateOpen = gateOpen && s.configurationComplete()
  const screens = client
    ? SCREENS.filter(({ id }) => isClientVisiblePipelineView(id))
    // VR3-02: while the spine above carries the journey, this list keeps
    // only the DESTINATIONS that are not stages of it. Comparison and
    // output are places an Option can be taken to, not steps it passes
    // through — dropping them with the stage list would have removed a
    // released capability from the phase, and repeating the two stages the
    // spine already shows would be two navigations for one journey.
    : optionPhase
      ? SCREENS.filter(({ id }) => id === 'vergleich' || id === 'export')
      : SCREENS

  return (
    <nav
      aria-label="Navigation"
      className={`flex h-full w-panel-left shrink-0 flex-col overflow-y-auto border-r border-border-strong bg-surface-default${view === 'konfigurator' ? ' a3-config-sidebar' : ''}`}
    >
      <div className="border-b border-border-strong px-5 py-4">
        {option && s.activeOptionId ? (
          client ? (
            // QA rework (R3, 877f2c2a): this SelectField used to render
            // unconditionally and call `s.openOption(...)` regardless of
            // mode — a fully interactive, undisclosed second path to
            // silently change the internally active/preparation Option
            // while Kundenansicht's own mode indicator reads "der Kunde
            // sieht diesen Bildschirm", right next to the dedicated
            // presentation-only "Wird präsentiert" selector that this
            // same ticket built specifically so THAT could never happen.
            // Reproduced live via Playwright CLI (QA finding): select a
            // different Option here while presenting → `activeOptionId`
            // silently flips, no warning, no Undo toast. Client mode gets
            // an informational label instead — same value, same visual
            // position, no longer an interactive Option-switching control.
            // The client-safe way to change what is PRESENTED remains the
            // Variantenvergleich screen's own selector (`setViewedOption`,
            // which never touches `activeOptionId`).
            <div>
              <p className="a3-cap">{t('shell.optionSwitcher')}</p>
              <p className="text-body font-medium text-text-primary">{option.name}</p>
            </div>
          ) : (
            <SelectField
              label={t('shell.optionSwitcher')}
              value={s.activeOptionId}
              onChange={(event) => s.openOption(event.target.value)}
            >
              {s.options.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </SelectField>
          )
        ) : (
          <p className="text-body font-medium text-text-primary">
            {scopeBuildings.length > 0
              ? scopeBuildings.join(`${NNBSP}· `)
              : t('shell.optionSwitcher')}
          </p>
        )}
        {currentOpportunity && (
          <p className="mt-1 text-small text-text-secondary">{currentOpportunity.name}</p>
        )}
      </div>

      {/* VR3-02: before the Konfigurator opens, the rail carries the ONE
          canonical thirteen-step journey (target T-012–T-017). Replacing it
          with a four-item workspace list at exactly the moment the journey
          got longer is how the user's position in it was lost; the
          four-item list returns once the Konfigurator itself is the
          surface, where its chapter navigation belongs. */}
      {optionPhase && (
        <div className="min-w-0 py-2">
          <p className="a3-cap px-5 pb-1 pt-3">{t('shell.sidebar.workflow')}</p>
          {/* No extra horizontal padding: the spine's own steps carry it,
              and doubling it at 1280 left the labels too little room to
              wrap and they clipped at the rail's edge. */}
          <div className="min-w-0 pb-3"><OptionWorkflowSpine /></div>
        </div>
      )}
      <ul className="flex-1 py-2">
        <li>
          <p className="a3-cap px-5 pb-1 pt-3">
            {t('shell.sidebar.workflow')}
          </p>
        </li>
        {screens.map((item) => {
          const active = view === item.id
          // Acceptance remediation (cycle 4): per-item gating, unchanged
          // from each item's own PREVIOUS independent block — vergleich
          // was never blocked (the old standalone link had no gate at
          // all); export's gate additionally requires the whole-option
          // confirm CTA (`exportGateOpen`), not just the building gate.
          const blocked = item.id === 'konfigurator' ? !gateOpen
            : item.id === 'export' ? !exportGateOpen
              : false
          // Done state drives the checkmark glyph below — decorative
          // (aria-hidden) because the accessible name stays exactly the
          // plain label (`nav.buildingScope`/`nav.konfigurator`/
          // `nav.vergleich`/`nav.export`, all unchanged), matching every
          // existing exact-string test and the canonical desktop
          // Playwright spec. `aria-current="page"` already tells
          // assistive tech which step is current; "done" is a sighted
          // progress cue on top of that, not the only place the state
          // lives — the item's own visible label plus reachability
          // (blocked vs not) still convey the same fact.
          const done = item.id === 'buildingScope' ? gateOpen
            : item.id === 'konfigurator' ? exportGateOpen
              : false
          const reasonId = `building-gate-${item.id}`
          const reasonText = item.id === 'konfigurator'
            ? t('buildingScope.gate.navigationReason')
            : item.id === 'export'
              ? (!gateOpen
                ? t('buildingScope.gate.navigationReason')
                : t('configurator.finalGate.exportBlockedReason'))
              : undefined
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => { if (!blocked) s.setPipelineView(item.id) }}
                aria-current={active ? 'page' : undefined}
                aria-disabled={blocked || undefined}
                aria-describedby={blocked ? reasonId : undefined}
                className={`relative flex min-h-hit-target w-full items-center gap-3 px-5 py-2 text-left text-body ${FOCUS} ` +
                  (active
                    ? 'border-l-selected border-selection-border bg-surface-subtle font-medium text-text-primary'
                    : 'border-l-selected border-transparent text-text-secondary hover:bg-surface-subtle') +
                  (blocked ? ' cursor-default text-text-disabled' : '')}
              >
                <span className="w-5 shrink-0 text-small text-text-muted" aria-hidden="true">
                  {done ? '✓' : item.hint}
                </span>
                {/* Acceptance remediation (cycle 5): the narrower 208/189px
                    rail (measured against the approved target) leaves long
                    unbreakable compound words like "Variantenvergleich" a
                    few px too wide for the available column — `min-w-0` lets
                    this flex child actually shrink instead of forcing the
                    button wider than the rail, and `break-words` allows a
                    hard mid-word break only in that rare case (no visible
                    effect on every shorter label that already fits). */}
                {/* VR2-09: `hyphens-auto` (document `lang` follows the UI
                    locale, App.tsx) gives the browser a real hyphenation
                    point BEFORE `break-words`' last-resort arbitrary break —
                    at 1440/1280 the rail rendered "Variantenverglei|ch"
                    and "Kundenansich|t prüfen" on every Work route. */}
                <span className="min-w-0 flex-1 break-words hyphens-auto">{t(item.labelKey)}</span>
              </button>

              {blocked && reasonText && (
                <p id={reasonId} className="px-5 pb-2 pl-8 text-small text-text-secondary">
                  {reasonText}
                </p>
              )}

            </li>
          )
        })}
      </ul>

      {/* Acceptance remediation (cycle 5): the approved target shows the
          Arbeiten/Präsentieren toggle at the BOTTOM of the rail, not
          directly under the Option identity block — moved down, same
          component/props/behaviour (still renders in client mode too, so
          presentation can always be exited from here). */}
      <div className="border-t border-border-subtle px-5 py-4">
        <OutputProfileSwitch
          compact
          mode={s.mode}
          blocked={modeBlocked}
          blockedReason={modeBlockedReason}
          checkButtonRef={modeRef}
          onCheck={() => s.setGateOpen(true)}
          onExit={() => startContinuityTransition(reduced, () => s.setMode('intern'))}
        />
      </div>

      {!client && (
        <div className="border-t border-border-subtle px-5 py-3">
          <button type="button" className="flex min-h-hit-target w-full items-center gap-3 text-left text-body text-text-secondary outline-none hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  onClick={() => s.setPipelineView('einstellungen')}>
            <span aria-hidden="true">⚙</span>{t('nav.einstellungen')}
          </button>
          {/* REDESIGN R1 (efcbdaf3): reinstates a navigable route to the
              already-internal-only 'grundlagen' PipelineView (excluded from
              CLIENT_VISIBLE_PIPELINE_VIEWS since clientProjection.ts) — the
              QA diagnostics + D-28 registry Gallery had no way to reach it
              from the running product. Same `!client` gate as Einstellungen
              above, so it stays absent in mode-praesentation. */}
          <button type="button" className="mt-1 flex min-h-hit-target w-full items-center gap-3 text-left text-body text-text-secondary outline-none hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  onClick={() => s.setPipelineView('grundlagen')}>
            <span aria-hidden="true">◇</span>{t('nav.grundlagen')}
          </button>
        </div>
      )}
    </nav>
  )
}
