import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import DecimalCtor, { type Decimal } from 'decimal.js'
import {
  blockedVariantReason,
  changedFromSource,
  chapterRuleById,
  chapterServiceById,
  costAuthorityOf,
  dependencyBlocker,
  isApplicable,
  kgCascadeFor,
  kgChapterOverview,
  kgSystemProgress,
  proposalChanges,
  serviceContribution,
  serviceDecision as decisionOf,
  systemServices,
  type KgCascade,
  type KgChapter as KgChapterData,
  type KgScopeGroup,
  type KgService,
  type KgServiceDecisionRecord,
  type KgServiceGroup,
  type KgSystemState,
} from '../engine/kgConfiguration'
import { kgCatalogueFor, useStore } from '../state/store'
import { localizeMoneyText, useT } from '../i18n'
import { NNBSP, label as moneyLabel, present } from '../engine/money'
import { Button } from '../components/primitives'
import { CommercialNumber, signedMoneyText } from '../design-system/CommercialNumber'
import { ChoiceGroup } from '../design-system/ChoiceGroup'
import { OriginPopover } from '../components/OriginPopover'
import { Dialog } from '../components/Dialog'
import { useSemanticMotion } from '../design-system/motion'
import {
  BemusterungBoundary,
  DecisionBlock,
  DecisionValueRows,
  RahmenBand,
  SystemOverviewSummary,
  SystemRow,
  SystemRuleNote,
} from '../design-system/KGConfiguration'

/**
 * KG 400 as a SOURCE-AWARE SYSTEM CONFIGURATOR (VR3-TGA-01, frames T-01–T-08).
 *
 * The forensic audit measured this chapter rendering five rows against a
 * source of 72 parameters, with the three rows carrying the entire subtotal
 * offering no technical alternative at all. Its one-sentence finding: *the
 * product asks "shall we include heating?" where the source asks "which
 * heating system?"*.
 *
 * This composition answers the second question, in the audit's approved
 * architecture — `Rahmen · Übersicht · System`.
 *
 * IT IS NOT A SECOND KG PAGE. Everything here is driven by what a chapter's
 * own data declares: a Rahmen band exists because `chapter.rahmen` does, a
 * group becomes a system row because it declares a summary, a decision shows
 * a source line because the fixture carries one. `KgChapter.tsx` chooses
 * between this composition and the released one by asking the DATA, never by
 * asking which cost group it is — the `switch (group)` that file has always
 * forbidden stays forbidden.
 */

/**
 * Put focus on one decision's own control.
 *
 * By DECISION ID, never by node reference: every path that needs this —
 * after a cascade, after a cancelled dialogue — runs across a re-render that
 * replaces the element.
 */
function focusDecision(id: string): void {
  const node = document.querySelector<HTMLElement>(
    `[data-decision="${id}"] input:not(:disabled), [data-decision="${id}"] button`,
  )
  node?.focus()
}

/** The translator's own signature, so helpers below share it exactly. */
type TFn = (key: string, values?: Readonly<Record<string, string | number>>) => string

/**
 * Money, through the product's OWN formatter.
 *
 * `Intl.NumberFormat` with `style: 'currency'` is a second money convention:
 * it puts the symbol first in `en-GB` (`€1,390,000`) where this product
 * types money as `1.390.000 €` in German and re-typesets only the NUMERALS
 * for English (`1,390,000 €`), keeping rule 7's narrow no-break space before
 * the unit. Two conventions in one product is the defect; there is one
 * formatter and this calls it.
 */
function money(value: Decimal, language: 'de' | 'en'): string {
  return localizeMoneyText(moneyLabel(present(value)), language)
}

/** A signed effect, in the same one convention. */
function signedMoney(value: Decimal, language: 'de' | 'en'): string {
  return signedMoneyText(value, language)
}

/** The glyph that travels with a state's WORD. Never a colour alone (rule 8). */
const STATE_GLYPH: Record<KgSystemState, string> = {
  decided: '✓',
  fromSource: '○',
  open: '!',
  partial: '◐',
  notApplicable: '—',
}

