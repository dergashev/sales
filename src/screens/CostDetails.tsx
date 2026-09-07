import { useEffect, useRef } from 'react'
import { Decimal } from 'decimal.js'
import {
  commercialSnapshot, includedBuildingIds, useStore,
} from '../state/store'
import {
  commercialComposition,
  commercialCompleteness,
  contributionLedger,
  openCommercialStates,
  regionalFactorPresentation,
  selectedCommercialEffects,
  withoutBuildingPrefix,
  type OpenStateRow,
  type SelectedCommercialEffect,
} from '../state/commercialProjection'
import { optionNav, type OptionDestination } from '../state/optionLifecycle'
import { translatedDriverLabel } from '../state/clientProjection'
import { splitKg300 } from '../engine/risk'
import type { CostGroup } from '../engine/calculate'
import { NNBSP, present, label as moneyLabel } from '../engine/money'
import { DataTable, StateTag, type DataTableRow } from '../design-system/DataTable'
import { EstimateUncertaintyBadge } from '../components/EstimateUncertaintyBadge'
import { Button } from '../components/primitives'
import { effectStateLabel, formatDate, signed } from '../components/OfferPanel'
import { useT, useTx, localizeMoneyText, localizePercentText } from '../i18n'
import type { UiLanguage } from '../i18n'

/**
 * KOSTENDETAILS — the Option's complete commercial explanation, as a PAGE.
 *
 * ```
 * /projekt/:projectId/option/:optionId/kostendetails
 * ```
 *
 * WHAT IT REPLACES. The whole cost explanation used to live in a modal
 * measured at 2.07 viewport heights collapsed and 3.33 expanded — on the
 * SIMPLE fixture — with fourteen nested provenance popovers, several of which
 * could not be read at all because scrolling the modal closed them. The chain
 * a salesperson had to walk was `Alle Details → Details → Herkunft → another
 * detail`. That chain is gone; nothing here opens a layer over a layer.
 *
 * IT IS NOT A FIFTH STAGE. `ProjectStage` and `OptionStageId` are untouched.
 * This is a non-stage Option destination, the shape `appRoute.ts` already
 * provides for `export`, `einstellungen` and `grundlagen` — which is exactly
 * right for a page that may never carry a step, because it is read-oriented.
 *
 * IT READS THE INTERNAL OPTION. `activeOptionId`, never
 * `resolvedViewedOptionId()`: the Option being CONFIGURED, never the one a
 * client presentation happens to be looking at.
 *
 * ONE EDITABLE TRUTH, AND IT IS NOT HERE. Allowed: inspect, expand, follow a
 * value to its source, read the history, use the released undo. Every change
 * goes back through `Zur Entscheidung` to the Configurator surface that owns
 * it — which is also why Browser Back returns to that exact context: this is
 * a route, so the released router's one-entry-per-path guarantee applies.
 *
 * EIGHT SECTIONS, and the navigator above them is an in-page anchor list, not
 * a tab set that hides seven-eighths of the page from Ctrl-F and from print.
 */

const SECTIONS = [
  { id: 'kd-a', key: 'costDetails.nav.summary' },
  { id: 'kd-b', key: 'costDetails.nav.selection' },
  { id: 'kd-c', key: 'costDetails.nav.din' },
  { id: 'kd-d', key: 'costDetails.nav.ledger' },
  { id: 'kd-e', key: 'costDetails.nav.open' },
  { id: 'kd-f', key: 'costDetails.nav.regional' },
  { id: 'kd-g', key: 'costDetails.nav.origin' },
  { id: 'kd-h', key: 'costDetails.nav.history' },
] as const

export function CostDetails() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const lang: UiLanguage = s.uiLanguage
  const snapshot = commercialSnapshot(s)
  const p = snapshot.projection
  const commercial = snapshot.result
  const headingRef = useRef<HTMLHeadingElement>(null)

  const buildingIds = includedBuildingIds(s)
  const completeness = commercialCompleteness(commercial)
  const composition = commercialComposition(commercial)
  const effects = selectedCommercialEffects(commercial, buildingIds)
  const ledger = contributionLedger(commercial)
  const regional = regionalFactorPresentation(commercial)
  const openStates = openCommercialStates(commercial, effects)

  /**
   * Route entry moves focus to the page's own `h1`.
   *
   * A reader who arrives by keyboard must land on the thing that says where
   * they are, not at the top of a document whose first focusable control is
   * three landmarks away.
   */
  useEffect(() => { headingRef.current?.focus() }, [])

  const money = (d: Decimal) => localizeMoneyText(moneyLabel(present(d), '€'), lang)
  const signedMoney = (d: Decimal) => localizeMoneyText(signed(d), lang)
  const percent = (value: number) =>
    localizePercentText(`${Math.round(value)}${NNBSP}%`, lang)
  const groupLabel = (group: CostGroup) =>
    `${group.replace('_', NNBSP)} ${t(`costGroup.${group}`)}`
  const effectName = (effect: SelectedCommercialEffect) => translatedDriverLabel(
    { key: withoutBuildingPrefix(effect.key, buildingIds), label: effect.label },
    t, lang,
  )
  const goTo = (destination: OptionDestination) => {
    const nav = optionNav(destination)
    s.setPipelineView(nav.view)
    if (nav.step) s.openConfiguratorStepAt(nav.step)
  }

  const option = s.options.find((entry) => entry.id === s.activeOptionId)
  const journal = s.journal.filter((event) => event.optionId === s.activeOptionId)
  const undoableSeq = [...journal]
    .reverse()
    .find((event) => event.kind !== 'undo' && event.inverse && !s.undone.includes(event.seq))
    ?.seq ?? null

  return (
    <div className="a3-costdetails">
      <div className="a3-costdetails-head">
        <h1
          ref={headingRef}
          tabIndex={-1}
          data-page-heading
          className="a3-hero-title outline-none"
        >
          {t('costDetails.title')}
        </h1>
        <p className="a3-costdetails-sub">
          {t('costDetails.subtitle', {
            option: option?.name ?? '',
            date: formatDate(commercial.derivedAtIso.slice(0, 10), lang),
          })}
        </p>
      </div>

      <nav className="a3-costdetails-nav" aria-label={t('costDetails.nav.label')}>
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>{t(section.key)}</a>
        ))}
      </nav>

      {/* ═══ A · KAUFMÄNNISCHE ZUSAMMENFASSUNG ════════════════════════════
          Compact by contract: this is the rail's own summary said once more
          for a reader who arrived here, not the rail rebuilt at triple size.
          The uncertainty RANGE BAR lives here rather than in the rail, where
          its edges restated one number as three for ~80 px. */}
      <section id="kd-a" className="a3-costdetails-sect" aria-labelledby="kd-a-h">
        <h2 id="kd-a-h">{t('costDetails.a.heading')}</h2>
        <div className="a3-costdetails-summary">
          {/* The hero cell is an ordinary summary cell: the four columns are
              equal tracks in the target (T-07) and measured equal here at
              both widths, and the display treatment belongs to the NUMBER
              (`a3-costdetails-hero`), not to its container. The extra
              `-cell-hero` modifier this carried was never declared in
              components.css, so it styled nothing — a silent-failure class
              of exactly the kind GOV forbids. */}
          <div className="a3-costdetails-cell">
            <span className="a3-costdetails-k">{tx(commercial.totalLabel)}</span>
            <span className="a3-costdetails-hero">{money(commercial.total.exact)}</span>
            <div className="a3-costdetails-range">
              <EstimateUncertaintyBadge
                language={lang}
                presentation="range"
                totalExact={commercial.total.exact}
                pp={commercial.uncertaintyPp}
              />
            </div>
          </div>
          <div className="a3-costdetails-cell">
            <span className="a3-costdetails-k">{t('costDetails.a.leadRate')}</span>
            <span className="a3-costdetails-v">
              {p.leadRate.prefix && <span aria-hidden="true">{p.leadRate.prefix}{NNBSP}</span>}
              {localizeMoneyText(p.leadRate.display, lang)}{NNBSP}€/m²
            </span>
            <span className="a3-costdetails-k">{tx(p.leadRate.denominatorLabel)}</span>
          </div>
          <div className="a3-costdetails-cell">
            <span className="a3-costdetails-k">{t('costDetails.a.duration')}</span>
            <span className="a3-costdetails-v">
              {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
              {localizeMoneyText(p.duration.display.replace(`${NNBSP}Monate`, ''), lang)}
              {NNBSP}{t('offerPanel.duration.unit')}
            </span>
            <span className="a3-costdetails-k">
              {t('schedule.completionFromOkbp', {
                date: formatDate(p.duration.completionDate, lang),
              })}
            </span>
          </div>
          <div className="a3-costdetails-cell">
            <span className="a3-costdetails-k">{t('costDetails.a.completeness')}</span>
            <span className="a3-costdetails-v">
              {t('costDetails.a.completenessValue', {
                included: completeness.includedGroups,
                total: completeness.decidableGroups,
              })}
            </span>
            <span className="a3-costdetails-k">
              {t('costDetails.a.completenessDetail', { open: completeness.openDecisions })}
            </span>
          </div>
        </div>
        <p className="a3-costdetails-note">
          {t('costDetails.a.furtherRates')}
          {': '}
          {p.secondaryRateBgf.denominatorType !== p.leadRate.denominatorType && (<>
            {p.secondaryRateBgf.prefix && `${p.secondaryRateBgf.prefix}${NNBSP}`}
            {localizeMoneyText(p.secondaryRateBgf.display, lang)}{NNBSP}€/m²{' '}
            {tx(p.secondaryRateBgf.denominatorLabel)}
            {p.perUnit ? ' · ' : ''}
          </>)}
          {p.perUnit && (<>
            {p.perUnit.prefix && `${p.perUnit.prefix}${NNBSP}`}
            {localizeMoneyText(p.perUnit.display, lang)}{NNBSP}€{' '}
            {tx(p.perUnit.denominatorLabel)}
          </>)}
        </p>
        <div className="a3-costdetails-callout">{t('costDetails.a.readOnly')}</div>
      </section>

      {/* ═══ B · AKTUELL GEWÄHLTE AUSWAHL MIT PREISWIRKUNG ════════════════
          The COMPLETE current projection, not the rail's top three. The one
          sentence that these do not sum to the amount is stated once, above
          the table — not as a disclaimer under every row. */}
      <section id="kd-b" className="a3-costdetails-sect" aria-labelledby="kd-b-h">
        <h2 id="kd-b-h">{t('costDetails.b.heading')}</h2>
        <p className="a3-costdetails-lede">{t('commercial.effects.notSummed')}</p>
        {effects.all.length === 0 ? (
          <p className="a3-costdetails-empty">{t('costDetails.b.empty')}</p>
        ) : (
          <DataTable
            caption={t('costDetails.b.caption')}
            columns={[
              { key: 'decision', header: t('costDetails.b.colDecision') },
              { key: 'value', header: t('costDetails.b.colValue') },
              { key: 'contribution', header: t('costDetails.b.colContribution'), align: 'numeric' },
              { key: 'reference', header: t('costDetails.b.colReference') },
              { key: 'delta', header: t('costDetails.b.colDelta'), align: 'numeric' },
              { key: 'kg', header: t('costDetails.b.colKg') },
              { key: 'authority', header: t('costDetails.b.colAuthority') },
              { key: 'action', header: t('costDetails.b.colAction'), unlabelled: true },
            ]}
            rows={effects.all.map((effect): DataTableRow => {
              const state = effectStateLabel(effect, t, lang)
              const reference = effect.reference
              return {
                key: effect.key,
                header: effectName(effect),
                cells: [
                  {
                    content: (lang === 'en' ? effect.valueEn : effect.valueDe)
                      ?? t('costDetails.b.selected'),
                  },
                  effect.exact === null
                    // NO AMOUNT IS INVENTED. A row whose authority carries no
                    // amount says so; it never borrows a zero.
                    ? { content: t('costDetails.b.noAmount'), absent: true }
                    : {
                      content: effect.exact.isNegative()
                        ? signedMoney(effect.exact)
                        : money(effect.exact),
                      align: 'numeric',
                    },
                  {
                    content: reference
                      ? (lang === 'en' ? reference.referenceEn : reference.referenceDe)
                      : '—',
                  },
                  // A delta EXISTS only against a named reference. Where there
                  // is none the cell is empty — never `± 0 €`, which would
                  // claim two options measurably cost the same.
                  reference
                    ? { content: signedMoney(reference.delta), align: 'numeric' }
                    : { content: '—', align: 'numeric' },
                  { content: effect.costGroup ? effect.costGroup.replace('_', NNBSP) : '—' },
                  {
                    content: state
                      ? <StateTag label={state} />
                      : <StateTag label={t('vr3.tga.price.direct')} />,
                  },
                  {
                    // The NAME belongs in the accessible name, not in the
                    // visible label: thirty rows each repeating their own
                    // decision squeezed the decision column until it broke
                    // words mid-syllable. A screen-reader buttons list still
                    // tells them apart, which is what the name is for.
                    content: effect.destination ? (
                      <button
                        type="button"
                        className="a3-linkbtn a3-dt-go"
                        aria-label={t('commercial.effects.toDecisionNamed', {
                          decision: effectName(effect),
                        })}
                        onClick={() => goTo(effect.destination!)}
                      >
                        {t('commercial.effects.toDecision')}
                        <span aria-hidden="true">{' ›'}</span>
                      </button>
                    ) : null,
                  },
                ],
              }
            })}
          />
        )}
      </section>

      {/* ═══ C · ZUSAMMENSETZUNG NACH DIN 276 ═════════════════════════════
          To the SECOND level and no further: a Kostenschätzung is determined
          at the second DIN level, and a third level does not exist at this
          planning stage — inventing one would be a classification claim. */}
      <section id="kd-c" className="a3-costdetails-sect" aria-labelledby="kd-c-h">
        <h2 id="kd-c-h">{t('costDetails.c.heading')}</h2>
        <p className="a3-costdetails-lede">
          {composition.coverage === 'subtotal'
            ? t('costDetails.c.ledeSubtotal')
            : t('costDetails.c.ledeTotal')}
        </p>
        <DataTable
          caption={t('costDetails.c.caption')}
          columns={[
            { key: 'group', header: t('commercial.din.colGroup') },
            { key: 'amount', header: t('commercial.din.colAmount'), align: 'numeric' },
            { key: 'share', header: t('commercial.din.colShare'), align: 'numeric' },
            { key: 'scope', header: t('costDetails.c.colScope') },
          ]}
          rows={composition.rows.flatMap((row): DataTableRow[] => {
            const head: DataTableRow = row.exact !== null
              ? {
                key: row.group,
                header: groupLabel(row.group),
                variant: 'group',
                cells: [
                  { content: money(row.exact), align: 'numeric' },
                  {
                    content: row.sharePercent === null ? '' : percent(row.sharePercent),
                    align: 'numeric',
                  },
                  { content: t('costDetails.c.all3') },
                ],
              }
              : {
                key: row.group,
                header: groupLabel(row.group),
                cells: [
                  { content: t('costDetails.b.noAmount'), absent: true, colSpan: 2 },
                  {
                    content: (
                      <StateTag
                        tone={row.state === 'undecided' ? 'warning' : 'neutral'}
                        label={row.state === 'excluded' ? t('commercial.din.excluded')
                          : row.state === 'undecided' ? t('commercial.din.undecided')
                            : t('money.priceNotDetermined')}
                      />
                    ),
                  },
                ],
              }
            // The second level exists where the Product owns it: KG 300's
            // structural risk-basis split, which is fixture-declared and
            // carries the derivation mark on every row (D-22).
            if (row.group !== 'KG_300' || row.exact === null) return [head]
            return [head, ...splitKg300(row.exact).map((sub): DataTableRow => ({
              key: sub.id,
              header: `${sub.id.replace('_', NNBSP)} ${translatedSubgroup(sub, t)} ${MARKER}`,
              variant: 'indent',
              cells: [
                { content: money(sub.exact), align: 'numeric' },
                {
                  content: composition.totalExact.isZero()
                    ? ''
                    : percent(sub.exact.div(composition.totalExact).mul(100).toNumber()),
                  align: 'numeric',
                },
                { content: '' },
              ],
            }))]
          }).concat([{
            key: 'din-total',
            header: tx(composition.totalLabel),
            variant: 'sum',
            cells: [
              { content: money(composition.totalExact), align: 'numeric' },
              { content: percent(100), align: 'numeric' },
              { content: '' },
            ],
          }])}
        />
      </section>

      {/* ═══ D · BEITRAGSVERZEICHNIS ══════════════════════════════════════
          The modal's one genuinely valuable table, rehoused where it fits.
          It DOES reconcile — that is what distinguishes it from section B —
          and the sum is COMPUTED from the rows printed above it, not claimed
          in a caption beside them. */}
      <section id="kd-d" className="a3-costdetails-sect" aria-labelledby="kd-d-h">
        <h2 id="kd-d-h">{t('costDetails.d.heading')}</h2>
        <p className="a3-costdetails-lede">
          {t('costDetails.d.lede', { count: ledger.rowCount })}
          {' '}
          {ledger.reconciles
            ? t('costDetails.d.reconciles')
            : t('costDetails.d.drift', { drift: ledger.drift.toFixed(2) })}
        </p>
        <DataTable
          caption={t('costDetails.d.caption')}
          columns={[
            { key: 'contribution', header: t('costDetails.b.colContribution') },
            { key: 'amount', header: t('commercial.din.colAmount'), align: 'numeric' },
            { key: 'kg', header: t('costDetails.b.colKg') },
            { key: 'origin', header: t('costDetails.d.colOrigin') },
            { key: 'authority', header: t('costDetails.b.colAuthority') },
          ]}
          rows={ledger.groups.flatMap((group): DataTableRow[] => [
            {
              key: `group-${group.group ?? 'none'}`,
              header: group.group
                ? groupLabel(group.group)
                : t('costDetails.d.unattributed'),
              variant: 'group',
              cells: [
                { content: money(group.subtotal), align: 'numeric' },
                { content: '' },
                { content: '' },
                { content: '' },
              ],
            },
            ...group.rows.map((row): DataTableRow => ({
              key: row.key,
              header: translatedDriverLabel(
                { key: withoutBuildingPrefix(row.key, buildingIds), label: row.label },
                t, lang,
              ),
              variant: 'indent',
              cells: [
                {
                  content: row.exact.isNegative() ? signedMoney(row.exact) : money(row.exact),
                  align: 'numeric',
                },
                { content: row.costGroup ? row.costGroup.replace('_', NNBSP) : '—' },
                { content: t(`costDetails.origin.${row.origin}`) },
                {
                  // The authority word, from the ONE dictionary that owns the
                  // axis. `unknown` and `none` are told apart from `direct`
                  // rather than folded into it: a missing authority is not
                  // evidence of direct pricing.
                  content: <StateTag label={ledgerAuthorityWord(row.authority, t)} />,
                },
              ],
            })),
          ]).concat([{
            key: 'ledger-sum',
            header: t('costDetails.d.sum'),
            variant: 'sum',
            cells: [
              { content: money(ledger.sum), align: 'numeric' },
              { content: '' },
              { content: '' },
              { content: '' },
            ],
          }])}
        />
      </section>

      {/* ═══ E · OFFEN · OHNE PREISGRUNDLAGE · BAUSEITS · AUSGESCHLOSSEN ══
          A deliberate home, so these never have to be buried among euro rows
          or given a fake amount to have somewhere to sit. */}
      <section id="kd-e" className="a3-costdetails-sect" aria-labelledby="kd-e-h">
        <h2 id="kd-e-h">{t('costDetails.e.heading')}</h2>
        <p className="a3-costdetails-lede">{t('costDetails.e.lede')}</p>
        {openStates.length === 0 ? (
          <p className="a3-costdetails-empty">{t('costDetails.e.empty')}</p>
        ) : (
          <DataTable
            caption={t('costDetails.e.caption')}
            columns={[
              { key: 'position', header: t('costDetails.e.colPosition') },
              { key: 'state', header: t('costDetails.e.colState') },
              { key: 'meaning', header: t('costDetails.e.colMeaning') },
              { key: 'action', header: t('costDetails.b.colAction'), unlabelled: true },
            ]}
            rows={openStates.map((row): DataTableRow => ({
              key: row.key,
              header: openStateName(row, t, lang, buildingIds, groupLabel),
              cells: [
                {
                  content: (
                    <StateTag
                      tone={row.kind === 'undecidedGroup' ? 'warning' : 'neutral'}
                      label={openStateWord(row, t, lang)}
                    />
                  ),
                },
                { content: t(`costDetails.e.meaning.${row.kind}`) },
                {
                  content: row.destination ? (
                    <button
                      type="button"
                      className="a3-linkbtn a3-dt-go"
                      aria-label={`${row.kind.endsWith('Group')
                        ? t('costDetails.e.toScope')
                        : t('commercial.effects.toDecision')} · ${
                        openStateName(row, t, lang, buildingIds, groupLabel)}`}
                      onClick={() => goTo(row.destination!)}
                    >
                      {row.kind.endsWith('Group')
                        ? t('costDetails.e.toScope')
                        : t('commercial.effects.toDecision')}
                      <span aria-hidden="true">{' ›'}</span>
                    </button>
                  ) : null,
                },
              ],
            }))}
          />
        )}
      </section>

      {/* ═══ F · REGIONALFAKTOR ═══════════════════════════════════════════
          From the canonical selector, never a formula written again in a
          view. Inactive is the default and the counterfactual is stated
          explicitly as NOT included — a silence would read as zero. */}
      <section id="kd-f" className="a3-costdetails-sect" aria-labelledby="kd-f-h">
        <h2 id="kd-f-h">{t('costDetails.f.heading')}</h2>
        <div className="a3-costdetails-callout" data-tone={regional.active ? 'neutral' : 'warning'}>
          {regional.active
            ? t('costDetails.f.active', { amount: money(regional.effect) })
            : t('costDetails.f.inactive', { amount: money(regional.effect) })}
        </div>
        <DataTable
          caption={t('costDetails.f.caption')}
          columns={[
            { key: 'field', header: t('costDetails.f.colField') },
            { key: 'value', header: t('costDetails.f.colValue') },
          ]}
          rows={[
            {
              key: 'state',
              header: t('costDetails.f.state'),
              cells: [{
                content: (
                  <StateTag label={regional.active
                    ? t('costDetails.f.stateActive')
                    : t('costDetails.f.stateInactive')}
                  />
                ),
              }],
            },
            {
              key: 'reference',
              header: t('costDetails.f.reference'),
              cells: [{ content: t('costDetails.f.referenceValue') }],
            },
            {
              key: 'effect',
              header: t('costDetails.f.effect'),
              cells: [{
                content: regional.included
                  ? t('costDetails.f.effectIncluded', { amount: money(regional.effect) })
                  : t('costDetails.f.effectNotIncluded', { amount: money(regional.effect) }),
              }],
            },
            {
              key: 'snapshot',
              header: t('costDetails.f.inSnapshot'),
              cells: [{ content: t('costDetails.f.inSnapshotValue') }],
            },
          ]}
        />
      </section>

      {/* ═══ G · PREISGRUNDLAGE UND HERKUNFT ══════════════════════════════
          ONE provenance surface. Not fourteen independently opened layers,
          and never an implementation identifier: a run reference is a
          preparation fact, a store path is not a fact at all. */}
      <section id="kd-g" className="a3-costdetails-sect" aria-labelledby="kd-g-h">
        <h2 id="kd-g-h">{t('costDetails.g.heading')}</h2>
        <p className="a3-costdetails-lede">{t('costDetails.g.lede')}</p>
        <DataTable
          caption={t('costDetails.g.caption')}
          columns={[
            { key: 'value', header: t('costDetails.g.colValue') },
            { key: 'basis', header: t('costDetails.g.colBasis') },
            { key: 'source', header: t('costDetails.g.colSource') },
            { key: 'rounding', header: t('costDetails.g.colRounding') },
          ]}
          rows={[
            {
              key: 'total',
              header: tx(commercial.totalLabel),
              cells: [
                { content: t('costDetails.g.basisSum') },
                { content: t('costDetails.g.sourceRule') },
                {
                  content: commercial.total.disclosure
                    ? tx(commercial.total.disclosure)
                    : t('costDetails.g.noRounding'),
                },
              ],
            },
            {
              key: 'rate',
              header: `${localizeMoneyText(p.leadRate.display, lang)}${NNBSP}€/m²`,
              cells: [
                {
                  content: t('costDetails.g.basisRate', {
                    denominator: tx(p.leadRate.denominatorLabel),
                  }),
                },
                {
                  content: t('costDetails.g.sourceArea', {
                    denominator: tx(p.leadRate.denominatorLabel),
                    quantity: localizeMoneyText(
                      p.leadRate.denominator.toFixed(2).replace('.', ','), lang,
                    ),
                  }),
                },
                {
                  content: p.leadRate.disclosure
                    ? tx(p.leadRate.disclosure)
                    : t('costDetails.g.noRounding'),
                },
              ],
            },
            {
              key: 'duration',
              header: `${localizeMoneyText(p.duration.display, lang)}`,
              cells: [
                { content: t('costDetails.g.basisDuration') },
                {
                  content: t('costDetails.g.sourceSchedule', {
                    date: formatDate(p.duration.completionDate, lang),
                  }),
                },
                {
                  content: p.duration.policy === 'halfMonthRounded'
                    ? t('panel.roundedHalfMonths')
                    : t('panel.wholeCalendarMonths'),
                },
              ],
            },
          ]}
        />
        <p className="a3-costdetails-note">{t('offerPanel.derivedMarker.legend')}</p>
      </section>

      {/* ═══ H · ÄNDERUNGSVERLAUF ═════════════════════════════════════════
          Commercial history has a home, and `Rückgängig` sits BESIDE the
          change it reverses. The released journal semantics are unchanged:
          exactly one event is undoable at a time, and it is the newest one of
          THIS Option — cross-Option undo stays impossible by construction. */}
      <section id="kd-h" className="a3-costdetails-sect" aria-labelledby="kd-h-h">
        <h2 id="kd-h-h">{t('costDetails.h.heading')}</h2>
        <p className="a3-costdetails-lede">{t('costDetails.h.lede')}</p>
        {journal.length === 0 ? (
          <p className="a3-costdetails-empty">{t('costDetails.h.empty')}</p>
        ) : (
          <ul className="a3-costdetails-history" aria-label={t('costDetails.h.listLabel')}>
            {[...journal].reverse().map((event) => (
              <li key={event.seq}>
                <span className="a3-costdetails-when">
                  {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'de-DE', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  }).format(new Date(event.at))}
                </span>
                <span>
                  {event.labelKey ? t(event.labelKey, event.labelValues) : tx(event.label)}
                </span>
                <span className="a3-costdetails-delta">
                  {event.deltaExact
                    ? signedMoney(event.deltaExact)
                    : t('costDetails.h.noAmount')}
                </span>
                <span>
                  {event.seq === undoableSeq && (
                    <Button variant="ghost" onClick={() => s.undoEvent(event.seq)}>
                      {t('common.undo')}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const MARKER = '⚙'

const LEDGER_AUTHORITY_KEY: Readonly<Record<string, string>> = {
  direct: 'vr3.tga.price.direct',
  bundle: 'vr3.tga.price.bundle',
  indirect: 'vr3.tga.price.indirect',
  noBasis: 'vr3.tga.price.noBasis',
  bauherr: 'commercial.authority.bauseits',
  none: 'vr3.tga.price.notInOffer',
  unknown: 'commercial.authority.unknown',
}

function ledgerAuthorityWord(
  authority: string,
  t: (key: string) => string,
): string {
  return t(LEDGER_AUTHORITY_KEY[authority] ?? 'commercial.authority.unknown')
}

function translatedSubgroup(
  sub: { id: string; label: string },
  t: (key: string) => string,
): string {
  const key = `kg300Subgroup.${sub.id}`
  const translated = t(key)
  return translated === key ? sub.label : translated
}

/** The row's own name: a cost group by its DIN label, a selection by its own. */
function openStateName(
  row: OpenStateRow,
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string,
  lang: UiLanguage,
  buildingIds: readonly string[],
  groupLabel: (group: CostGroup) => string,
): string {
  if (row.kind.endsWith('Group') && row.costGroup) return groupLabel(row.costGroup)
  return translatedDriverLabel(
    { key: withoutBuildingPrefix(row.key.replace(/^effect:/, ''), buildingIds), label: row.label },
    t, lang,
  )
}

/** The state, as a WORD — never a colour, and never a substituted zero. */
function openStateWord(
  row: OpenStateRow,
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string,
  lang: UiLanguage,
): string {
  switch (row.kind) {
    case 'undecidedGroup': return t('commercial.din.undecided')
    case 'excludedGroup': return t('commercial.din.excluded')
    case 'unpricedGroup': return t('money.priceNotDetermined')
    case 'noBasis': return t('vr3.tga.price.noBasis')
    case 'bundle': {
      const basis = lang === 'en' ? row.bundleLabelEn : row.bundleLabelDe
      return basis ? t('vr3.tga.price.bundleNamed', { basis }) : t('vr3.tga.price.bundle')
    }
    case 'indirect': return t('vr3.tga.price.indirect')
    case 'bauherr': return t('commercial.authority.bauseits')
    default: return t('commercial.authority.unknown')
  }
}