export function KgSystemChapter({ chapter, group }: {
  chapter: KgChapterData
  group: KgScopeGroup
}) {
  const s = useStore()
  const t = useT()
  const { reduced, fadeRise, transition } = useSemanticMotion()
  const en = s.uiLanguage === 'en'
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig

  /** AT MOST ONE SYSTEM OPEN AT A TIME — the audit's own words. */
  const [openSystem, setOpenSystem] = useState<string | null>(null)
  const [rahmenOpen, setRahmenOpen] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [bemOpen, setBemOpen] = useState(false)
  const [pending, setPending] = useState<
    { service: KgService; next: KgServiceDecisionRecord; cascade: KgCascade } | null
  >(null)
  /**
   * ONE polite live region, and one announcement per change.
   *
   * Pairing a `role="alert"` with a polite region delivers the same sentence
   * twice — a pitfall this repository has already recorded once.
   */
  const [announcement, setAnnouncement] = useState('')
  /** The decision to focus after a cascade has made something open again. */
  const focusAfterCascade = useRef<string | null>(null)
  /**
   * WHICH decision the open dialogue belongs to.
   *
   * A ref, not the `pending` state: `Dialog` can call `onOpenChange` from its
   * own cleanup, by which point the closure's `pending` has already been
   * nulled and there is nothing left to say where focus should go back to.
   */
  const pendingDecision = useRef<string | null>(null)
  /**
   * The control the dialogue was opened FROM.
   *
   * `Dialog` restores focus itself, after its exit animation, to whatever
   * `returnFocusTo` names — so handing it the right node is both simpler and
   * correctly ordered. Racing that restore from an effect or a timer is a
   * coin flip, and it loses: the layer unmounts last.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const dialogTitleId = 'tga-cascade-title'

  const label = useCallback(
    (de: string | undefined, enText: string | undefined) => (en ? enText : de) ?? '',
    [en],
  )

  useEffect(() => { setOpenSystem(null); setRahmenOpen(null); setReviewOpen(false); setBemOpen(false) },
    [group, s.opportunityId, s.activeOptionId])

  /**
   * After a cascade, focus the first decision that has become open.
   *
   * The user changed one thing and the product changed several; landing them
   * on the first thing that now needs them is the difference between a
   * cascade that explains itself and one that merely happened.
   */
  useEffect(() => {
    const wanted = focusAfterCascade.current
    if (!wanted) return
    focusAfterCascade.current = null
    focusDecision(wanted)
  }, [openSystem, announcement, pending])

  if (!catalogue || !decisions) return null

  const overview = kgChapterOverview(catalogue, decisions, chapter)
  const changes = proposalChanges(chapter, decisions)
  const identity = `KG${NNBSP}${group.slice(3)}`

  /* ── the Rahmen band ────────────────────────────────────────────────── */

  const buildings = s.scopeBuildings.filter((b) => s.scopeSelected[b.id])
  const buildingNameOf = (id: string | undefined) =>
    (id ? s.scopeBuildings.find((b) => b.id === id)?.name : undefined) ?? id ?? ''

  const rahmenEntries = (chapter.rahmen ?? []).map((entry) => {
    /**
     * The building scope is the OPTION's, never the catalogue's.
     *
     * Writing it into the fixture would be this chapter asserting a building
     * set instead of reading the one the user confirmed — and a KG 400 framed
     * on a building set it invented is precisely the failure that blocked
     * this ticket in the first place.
     */
    const derived = entry.derive === 'buildingScope'
    const value = derived
      ? (buildings.length === 1
        ? t('vr3.tga.rahmen.buildingsOne', { name: buildings[0]!.name })
        : t('vr3.tga.rahmen.buildingsMany', { count: buildings.length }))
      : label(entry.valueDe, entry.valueEn)
    const meta = derived
      ? (buildings.length === 1
        ? (s.scopeSaved
          ? t('vr3.tga.rahmen.baselineConfirmed')
          : t('vr3.tga.rahmen.baselineOpen'))
        : buildings.map((b) => b.name).join(' · '))
      : label(entry.metaDe, entry.metaEn)
    const edited = entry.editServiceId
      ? chapterServiceById(chapter, entry.editServiceId)
      : null
    const shown = edited && !entry.valueDe
      ? currentValueOf(edited, decisions, en) ?? value
      : value
    return {
      id: entry.id,
      label: label(entry.labelDe, entry.labelEn),
      value: shown,
      meta,
      ...(edited ? {
        action: {
          label: rahmenOpen === entry.id
            ? t('vr3.tga.rahmen.close')
            : t('vr3.tga.rahmen.edit'),
          expanded: rahmenOpen === entry.id,
          onToggle: () => setRahmenOpen(rahmenOpen === entry.id ? null : entry.id),
        },
      } : {}),
    }
  })

  const openRahmenService = (() => {
    const entry = (chapter.rahmen ?? []).find((e) => e.id === rahmenOpen)
    return entry?.editServiceId
      ? chapterServiceById(chapter, entry.editServiceId)
      : null
  })()

  /* ── committing a decision, with its cascade ────────────────────────── */

  const commit = (service: KgService, next: KgServiceDecisionRecord) => {
    const cascade = kgCascadeFor(catalogue, decisions, service.id, next)
    /**
     * A MATERIAL consequence is shown BEFORE it is applied.
     *
     * The audit's step 3: a reset that destroys a priced or client-relevant
     * decision must be named first. Everything else simply happens — asking
     * about every change would make the dialogue noise, and noise is how a
     * confirmation stops being read.
     */
    if (cascade.material) {
      pendingDecision.current = service.id
      returnFocusRef.current = document.querySelector<HTMLElement>(
        `[data-decision="${service.id}"] input:not(:disabled)`,
      )
      setPending({ service, next, cascade })
      return
    }
    apply(service, next, cascade)
  }

  const apply = (
    service: KgService, next: KgServiceDecisionRecord, cascade: KgCascade,
  ) => {
    s.previewOption(null)
    s.setKgServiceDecision(service.id, next)
    const resets = cascade.entries.filter((entry) => entry.effect === 'reset')
    const name = label(service.labelDe, service.labelEn)
    setAnnouncement(resets.length === 0
      ? t('vr3.tga.cascade.announceNone', { decision: name })
      : t(resets.length === 1
        ? 'vr3.tga.cascade.announce'
        : 'vr3.tga.cascade.announcePlural', { decision: name, count: resets.length }))
    focusAfterCascade.current = resets[0]?.service.id ?? null
  }

  /* ── one decision ───────────────────────────────────────────────────── */

  const renderDecision = (service: KgService) => {
    const decision = decisionOf(decisions, service)
    const name = label(service.labelDe, service.labelEn)
    const blocker = dependencyBlocker(catalogue, decisions, service)
    const applicable = isApplicable(service)
    const authority = costAuthorityOf(service)
    const changed = changedFromSource(decisions, service)
    const rule = service.ruleId ? chapterRuleById(chapter, service.ruleId) : null

    if (!applicable) {
      return (
        <DecisionBlock
          key={service.id}
          name={name}
          notApplicable={`${t('vr3.tga.notApplicable')} — ${label(
            service.applicability?.reasonDe, service.applicability?.reasonEn,
          )}`}
        />
      )
    }

    const contribution = serviceContribution(catalogue, decisions, service)
    const control = service.kind.kind === 'singleChoice' ? (
      <div data-decision={service.id}>
        <ChoiceGroup
          legend={t('vr3.kg.service.legend', { service: name })}
          legendHidden
          density="compact"
          value={decision.state === 'selected' ? decision.variant ?? null : null}
          options={service.kind.variants.map((variant) => {
            const reason = blockedVariantReason(service, variant.value, en)
            const isStandard = service.all3Standard === variant.value
            return {
              value: variant.value,
              label: isStandard
                ? `${label(variant.labelDe, variant.labelEn)} · ${t('vr3.tga.all3Standard')}`
                : label(variant.labelDe, variant.labelEn),
              consequence: consequenceOf(variant, service, decision, t, s.uiLanguage),
              ...(reason ? { disabled: true, disabledReason: reason } : {}),
            }
          })}
          onChange={(value) => commit(service, { state: 'selected', variant: value })}
          onPreview={(value) => s.previewOption(value === null ? null : {
            kind: 'kgService', serviceId: service.id,
            value: { state: 'selected', variant: value },
          })}
        />
      </div>
    ) : service.requiresDecision ? (
      <div data-decision={service.id}>
        <ChoiceGroup
          legend={t('vr3.kg.service.legend', { service: name })}
          legendHidden
          density="compact"
          value={decision.state === 'selected' ? 'included'
            : decision.state === 'notSelected' ? 'excluded' : null}
          options={[
            {
              value: 'included' as const,
              label: t('vr3.kg.service.include'),
              consequence: authority === 'direct'
                ? undefined
                : t(`vr3.tga.price.${authority === 'bundle' ? 'bundle' : 'noBasis'}`),
            },
            { value: 'excluded' as const, label: t('vr3.kg.service.exclude') },
          ]}
          onChange={(choice) => commit(service, choice === 'included'
            ? { state: 'selected' }
            : { state: 'notSelected' })}
          onPreview={(choice) => s.previewOption(choice === null ? null : {
            kind: 'kgService', serviceId: service.id,
            value: choice === 'included' ? { state: 'selected' } : { state: 'notSelected' },
          })}
        />
      </div>
    ) : undefined

    const sourceValue = service.source?.valueDe !== undefined
      ? label(service.source.valueDe, service.source.valueEn)
      : t('vr3.tga.source.notSpecified')

    const restoreVariant = service.source?.variant
    const canRestore = changed === true && restoreVariant !== undefined
      && !blockedVariantReason(service, restoreVariant, en)

    return (
      <DecisionBlock
        key={service.id}
        name={name}
        scope={label(service.scopeDe, service.scopeEn) || undefined}
        source={service.source ? {
          label: t('vr3.tga.source.label'),
          value: sourceValue,
          origin: (
            <OriginPopover
              rows={[{
                label: t('vr3.tga.nachweis'),
                value: t(`vr3.kg.service.authority.${service.authority}`),
              }, {
                label: t('vr3.tga.source.label'),
                value: label(service.source.originDe, service.source.originEn),
              }]}
              rounding={null}
              runRef={null}
              triggerLabel={t('vr3.tga.origin')}
              accessibleName={t('vr3.tga.originOf', { decision: name })}
            />
          ),
        } : undefined}
        proposal={{
          label: t('vr3.tga.proposal.label'),
          value: decision.state === 'undecided'
            ? t('vr3.tga.proposal.open')
            : currentValueOf(service, decisions, en)
              ?? label(service.summaryDe, service.summaryEn),
        }}
        /**
         * Both answers are stated, and they look different.
         *
         * "We kept what your documents said" is as much a sales fact as "we
         * propose something else", and leaving the first one silent makes the
         * salesperson re-read the two lines above to work it out. It is
         * deliberately the QUIET one: agreement is the normal case.
         */
        matchesSource={changed === false ? t('vr3.tga.matchesSource') : undefined}
        changedFromSource={changed === true ? t('vr3.tga.changedFromSource') : undefined}
        restore={canRestore ? {
          label: t('vr3.tga.restoreSource'),
          onRestore: () => commit(service, { state: 'selected', variant: restoreVariant }),
        } : undefined}
        why={label(service.whyDe, service.whyEn) || undefined}
        control={control}
        valueRows={service.valueRows ? (
          <DecisionValueRows
            rows={service.valueRows.map((row, index) => ({
              id: `${service.id}-${index}`,
              label: row.buildingId
                ? buildingNameOf(row.buildingId)
                : label(row.labelDe, row.labelEn),
              value: label(row.valueDe, row.valueEn),
              // A number is FORMATTED here, in the reader's locale, by the
              // canonical component. A word stands in wherever an amount
              // would be a claim the product cannot make.
              amount: row.amount !== undefined
                ? (
                  <CommercialNumber
                    exact={new DecimalCtor(row.amount)}
                    language={s.uiLanguage}
                    emphasis="compact"
                  />
                )
                : label(row.noteDe, row.noteEn) || undefined,
              ...(row.status ? {
                status: {
                  glyph: row.status === 'ok' ? '✓' : '!',
                  label: row.status === 'ok'
                    ? t('vr3.tga.system.state.decided')
                    : t('vr3.tga.notApplicable'),
                  tone: row.status,
                },
              } : {}),
              notApplicable: row.notApplicable,
            }))}
          />
        ) : undefined}
        price={priceLineOf(
          service, authority, contribution, blocker !== null, t, label, s.uiLanguage,
        )}
        rule={rule ? (
          <SystemRuleNote
            title={label(rule.titleDe, rule.titleEn)}
            body={label(rule.bodyDe, rule.bodyEn)}
            note={label(rule.noteDe, rule.noteEn) || undefined}
            source={label(rule.sourceDe, rule.sourceEn)}
          />
        ) : undefined}
        note={label(service.offerNoteDe, service.offerNoteEn) || undefined}
      />
    )
  }

  /* ── one system ─────────────────────────────────────────────────────── */

  const renderSystem = (serviceGroup: KgServiceGroup) => {
    const progress = kgSystemProgress(catalogue, decisions, serviceGroup)
    const expanded = openSystem === serviceGroup.id
    const services = systemServices(serviceGroup)
    const stateLabel = progress.state === 'open'
      ? (progress.openDecisions === 1
        ? t('vr3.tga.system.state.open', { count: progress.openDecisions })
        : t('vr3.tga.system.state.openPlural', { count: progress.openDecisions }))
      : t(`vr3.tga.system.state.${progress.state}`)
    return (
      <SystemRow
        key={serviceGroup.id}
        id={serviceGroup.id}
        name={label(serviceGroup.labelDe, serviceGroup.labelEn)}
        summary={serviceGroup.applicability
          ? label(serviceGroup.applicability.reasonDe, serviceGroup.applicability.reasonEn)
          : label(serviceGroup.summaryDe, serviceGroup.summaryEn)}
        scope={label(serviceGroup.scopeDe, serviceGroup.scopeEn) || undefined}
        state={progress.state}
        stateLabel={stateLabel}
        stateGlyph={STATE_GLYPH[progress.state]}
        commercial={systemCommercialOf(progress, t, s.uiLanguage)}
        expanded={expanded}
        onToggle={() => setOpenSystem(expanded ? null : serviceGroup.id)}
      >
        <motion.div
          variants={reduced ? undefined : fadeRise}
          initial={reduced ? false : 'hidden'}
          animate={reduced ? undefined : 'visible'}
          transition={transition('reveal')}
        >
          {services.map((service) => renderDecision(service))}
        </motion.div>
      </SystemRow>
    )
  }

  /* ── the page ───────────────────────────────────────────────────────── */

  return (
    <>
      <RahmenBand entries={rahmenEntries}>
        <AnimatePresence initial={false}>
          {openRahmenService && (
            <motion.div
              key={openRahmenService.id}
              variants={reduced ? undefined : fadeRise}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? undefined : 'visible'}
              exit={reduced ? undefined : 'exit'}
              transition={transition('reveal')}
              className="a3-rahmen-open"
            >
              {renderDecision(openRahmenService)}
            </motion.div>
          )}
        </AnimatePresence>
      </RahmenBand>

      <SystemOverviewSummary
        facts={[
          { id: 'systems', count: overview.relevantSystems, label: t('vr3.tga.summary.systems') },
          { id: 'decided', count: overview.decided, label: t('vr3.tga.summary.decided') },
          { id: 'source', count: overview.fromSource, label: t('vr3.tga.summary.fromSource') },
          { id: 'open', count: overview.open, label: t('vr3.tga.summary.open') },
          { id: 'partial', count: overview.partial, label: t('vr3.tga.summary.partial') },
          { id: 'na', count: overview.notApplicable, label: t('vr3.tga.summary.notApplicable') },
          // A fact worth zero is not a fact. Printing "0 nicht anwendbar"
          // states outstanding-looking work that does not exist — and the
          // remaining counts have to ADD UP to the systems, which is why
          // `partial` is its own line rather than folded into `decided`.
        ].filter((fact) => fact.count > 0 || fact.id === 'systems')}
        total={overview.amount === null
          ? t('vr3.tga.summary.noTotal', { group: identity })
          : t('vr3.tga.summary.total', {
            group: identity,
            amount: money(overview.amount, s.uiLanguage),
          })}
      />

      {chapter.groups.map(renderSystem)}

      {/* CHANGES FROM THE CLIENT SOURCE — a first-class sales concept, and
          offered only when there are any: a review of nothing is a step. */}
      {changes.length > 0 && (
        <section className="a3-tgarev">
          <p className="a3-tgarev-h">
            <button
              type="button"
              className="a3-linkbtn hit-target"
              aria-expanded={reviewOpen}
              onClick={() => setReviewOpen(!reviewOpen)}
            >
              {changes.length === 1
                ? t('vr3.tga.review.count', { count: changes.length })
                : t('vr3.tga.review.countPlural', { count: changes.length })}
            </button>
          </p>
          {reviewOpen && (
            <ul className="a3-tgarev-list">
              {changes.map((service) => (
                <li key={service.id}>
                  <b>{label(service.labelDe, service.labelEn)}</b>
                  <span>{t('vr3.tga.review.arrow', {
                    source: label(service.source?.valueDe, service.source?.valueEn),
                    proposal: currentValueOf(service, decisions, en) ?? '',
                  })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {chapter.bemusterung && (
        <BemusterungBoundary
          detail={{
            label: bemOpen ? t('vr3.tga.rahmen.close') : t('vr3.tga.bemusterung.detail'),
            open: bemOpen,
            onToggle: () => setBemOpen(!bemOpen),
          }}
          title={label(chapter.bemusterung.titleDe, chapter.bemusterung.titleEn)}
          body={label(chapter.bemusterung.bodyDe, chapter.bemusterung.bodyEn)}
          decidedHeading={label(
            chapter.bemusterung.decidedHeadingDe, chapter.bemusterung.decidedHeadingEn,
          )}
          deferredHeading={label(
            chapter.bemusterung.deferredHeadingDe, chapter.bemusterung.deferredHeadingEn,
          )}
          rows={chapter.bemusterung.rows.map((row) => ({
            decided: label(row.decidedDe, row.decidedEn),
            deferred: label(row.deferredDe, row.deferredEn),
          }))}
        />
      )}

      <p className="sr-only" aria-live="polite">{announcement}</p>

      {/* THE CONSEQUENCE DIALOGUE — what changes, before it changes (T-04). */}
      <Dialog
        open={pending !== null}
        /**
         * Cancelling returns focus to the decision it was cancelled FROM.
         *
         * `Dialog` restores the element that had focus when it opened, and
         * that element is gone: React re-renders the radio group while the
         * dialogue is up, so the captured node fails its own `isConnected`
         * check and focus lands on `<body>` — outside the work, at the top of
         * the page. The decision has a stable id; the DOM node does not.
         */
        onOpenChange={(open) => {
          if (open) return
          const id = pendingDecision.current
          pendingDecision.current = null
          setPending(null)
          // A belt for `Dialog`'s braces: if the node it captured did not
          // survive the re-render, its own `isConnected` check declines and
          // focus would land on `<body>`. This runs after the exit animation
          // and only matters in that case.
          if (id) setTimeout(() => {
            if (document.activeElement === document.body) focusDecision(id)
          }, 260)
        }}
        labelledBy={dialogTitleId}
        returnFocusTo={returnFocusRef}
      >
        {pending && (
          <div className="a3-conseq">
            {/* `Dialog` focuses the first heading it finds, and a heading is
                not focusable without this — without it `.focus()` is a no-op
                and focus stays on `<body>`, outside the trap. The page's own
                `h1` carries the same `tabIndex={-1}` for the same reason. */}
            <h2 id={dialogTitleId} tabIndex={-1}>
              {t('vr3.tga.cascade.title', {
                decision: label(pending.service.labelDe, pending.service.labelEn),
              })}
            </h2>
            <p className="a3-conseq-lbl">{t('vr3.tga.cascade.affected')}</p>
            {pending.cascade.entries.map((entry) => (
              <div
                className="a3-conseq-row"
                key={entry.service.id}
                data-effect={entry.effect}
              >
                <span className="a3-conseq-k">
                  <b>{`KG${NNBSP}${entry.group.slice(3)}`}</b>
                  {label(entry.service.labelDe, entry.service.labelEn)}
                </span>
                <span className="a3-conseq-v">
                  <b>{t(`vr3.tga.cascade.${entry.effect}`)}</b>
                  {entry.effect === 'preserve'
                    ? t('vr3.tga.cascade.preserveWhy')
                    : t('vr3.tga.cascade.resetWhy', {
                      price: entry.currentAmount === null
                        ? t('vr3.tga.price.noBasis')
                        : money(entry.currentAmount, s.uiLanguage),
                    })}
                </span>
              </div>
            ))}
            <div className="a3-conseq-acts">
              <Button
                variant="primary"
                onClick={() => {
                  const { service, next, cascade } = pending
                  setPending(null)
                  apply(service, next, cascade)
                }}
              >
                {t('vr3.tga.cascade.confirm', {
                  decision: label(pending.service.labelDe, pending.service.labelEn),
                })}
              </Button>
              <Button onClick={() => setPending(null)}>
                {t('vr3.tga.cascade.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

/* ── the words a euro is allowed to use ────────────────────────────────── */

/** The value this decision currently holds, in the reader's language. */
function currentValueOf(
  service: KgService,
  decisions: { services: Readonly<Record<string, KgServiceDecisionRecord>> },
  en: boolean,
): string | null {
  const decision = decisions.services[service.id]
  if (service.kind.kind !== 'singleChoice') return null
  const wanted = decision?.variant ?? service.kind.baselineVariant
  const variant = service.kind.variants.find((v) => v.value === wanted)
  if (!variant) return null
  return en ? variant.labelEn : variant.labelDe
}

/**
 * What one alternative costs, in the vocabulary its authority permits.
 *
 * Never a bare zero. `± 0 €` is a positive claim that two options cost the
 * same, and it is true for almost none of them: 92.7 % of the source's option
 * rows carry no cost option at all, so "we have no separate price basis" is
 * the ordinary answer and it has to be sayable.
 */
function consequenceOf(
  variant: { value: string; delta: string; noPriceBasis?: boolean; bundled?: boolean },
  service: KgService,
  decision: KgServiceDecisionRecord,
  t: TFn,
  language: 'de' | 'en',
): string {
  if (variant.bundled) return t('vr3.tga.price.bundle')
  if (variant.noPriceBasis) return t('vr3.tga.price.noEffect')
  const current = decision.variant
    ?? (service.kind.kind === 'singleChoice' ? service.kind.baselineVariant : undefined)
  if (variant.value === current) return t('vr3.tga.price.baseline')
  const amount = Number(variant.delta)
  if (amount === 0) return t('vr3.tga.price.baseline')
  return signedMoney(new DecimalCtor(variant.delta), language)
}

/** The decision's own price line — a statement, never a blank. */
function priceLineOf(
  service: KgService,
  authority: ReturnType<typeof costAuthorityOf>,
  contribution: Decimal | null,
  blocked: boolean,
  t: TFn,
  label: (de: string | undefined, en: string | undefined) => string,
  language: 'de' | 'en',
): { label: string; value: string; muted?: boolean } | undefined {
  if (authority === 'none') return undefined
  const key = t('vr3.tga.price.label')
  if (authority === 'bauherr') {
    return { label: key, value: t('vr3.tga.price.bauherr'), muted: true }
  }
  if (authority === 'noBasis') {
    const basis = label(service.costBasisDe, service.costBasisEn)
    return {
      label: key,
      value: basis ? `${t('vr3.tga.price.noBasis')} · ${basis}` : t('vr3.tga.price.noBasis'),
      muted: true,
    }
  }
  if (authority === 'bundle') {
    const basis = label(service.costBasisDe, service.costBasisEn)
    return {
      label: key,
      value: basis
        ? t('vr3.tga.price.bundleNamed', { basis })
        : t('vr3.tga.price.bundle'),
      muted: true,
    }
  }
  if (authority === 'indirect') {
    return { label: key, value: t('vr3.tga.price.indirect'), muted: true }
  }
  if (blocked || contribution === null || contribution.isZero()) {
    /**
     * PRICED, BUT NOT ON THIS LINE.
     *
     * A decision like `Anlagenkonzept` carries no amount of its own — its
     * money lives in the alternatives, each of which states its own effect in
     * the control above. Printing `direkt bepreist · 0 €` here says the
     * decision costs nothing, which is the opposite of true: it is the single
     * most expensive decision in the system.
     */
    return { label: key, value: t('vr3.tga.price.direct'), muted: true }
  }
  return {
    label: key,
    value: `${t('vr3.tga.price.direct')} · ${money(contribution, language)}`,
  }
}

/** The system row's commercial cell — an amount, or the state in words. */
function systemCommercialOf(
  progress: ReturnType<typeof kgSystemProgress>,
  t: TFn,
  language: 'de' | 'en',
) {
  if (progress.state === 'notApplicable') return null
  /**
   * A ZERO SUM IS NOT A PRICE.
   *
   * A system whose priced decision is still open sums its remaining
   * read-only rows to exactly 0, and rendering that as `0 €` states that the
   * system costs nothing — the "unknown as zero" defect (rule 16), on the
   * most scannable number in the overview. The cost STATE is the honest
   * answer until a priced decision is actually taken.
   */
  if (progress.amount !== null && !progress.amount.isZero()
    && progress.costAuthority === 'direct') {
    return (
      <CommercialNumber
        exact={progress.amount}
        language={language}
        emphasis="compact"
        absentLabel={t('vr3.tga.price.noBasis')}
      />
    )
  }
  if (progress.costAuthority === 'bauherr') return t('vr3.tga.price.bauherr')
  if (progress.costAuthority === 'bundle') return t('vr3.tga.price.bundle')
  if (progress.costAuthority === 'direct') return t('vr3.tga.price.direct')
  return t('vr3.tga.price.noBasis')
}
