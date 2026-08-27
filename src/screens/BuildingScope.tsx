import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Decimal } from 'decimal.js'
import type { BuildingInput } from '../engine/calculate'
import { NNBSP, formatDE } from '../engine/money'
import {
  buildingConfirmed,
  includedBuildingIds,
  LABEL_UG,
  useStore,
  type BuildingReviewSection,
} from '../state/store'
import { RadioCardGroup } from '../components/controls'
import { optionImage } from '../assets/option-images'
import { MediaFrame } from '../design-system/MediaFrame'
import {
  BUILDING_FACT_KEYS,
  deriveConflictState,
  effectiveDerivedArea,
  effectiveFactValue,
  type BuildingConflict,
  type BuildingFact,
  type BuildingFactKey,
  type BuildingFactValueMap,
  type DerivedAreaKey,
  type FactSource,
} from '../state/buildingReview'
import {
  Badge,
  DisclosureRow,
  FormField,
  PageHeader,
  ReadinessChecklist,
  SectionSheet,
  SelectField,
} from '../components/designSystem'
import {
  Button,
  NumericField,
  ProvenanceChip,
  parseNumericInput,
  rejectNumericInput,
  type ProvenancePresentation,
} from '../components/primitives'
import { DataStateBlock, DataStateBoundary, EmptyState } from '../components/DataStates'
import { useT } from '../i18n'
import { signed } from '../components/OfferPanel'

const FORM_VALUES: ReadonlyArray<BuildingInput['gebaeudeform']> = [
  'MFH', 'EFH_ZFH', 'DH_REH', 'BUERO',
]
const CLASS_VALUES: ReadonlyArray<BuildingInput['gebaeudeklasse']['value']> = [
  'GK_1_3', 'GK_4', 'GK_5',
]
const DERIVED_KEYS = new Set<BuildingFactKey>([
  'bgfRSAbove', 'bgfRSBelow', 'bgfRSTotal',
])

const FORM_MESSAGE: Record<BuildingInput['gebaeudeform'], string> = {
  MFH: 'buildingScope.form.mfh',
  EFH_ZFH: 'buildingScope.form.efh',
  DH_REH: 'buildingScope.form.row',
  BUERO: 'buildingScope.form.office',
}
const CLASS_MESSAGE: Record<BuildingInput['gebaeudeklasse']['value'], string> = {
  GK_1_3: 'buildingScope.class.gk13',
  GK_4: 'buildingScope.class.gk4',
  GK_5: 'buildingScope.class.gk5',
}
const FACT_MESSAGE: Record<BuildingFactKey, string> = {
  documentationName: 'buildingScope.fact.name',
  address: 'buildingScope.fact.address',
  buildingForm: 'buildingScope.fact.form',
  buildingClass: 'buildingScope.fact.class',
  bgfRAbove: 'buildingScope.fact.bgfRAbove',
  bgfSAbove: 'buildingScope.fact.bgfSAbove',
  bgfRSAbove: 'buildingScope.fact.bgfRSAbove',
  bgfRBelow: 'buildingScope.fact.bgfRBelow',
  bgfSBelow: 'buildingScope.fact.bgfSBelow',
  bgfRSBelow: 'buildingScope.fact.bgfRSBelow',
  bgfRSTotal: 'buildingScope.fact.bgfRSTotal',
  wfl: 'buildingScope.fact.wfl',
  nuf: 'buildingScope.fact.nuf',
  units: 'buildingScope.fact.units',
  storeyStructure: 'buildingScope.fact.storeys',
}

/**
 * Exported for the Project Card / preparation surface (Task 01,
 * deep-coherence audit): the read-only project summary shows the same
 * per-building facts this screen reviews, and must render their provenance
 * the same way — one presentation function, not a second hand-written copy.
 */
export function stableName(
  review: ReturnType<typeof useStore.getState>['buildingReviews'][string],
  fallback: string,
): string {
  return effectiveFactValue(review.facts.documentationName) ?? fallback
}

function sourcePresentation(
  source: FactSource,
  t: ReturnType<typeof useT>,
): ProvenancePresentation | null {
  switch (source.kind) {
    case 'document':
      return { kind: 'document', label: t('buildingScope.provenance.document') }
    case 'customer':
      return {
        kind: 'customerConfirmed',
        label: t('buildingScope.provenance.customer'),
      }
    case 'derived':
      return { kind: 'derived', label: t('buildingScope.provenance.derived') }
    case 'unknown':
      return null
  }
}

export function factPresentation<T>(
  fact: BuildingFact<T>,
  t: ReturnType<typeof useT>,
): ProvenancePresentation | null {
  if (fact.override) {
    return fact.override.actor === 'customer confirmation'
      ? { kind: 'customerConfirmed', label: t('buildingScope.provenance.customer') }
      : { kind: 'manual', label: t('buildingScope.provenance.manual') }
  }
  return sourcePresentation(fact.extracted.source, t)
}

function openConflictsFor(
  state: ReturnType<typeof useStore.getState>,
  buildingId: string,
): BuildingConflict[] {
  return Object.values(state.buildingConflicts).filter(
    (conflict) => conflict.buildingId === buildingId
      && deriveConflictState(conflict).status === 'open',
  )
}

function statusFor(
  state: ReturnType<typeof useStore.getState>,
  buildingId: string,
): 'confirmed' | 'conflict' | 'open' {
  if (buildingConfirmed(state, buildingId)) return 'confirmed'
  return openConflictsFor(state, buildingId).length > 0 ? 'conflict' : 'open'
}

function StatusBadge({ status }: { status: ReturnType<typeof statusFor> }) {
  const t = useT()
  if (status === 'confirmed') {
    return <Badge sign="✓">{t('buildingScope.status.confirmed')}</Badge>
  }
  if (status === 'conflict') {
    return <Badge sign="▲">{t('buildingScope.status.conflict')}</Badge>
  }
  return <Badge sign="○">{t('buildingScope.status.open')}</Badge>
}

type ReviewSectionKey = BuildingReviewSection
type ReviewSectionStatus = 'notReviewed' | 'needsAttention' | 'ready' | 'confirmed' | 'changed'

const REVIEW_SECTIONS: ReadonlyArray<ReviewSectionKey> = ['identity', 'areas', 'storeys']
const IDENTITY_FACTS: ReadonlyArray<BuildingFactKey> = [
  'documentationName', 'address', 'buildingForm', 'buildingClass', 'units',
]
const AREA_FACTS: ReadonlyArray<BuildingFactKey> = [
  'bgfRAbove', 'bgfSAbove', 'bgfRSAbove', 'bgfRBelow', 'bgfSBelow',
  'bgfRSBelow', 'bgfRSTotal', 'wfl', 'nuf',
]
const BLOCKING_FACTS: Record<ReviewSectionKey, ReadonlyArray<BuildingFactKey>> = {
  identity: ['documentationName', 'buildingForm', 'buildingClass'],
  areas: ['bgfRAbove', 'bgfSAbove', 'bgfRSBelow'],
  storeys: [],
}

function reviewValueFingerprint(value: unknown): string {
  if (value === null || value === undefined) return 'unknown'
  if (value instanceof Decimal) return value.toFixed()
  return JSON.stringify(value)
}

function reviewSectionFingerprint(
  review: ReturnType<typeof useStore.getState>['buildingReviews'][string],
  conflicts: ReturnType<typeof useStore.getState>['buildingConflicts'],
  section: ReviewSectionKey,
): string {
  const keys = section === 'identity' ? IDENTITY_FACTS
    : section === 'areas' ? AREA_FACTS
      : ['storeyStructure'] as const
  return keys.map((key) => {
    const fact = review.facts[key] as BuildingFact<unknown>
    const value = DERIVED_KEYS.has(key)
      ? effectiveDerivedArea(review, conflicts, key as DerivedAreaKey).value
      : fact.override?.value ?? fact.extracted.value
    return `${key}:${reviewValueFingerprint(value)}`
  }).join('|')
}

function sectionForFact(key: BuildingFactKey | DerivedAreaKey): ReviewSectionKey {
  if (key === 'storeyStructure') return 'storeys'
  return IDENTITY_FACTS.includes(key as BuildingFactKey) ? 'identity' : 'areas'
}

function sectionHasBlockingMissingValue(
  review: ReturnType<typeof useStore.getState>['buildingReviews'][string],
  section: ReviewSectionKey,
): boolean {
  return BLOCKING_FACTS[section].some((key) =>
    effectiveFactValue(review.facts[key] as BuildingFact<unknown>) === null)
}

function sectionHasAnyValue(
  review: ReturnType<typeof useStore.getState>['buildingReviews'][string],
  section: ReviewSectionKey,
): boolean {
  const keys = section === 'identity' ? IDENTITY_FACTS
    : section === 'areas' ? AREA_FACTS
      : ['storeyStructure'] as const
  return keys.some((key) =>
    effectiveFactValue(review.facts[key] as BuildingFact<unknown>) !== null)
}

export function BuildingScope() {
  const s = useStore()
  const t = useT()
  const buildingIds = Object.keys(s.buildings)
  const selectedIds = includedBuildingIds(s)
  const selectedCount = selectedIds.length
  const confirmedCount = selectedIds.filter((id) => buildingConfirmed(s, id)).length
  const invalidatedConfigurationIds = selectedIds.filter((id) =>
    s.buildingConfigState[id]?.status === 'confirmed' && !buildingConfirmed(s, id))
  const invalidatedConfigurationNames = new Intl.ListFormat(
    s.uiLanguage === 'de' ? 'de-DE' : 'en-GB',
    { style: 'long', type: 'conjunction' },
  ).format(invalidatedConfigurationIds.map((id) =>
    stableName(s.buildingReviews[id]!, id)))
  const [focusedTabId, setFocusedTabId] = useState(
    selectedIds.includes(s.activeBuildingId) ? s.activeBuildingId : selectedIds[0] ?? '',
  )
  const [announcement, setAnnouncement] = useState('')
  const tablistRef = useRef<HTMLDivElement>(null)
  const previousConfirmed = useRef<Record<string, boolean> | null>(null)

  useEffect(() => {
    if (selectedIds.length === 0) {
      if (focusedTabId !== '') setFocusedTabId('')
      return
    }
    if (!selectedIds.includes(s.activeBuildingId)) {
      s.setActiveBuilding(selectedIds[0]!)
    }
    if (!selectedIds.includes(focusedTabId)) {
      setFocusedTabId(selectedIds.includes(s.activeBuildingId)
        ? s.activeBuildingId
        : selectedIds[0]!)
    }
  }, [focusedTabId, s, selectedIds])

  const confirmationSignature = buildingIds
    .map((id) => `${id}:${buildingConfirmed(s, id) ? '1' : '0'}`)
    .join('|')
  useEffect(() => {
    const current = Object.fromEntries(
      buildingIds.map((id) => [id, buildingConfirmed(s, id)]),
    )
    if (previousConfirmed.current) {
      const invalidated = buildingIds.find(
        (id) => previousConfirmed.current?.[id] && !current[id],
      )
      if (invalidated) {
        setAnnouncement(t('buildingScope.announcement.invalidated', {
          building: stableName(s.buildingReviews[invalidated]!, invalidated),
        }))
      }
    }
    previousConfirmed.current = current
  }, [buildingIds, confirmationSignature, s, t])

  const toggleBuilding = (id: string) => {
    const nextSelected = s.included[id]
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id].sort(
        (a, b) => buildingIds.indexOf(a) - buildingIds.indexOf(b),
      )
    if (s.included[id] && s.activeBuildingId === id) {
      const removedIndex = buildingIds.indexOf(id)
      const nearest = nextSelected.find(
        (item) => buildingIds.indexOf(item) >= removedIndex,
      ) ?? nextSelected.at(-1)
      if (nearest) s.setActiveBuilding(nearest)
    } else if (!s.included[id] && selectedIds.length === 0) {
      s.setActiveBuilding(id)
    }
    s.toggleBuildingIncluded(id)
    const name = stableName(s.buildingReviews[id]!, id)
    setAnnouncement(t(
      s.included[id]
        ? 'buildingScope.announcement.removed'
        : 'buildingScope.announcement.added',
      { building: name },
    ))
  }

  // F07-class defect: the active building tab could be off-screen at rest
  // (only the scroll arrows hinting more exists) — reachable, but not
  // identifiable at a glance (AC-03). Bring it into view whenever the
  // selection changes, not only when reached via arrow/keyboard focus.
  const activeTabId = selectedIds.includes(s.activeBuildingId) ? s.activeBuildingId : ''
  const selectedSignature = selectedIds.join('|')
  useEffect(() => {
    if (!activeTabId) return
    const index = selectedIds.indexOf(activeTabId)
    if (index < 0) return
    const tabs = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeTabId, selectedSignature])

  const moveTabFocus = (index: number) => {
    const id = selectedIds[index]
    if (!id) return
    setFocusedTabId(id)
    const tabs = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[index]?.focus()
    tabs?.[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = Math.max(selectedIds.indexOf(focusedTabId), 0)
    const last = selectedIds.length - 1
    const next = event.key === 'ArrowRight' ? (currentIndex + 1) % selectedIds.length
      : event.key === 'ArrowLeft'
        ? (currentIndex - 1 + selectedIds.length) % selectedIds.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? last
            : null
    if (next !== null) {
      event.preventDefault()
      moveTabFocus(next)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      s.setActiveBuilding(selectedIds[currentIndex]!)
    }
  }

  return (
    <div className="px-7 py-6">
      <PageHeader
        title={t('buildingScope.title')}
        meta={t('buildingScope.meta', {
          confirmed: confirmedCount,
          selected: selectedCount,
        })}
        lede={t('buildingScope.lede')}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {invalidatedConfigurationIds.length > 0 && (
        <div className="pt-5">
          <DataStateBlock
            state="stale"
            sentence={t('buildingScope.recovery.title', {
              buildings: invalidatedConfigurationNames,
            })}
            detail={t('buildingScope.recovery.detail')}
            remedy={t('buildingScope.recovery.remedy')}
          />
        </div>
      )}

      <div className="py-5">
        <SectionSheet
          title={t('buildingScope.selection.title')}
          intro={t('buildingScope.selection.intro')}
        >
          <DataStateBoundary
            label={t('buildingScope.selection.dataLabel')}
            state={{ status: 'ready', data: buildingIds }}
            renderReady={(ids) => (
              <ul className="mt-3 border-t border-border-subtle">
                {ids.map((id) => {
                  const review = s.buildingReviews[id]!
                  const name = stableName(review, id)
                  const address = effectiveFactValue(review.facts.address)
                  const form = effectiveFactValue(review.facts.buildingForm)
                  const buildingClass = effectiveFactValue(review.facts.buildingClass)
                  const gfa = effectiveDerivedArea(
                    review, s.buildingConflicts, 'bgfRSTotal',
                  ).value
                  const wfl = effectiveFactValue(review.facts.wfl)
                  const nuf = effectiveFactValue(review.facts.nuf)
                  const units = effectiveFactValue(review.facts.units)
                  const area = wfl ?? nuf
                  const areaLabel = t(wfl
                    ? 'buildingScope.fact.wfl'
                    : 'buildingScope.fact.nuf')
                  // REDESIGN R2 §4 "BUILDINGCARD": the same data this row
                  // already read (checkbox/StatusBadge/FactSummary triple/
                  // form+class caption, all unchanged) composed as an
                  // object with a face — never a real photograph (no
                  // truthful per-building imagery exists; a random
                  // architecture photo would falsely imply the building's
                  // actual design), so the fallback art IS the canonical
                  // identity treatment here, not a placeholder-for-later.
                  return (
                    <li key={id} className="border-b border-border-subtle py-4">
                      <div className="flex flex-wrap items-start gap-4">
                        {/* `w-8` = `--space-8` (64px) — the project's spacing
                            scale stops at 8 (theme.spacing is a full
                            replacement, not `extend`, per tailwind.config.ts;
                            `w-24` silently resolves to nothing and collapses
                            the tile to 0×0, caught visually via Playwright). */}
                        <div className="w-8 shrink-0">
                          <MediaFrame ratio="tile" state="fallback" seed={name} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <label className="flex min-h-hit-target min-w-0 cursor-pointer items-center gap-3 text-body font-medium text-text-primary">
                              <input
                                type="checkbox"
                                checked={s.included[id] === true}
                                onChange={() => toggleBuilding(id)}
                                className="h-4 w-4 shrink-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                              />
                              <span className="min-w-0 break-words">{name}</span>
                            </label>
                            <StatusBadge status={statusFor(s, id)} />
                          </div>
                          <p className="mt-1 text-small text-text-muted">
                            {[form ? t(FORM_MESSAGE[form]) : null,
                              buildingClass ? t(CLASS_MESSAGE[buildingClass]) : null, address]
                              .filter(Boolean).join(' · ')}
                          </p>
                          <dl className="mt-3 grid grid-cols-3 gap-3 text-small text-text-secondary">
                            <FactSummary
                              label={t('buildingScope.fact.bgfRSTotal')}
                              value={gfa ? `${formatDE(gfa, 0)}${NNBSP}m²` : t('buildingScope.value.notCaptured')}
                            />
                            <FactSummary
                              label={areaLabel}
                              value={area ? `${formatDE(area, 0)}${NNBSP}m²` : t('buildingScope.value.notCaptured')}
                            />
                            <FactSummary
                              label={t('buildingScope.fact.units')}
                              value={units ? formatDE(units, 0) : t('buildingScope.value.notCaptured')}
                            />
                          </dl>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          />
        </SectionSheet>

        <SectionSheet
          title={t('buildingScope.review.title')}
          intro={t('buildingScope.review.intro')}
        >
          {selectedIds.length === 0 ? (
            <EmptyState>{t('buildingScope.review.empty')}</EmptyState>
          ) : (
            <>
              <div className="flex min-w-0 items-stretch gap-1">
                {selectedIds.length > 1 && (
                  <Button
                    variant="ghost"
                    aria-label={t('buildingScope.tabs.first')}
                    onClick={() => moveTabFocus(0)}
                  >
                    ←
                  </Button>
                )}
                <div
                  ref={tablistRef}
                  role="tablist"
                  aria-label={t('buildingScope.tabs.label')}
                  className="a3-tabs min-w-0 flex-1 flex-nowrap overflow-x-auto whitespace-nowrap"
                  onKeyDown={handleTabKey}
                >
                  {selectedIds.map((id, index) => {
                    const name = stableName(s.buildingReviews[id]!, id)
                    const selected = s.activeBuildingId === id
                    const status = statusFor(s, id)
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`building-tab-${id}`}
                        aria-selected={selected}
                        aria-controls={`building-panel-${id}`}
                        aria-posinset={index + 1}
                        aria-setsize={selectedIds.length}
                        tabIndex={focusedTabId === id ? 0 : -1}
                        onClick={() => {
                          setFocusedTabId(id)
                          s.setActiveBuilding(id)
                        }}
                        className="shrink-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                      >
                        {name}{NNBSP}·{NNBSP}
                        {t(status === 'confirmed'
                          ? 'buildingScope.status.confirmed'
                          : status === 'conflict'
                            ? 'buildingScope.status.conflict'
                            : 'buildingScope.status.open')}
                      </button>
                    )
                  })}
                </div>
                {selectedIds.length > 1 && (
                  <Button
                    variant="ghost"
                    aria-label={t('buildingScope.tabs.last')}
                    onClick={() => moveTabFocus(selectedIds.length - 1)}
                  >
                    →
                  </Button>
                )}
              </div>

              {selectedIds.map((id) => (
                <div
                  key={id}
                  role="tabpanel"
                  id={`building-panel-${id}`}
                  aria-labelledby={`building-tab-${id}`}
                  hidden={s.activeBuildingId !== id}
                  className="a3-tabpane"
                >
                  <BuildingReviewPanel
                    buildingId={id}
                    announce={setAnnouncement}
                  />
                </div>
              ))}
            </>
          )}
        </SectionSheet>
      </div>
    </div>
  )
}

function FactSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-1">
      <dt className="font-medium text-text-primary">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  )
}

function BuildingReviewPanel({
  buildingId,
  announce,
}: {
  buildingId: string
  announce: (message: string) => void
}) {
  const s = useStore()
  const t = useT()
  const review = s.buildingReviews[buildingId]!
  const confirmed = buildingConfirmed(s, buildingId)
  const conflicts = Object.values(s.buildingConflicts)
    .filter((conflict) => conflict.buildingId === buildingId)
  const openConflicts = conflicts.filter(
    (conflict) => deriveConflictState(conflict).status === 'open',
  )
  const missingCount = BUILDING_FACT_KEYS.filter((key) => {
    if (DERIVED_KEYS.has(key)) {
      return effectiveDerivedArea(review, s.buildingConflicts, key as DerivedAreaKey).value === null
    }
    const fact = review.facts[key]
    return (fact.override?.value ?? fact.extracted.value) === null
  }).length
  const confirmationRef = useRef<HTMLParagraphElement>(null)
  const [focusConfirmation, setFocusConfirmation] = useState(false)
  const sectionFingerprints: Record<ReviewSectionKey, string> = {
    identity: reviewSectionFingerprint(review, s.buildingConflicts, 'identity'),
    areas: reviewSectionFingerprint(review, s.buildingConflicts, 'areas'),
    storeys: reviewSectionFingerprint(review, s.buildingConflicts, 'storeys'),
  }
  const [openSections, setOpenSections] = useState<Record<ReviewSectionKey, boolean>>({
    identity: true,
    areas: false,
    storeys: false,
  })

  const sectionHasConflict = (section: ReviewSectionKey) => openConflicts.some(
    (conflict) => sectionForFact(conflict.factKey) === section,
  )
  const sectionStatus = (section: ReviewSectionKey): ReviewSectionStatus => {
    if (sectionHasConflict(section) || sectionHasBlockingMissingValue(review, section)) {
      return 'needsAttention'
    }
    const saved = s.buildingSectionConfirmations[buildingId]?.[section]
    if (saved) {
      return saved.fingerprint === sectionFingerprints[section] ? 'confirmed' : 'changed'
    }
    return sectionHasAnyValue(review, section) ? 'ready' : 'notReviewed'
  }
  // Task 02 (F-22): a building is blocked from confirming only by a
  // section that genuinely `needsAttention` (open conflict or a blocking
  // required value still missing) — never by a section that is merely
  // `notReviewed`/`ready`. Those get confirmed as part of the single
  // building-level action below, not by a separate manual click each.
  const anySectionBlocked = REVIEW_SECTIONS.some(
    (section) => sectionStatus(section) === 'needsAttention',
  )
  const confirmSection = (section: ReviewSectionKey) => {
    if (sectionHasConflict(section) || sectionHasBlockingMissingValue(review, section)) return
    s.confirmBuildingSection(buildingId, section, sectionFingerprints[section])
  }

  useEffect(() => {
    if (focusConfirmation && confirmed) {
      confirmationRef.current?.focus({ preventScroll: true })
      setFocusConfirmation(false)
    }
  }, [confirmed, focusConfirmation])

  // Task 02 (F-22): one action confirms every section still `ready`/
  // `changed`/`notReviewed`-but-non-blocking, THEN finalizes the building —
  // each section keeps its own fingerprint/journal event (M-4, un-confirm-
  // on-edit), only the number of clicks to reach them changed. A section
  // already `'confirmed'` is skipped (`confirmBuildingSection` itself is
  // also a no-op on an unchanged fingerprint) so re-clicking never
  // re-writes an already-current section.
  const confirm = () => {
    REVIEW_SECTIONS.forEach((section) => {
      if (sectionStatus(section) !== 'confirmed') confirmSection(section)
    })
    s.confirmBuilding(buildingId)
    setFocusConfirmation(true)
    announce(t('buildingScope.announcement.confirmed', {
      building: stableName(review, buildingId),
    }))
  }

  return (
    <div className="grid gap-6">
      {openConflicts.length > 0 && (
        <div className="grid gap-3">
          <DataStateBlock
            state="error"
            sentence={openConflicts.length === 1
              ? t('buildingScope.confirm.conflictReasonOne')
              : t('buildingScope.confirm.conflictReason', { count: openConflicts.length })}
            detail={t('buildingScope.recovery.detail')}
            impact={t('buildingScope.recovery.title', { buildings: stableName(review, buildingId) })}
            remedy={t('buildingScope.recovery.remedy')}
            retryPolicy={t('buildingScope.confirm.includesClass')}
          />
          {openConflicts.map((conflict) => (
            <ConflictDecision key={conflict.id} conflict={conflict} />
          ))}
        </div>
      )}

      <div className="a3-tbl-scroll">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('buildingScope.review.title')}</caption>
          <tbody>
            <ReviewDisclosure
              section="identity"
              label={t('buildingScope.group.identity')}
              summary={identitySectionSummary(review, t)}
              status={sectionStatus('identity')}
              open={openSections.identity}
              onOpenChange={(open) => setOpenSections((current) => ({ ...current, identity: open }))}
            >
              <div className="grid gap-4 p-4">
                <TextFactField buildingId={buildingId} factKey="documentationName" />
                <TextFactField buildingId={buildingId} factKey="address" />
                <SelectFactField buildingId={buildingId} factKey="buildingForm"
                  values={FORM_VALUES} messageFor={(value) => FORM_MESSAGE[value]} />
                <SelectFactField buildingId={buildingId} factKey="buildingClass"
                  values={CLASS_VALUES} messageFor={(value) => CLASS_MESSAGE[value]}
                  helper={t('buildingScope.class.helper')} />
                <DecimalFactField buildingId={buildingId} factKey="units" integer />
              </div>
            </ReviewDisclosure>
            <ReviewDisclosure
              section="areas"
              label={t('buildingScope.group.total')}
              summary={areaSectionSummary(review, s.buildingConflicts, t)}
              status={sectionStatus('areas')}
              open={openSections.areas}
              onOpenChange={(open) => setOpenSections((current) => ({ ...current, areas: open }))}
            >
              <div className="grid gap-4 p-4">
                <section aria-labelledby={`areas-above-${buildingId}`} className="grid gap-4">
                  <h4 id={`areas-above-${buildingId}`} className="text-heading-3 font-bold text-text-primary">
                    {t('buildingScope.areas.above')}
                  </h4>
                  <DecimalFactField buildingId={buildingId} factKey="bgfRAbove" unit="m²" />
                  <DecimalFactField buildingId={buildingId} factKey="bgfSAbove" unit="m²" />
                  <DecimalFactField buildingId={buildingId} factKey="bgfRSAbove" unit="m²" derived />
                </section>
                <section aria-labelledby={`areas-below-${buildingId}`} className="grid gap-4">
                  <h4 id={`areas-below-${buildingId}`} className="text-heading-3 font-bold text-text-primary">
                    {t('buildingScope.areas.below')}
                  </h4>
                  <DecimalFactField buildingId={buildingId} factKey="bgfRBelow" unit="m²" />
                  <DecimalFactField buildingId={buildingId} factKey="bgfSBelow" unit="m²" />
                  <DecimalFactField buildingId={buildingId} factKey="bgfRSBelow" unit="m²" derived />
                </section>
                <section aria-labelledby={`areas-total-${buildingId}`} className="grid gap-4">
                  <h4 id={`areas-total-${buildingId}`} className="text-heading-3 font-bold text-text-primary">
                    {t('buildingScope.areas.totals')}
                  </h4>
                  <DecimalFactField buildingId={buildingId} factKey="bgfRSTotal" unit="m²" derived />
                  <DecimalFactField buildingId={buildingId} factKey="wfl" unit="m²" />
                  <DecimalFactField buildingId={buildingId} factKey="nuf" unit="m²" />
                </section>
              </div>
            </ReviewDisclosure>
            <ReviewDisclosure
              section="storeys"
              label={t('buildingScope.group.storeys')}
              summary={(() => {
                const storeyCount = effectiveFactValue(review.facts.storeyStructure)
                return storeyCount === null
                  ? t('buildingScope.value.storeysMissing')
                  : formatDE(storeyCount, 0)
              })()}
              status={sectionStatus('storeys')}
              open={openSections.storeys}
              onOpenChange={(open) => setOpenSections((current) => ({ ...current, storeys: open }))}
            >
              <div className="p-4">
                {/* #16 Part 8: one user-facing field (`storeyStructure` is now
                    a plain Decimal count, no more per-kind UG/EG/OG/SG
                    breakdown) — the canonical `DecimalFactField` used by
                    every other numeric building fact applies unchanged, no
                    bespoke editor needed any more. `UntergeschossEditor`
                    below is a DIFFERENT, unrelated basement-construction
                    pricing scope control and stays visually/functionally
                    distinct from it. */}
                <DecimalFactField buildingId={buildingId} factKey="storeyStructure" integer />
                <UntergeschossEditor buildingId={buildingId} />
              </div>
            </ReviewDisclosure>
          </tbody>
        </table>
      </div>

      <section className="border-t border-border-strong pt-5" aria-label={t('buildingScope.confirm.section')}>
        {missingCount > 0 && (
          <p className="mb-3 text-small text-text-secondary">
            <span aria-hidden="true">▲ </span>
            {t('buildingScope.confirm.missingWarning', { count: missingCount })}
          </p>
        )}
        {confirmed ? (
          <p
            ref={confirmationRef}
            tabIndex={-1}
            className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span aria-hidden="true">✓ </span>
            <strong>{t('buildingScope.confirm.confirmed')}</strong>
          </p>
        ) : (
          <div className="grid gap-3">
            <p className="text-small text-text-secondary">
              {t('buildingScope.confirm.includesClass')}
            </p>
            <Button
              variant="primary"
              onClick={confirm}
              disabled={openConflicts.length > 0 || anySectionBlocked}
              disabledReason={openConflicts.length > 0
                ? (openConflicts.length === 1
                  ? t('buildingScope.confirm.conflictReasonOne')
                  : t('buildingScope.confirm.conflictReason', {
                    count: openConflicts.length,
                  }))
                : anySectionBlocked
                  ? t('buildingScope.confirm.sectionsReason')
                  : undefined}
            >
              {t('buildingScope.confirm.action')}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Task 02 (deep-coherence audit, F-22): a section used to carry its own
 * independent "confirm" action — 3 per building, plus the final "Gebäude
 * bestätigen" gate on top, required all 3 pre-confirmed = 4 clicks per
 * building (8 for Nordfeld's two). A section is status-only display now;
 * the single building-level confirm button (`BuildingReviewPanel`) reviews
 * and finalizes every ready section in one action (AC5: exactly one
 * confirmation action per building; an all-unknown optional section
 * demands none). `sectionStatus` and its underlying per-section fingerprint
 * (`buildingSectionConfirmations`, un-confirm-on-edit) are unchanged — only
 * the number of independent user actions to reach `'confirmed'` changed.
 */
function ReviewDisclosure({
  section,
  label,
  summary,
  status,
  open,
  onOpenChange,
  children,
}: {
  section: ReviewSectionKey
  label: string
  summary: string
  status: ReviewSectionStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const t = useT()
  const statusKey = {
    notReviewed: 'buildingScope.sectionStatus.notReviewed',
    needsAttention: 'buildingScope.sectionStatus.needsAttention',
    ready: 'buildingScope.sectionStatus.ready',
    confirmed: 'buildingScope.sectionStatus.confirmed',
    changed: 'buildingScope.sectionStatus.changed',
  } as const
  const sign = status === 'confirmed' ? '✓'
    : status === 'needsAttention' || status === 'changed' ? '▲'
      : status === 'ready' ? '→' : '○'
  return (
    <DisclosureRow
      label={label}
      cells={[
        <span key={`${section}-summary`} className="text-small text-text-secondary">{summary}</span>,
        <Badge key={`${section}-status`} sign={sign}>
          {t(statusKey[status])}
        </Badge>,
      ]}
      open={open}
      onOpenChange={onOpenChange}
    >
      {children}
    </DisclosureRow>
  )
}

function identitySectionSummary(
  review: ReturnType<typeof useStore.getState>['buildingReviews'][string],
  t: ReturnType<typeof useT>,
): string {
  const form = effectiveFactValue(review.facts.buildingForm)
  const units = effectiveFactValue(review.facts.units)
  return [
    form ? t(FORM_MESSAGE[form]) : t('buildingScope.value.notCaptured'),
    `${t('buildingScope.fact.units')}: ${units ? formatDE(units, 0) : t('buildingScope.value.notCaptured')}`,
  ].join(' · ')
}

function areaSectionSummary(
  review: ReturnType<typeof useStore.getState>['buildingReviews'][string],
  conflicts: ReturnType<typeof useStore.getState>['buildingConflicts'],
  t: ReturnType<typeof useT>,
): string {
  const total = effectiveDerivedArea(review, conflicts, 'bgfRSTotal').value
  const wfl = effectiveFactValue(review.facts.wfl)
  const nuf = effectiveFactValue(review.facts.nuf)
  const usable = wfl ?? nuf
  return [
    `${t('buildingScope.fact.bgfRSTotal')}: ${total ? `${formatDE(total, 0)}${NNBSP}m²` : t('buildingScope.value.notCaptured')}`,
    `${t(wfl ? 'buildingScope.fact.wfl' : 'buildingScope.fact.nuf')}: ${usable ? `${formatDE(usable, 0)}${NNBSP}m²` : t('buildingScope.value.notCaptured')}`,
  ].join(' · ')
}

function TextFactField({
  buildingId,
  factKey,
}: {
  buildingId: string
  factKey: 'documentationName' | 'address'
}) {
  const s = useStore()
  const t = useT()
  const id = useId()
  const fact = s.buildingReviews[buildingId]!.facts[factKey]
  const current = effectiveFactValue(fact)
  const [draft, setDraft] = useState(current ?? '')
  const [attempted, setAttempted] = useState(false)
  // Tracks an uncommitted, in-progress edit so a `current` change triggered
  // for an unrelated reason (e.g. a live re-analysis update elsewhere) can
  // never silently discard it (M-1/D-08). Only an explicit commit or Escape
  // clears it; building/field identity changes always resync regardless,
  // since each building panel is a permanently mounted instance and never
  // actually changes buildingId/factKey mid-life — this branch only fires
  // on a genuine fresh mount.
  const editingRef = useRef(false)

  useEffect(() => {
    if (editingRef.current) return
    setDraft(current ?? '')
    setAttempted(false)
  }, [buildingId, current, factKey])

  const commit = () => {
    if (!draft.trim()) {
      setAttempted(true)
      return
    }
    if (draft.trim() !== current) {
      s.setBuildingFactOverride(buildingId, factKey, draft.trim())
    }
    editingRef.current = false
    setAttempted(false)
  }
  const provenance = factPresentation(fact, t)

  return (
    <div className="grid gap-2 border-b border-border-subtle pb-4">
      <FormField
        label={t(FACT_MESSAGE[factKey])}
        htmlFor={id}
        helperText={current === null ? t('buildingScope.value.notCaptured') : undefined}
        error={attempted ? t('buildingScope.validation.textRequired') : undefined}
      >
        <input
          value={draft}
          onChange={(event) => {
            editingRef.current = true
            setDraft(event.target.value)
            setAttempted(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              editingRef.current = false
              setDraft(current ?? '')
              setAttempted(false)
            }
          }}
        />
      </FormField>
      <FieldActions
        fieldLabel={t(FACT_MESSAGE[factKey])}
        provenance={provenance}
        canReset={fact.override !== null}
        onCommit={commit}
        onReset={() => s.clearBuildingFactOverride(buildingId, factKey)}
      />
    </div>
  )
}

function SelectFactField<K extends 'buildingForm' | 'buildingClass'>({
  buildingId,
  factKey,
  values,
  messageFor,
  helper,
}: {
  buildingId: string
  factKey: K
  values: ReadonlyArray<BuildingFactValueMap[K]>
  messageFor: (value: BuildingFactValueMap[K]) => string
  helper?: string
}) {
  const s = useStore()
  const t = useT()
  const fact = s.buildingReviews[buildingId]!.facts[factKey]
  const current = effectiveFactValue(fact)
  return (
    <div className="grid gap-2 border-b border-border-subtle pb-4">
      <SelectField
        label={t(FACT_MESSAGE[factKey])}
        value={current ?? ''}
        helperText={helper ?? (current === null ? t('buildingScope.value.notCaptured') : undefined)}
        onChange={(event) => {
          const value = event.target.value as BuildingFactValueMap[K]
          if (value) s.setBuildingFactOverride(buildingId, factKey, value)
        }}
      >
        <option value="">{t('buildingScope.value.notCaptured')}</option>
        {values.map((value) => (
          <option key={value} value={value}>{t(messageFor(value))}</option>
        ))}
      </SelectField>
      <FieldActions
        fieldLabel={t(FACT_MESSAGE[factKey])}
        provenance={factPresentation(fact, t)}
        canReset={fact.override !== null}
        onReset={() => s.clearBuildingFactOverride(buildingId, factKey)}
      />
    </div>
  )
}

function DecimalFactField({
  buildingId,
  factKey,
  unit,
  integer = false,
  derived = false,
}: {
  buildingId: string
  factKey: Exclude<BuildingFactKey,
    'documentationName' | 'address' | 'buildingForm' | 'buildingClass'>
  unit?: string
  integer?: boolean
  derived?: boolean
}) {
  const s = useStore()
  const t = useT()
  const review = s.buildingReviews[buildingId]!
  const fact = review.facts[factKey] as BuildingFact<Decimal>
  const derivedState = derived
    ? effectiveDerivedArea(review, s.buildingConflicts, factKey as DerivedAreaKey)
    : null
  const value = derivedState?.value ?? effectiveFactValue(fact)
  const presentation = derivedState?.basis === 'components'
    ? { kind: 'derived', label: t('buildingScope.provenance.derived') } as const
    : factPresentation(fact, t)
  const openConflict = derivedState?.basis === 'conflict'

  return (
    <div className="grid gap-2 border-b border-border-subtle pb-4">
      {value === null ? (
        <MissingDecimalField
          label={t(FACT_MESSAGE[factKey])}
          unit={unit}
          integer={integer}
          helper={openConflict
            ? t('buildingScope.value.conflictOpen')
            : t('buildingScope.value.notCaptured')}
          onCommit={(next) => s.setBuildingFactOverride(buildingId, factKey, next)}
        />
      ) : (
        <NumericField
          label={t(FACT_MESSAGE[factKey])}
          value={value}
          unit={unit}
          decimals={integer ? 0 : 2}
          integer={integer}
          provenance={presentation ?? {
            kind: 'manual',
            label: t('buildingScope.provenance.manual'),
          }}
          onCommit={(next, confirmed) => s.setBuildingFactOverride(
            buildingId,
            factKey,
            next,
            confirmed ? 'customer confirmation' : 'sales-user',
          )}
        />
      )}
      {fact.override && (
        <Button
          variant="ghost"
          aria-label={`${t('buildingScope.action.reset')}: ${t(FACT_MESSAGE[factKey])}`}
          onClick={() => s.clearBuildingFactOverride(buildingId, factKey)}
        >
          {t('buildingScope.action.reset')}
        </Button>
      )}
    </div>
  )
}

function MissingDecimalField({
  label,
  unit,
  integer,
  helper,
  onCommit,
}: {
  label: string
  unit?: string
  integer: boolean
  helper: string
  onCommit: (value: Decimal) => void
}) {
  const t = useT()
  const id = useId()
  const [draft, setDraft] = useState('')
  const [rejection, setRejection] = useState<ReturnType<typeof rejectNumericInput>>(null)
  const commit = () => {
    const why = rejectNumericInput(draft, { integer })
    if (why) {
      setRejection(why)
      return
    }
    onCommit(parseNumericInput(draft, { integer })!)
    setDraft('')
    setRejection(null)
  }
  const error = rejection === 'notANumber' ? t('buildingScope.validation.number')
    : rejection === 'notPositive' ? t('buildingScope.validation.positive')
      : rejection === 'notInteger' ? t('buildingScope.validation.integer')
        : undefined
  return (
    <div className="grid gap-2">
      <FormField label={label} htmlFor={id} helperText={helper} error={error}>
        <input
          className="numeric"
          value={draft}
          inputMode={integer ? 'numeric' : 'decimal'}
          aria-label={unit ? `${label} · ${unit}` : label}
          onChange={(event) => {
            setDraft(event.target.value)
            setRejection(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft('')
              setRejection(null)
            }
          }}
        />
      </FormField>
      {/* F21: the apply button now shares `.a3-field-actions`'
          right-anchored column with every populated field's own action
          (`FieldActions` above), instead of sitting at whatever x its own
          isolated row happened to render at. */}
      <div className="a3-field-actions">
        <span />
        <Button
          aria-label={`${t('buildingScope.action.apply')}: ${label}`}
          onClick={commit}
        >
          {t('buildingScope.action.apply')}
        </Button>
      </div>
    </div>
  )
}

function FieldActions({
  fieldLabel,
  provenance,
  canReset,
  onCommit,
  onReset,
}: {
  fieldLabel: string
  provenance: ProvenancePresentation | null
  canReset: boolean
  onCommit?: () => void
  onReset: () => void
}) {
  const t = useT()
  return (
    // F21: `space-between` pins the action group to this row's own right
    // edge regardless of the provenance label's own width — every field in
    // the form spans the same row width, so every field's action now lands
    // on the same right-hand column instead of drifting with its own
    // provenance text (measured x=487 vs x=376 for two adjacent fields).
    <div className="a3-field-actions">
      <span>{provenance && <ProvenanceChip provenance={provenance} />}</span>
      <span className="flex flex-wrap items-center gap-3">
        {onCommit && (
          <Button
            aria-label={`${t('buildingScope.action.apply')}: ${fieldLabel}`}
            onClick={onCommit}
          >
            {t('buildingScope.action.apply')}
          </Button>
        )}
        {canReset && (
          <Button
            variant="ghost"
            aria-label={`${t('buildingScope.action.reset')}: ${fieldLabel}`}
            onClick={onReset}
          >
            {t('buildingScope.action.reset')}
          </Button>
        )}
      </span>
    </div>
  )
}

/**
 * "Rebuild Project Card Workflow" Part 16: `AREAS` ("Flächen im Detail",
 * the former sole owner of this decision) is removed as a standalone
 * Configurator chapter. Building Scope is the accepted authoritative
 * editing location for building-level identity and area information (Part
 * 7/Accepted Authority #7); this relocates the exact same control
 * (`b.untergeschoss`/`setUntergeschoss`, unchanged commercial semantics,
 * same three images) rather than inventing a replacement — KG 300's own
 * read-only recap already links here (`UndergroundFloorRecap` in
 * `S3Konfigurator.tsx`).
 */
const UG_IMAGE_VALUE: Record<'vollausbau' | 'ab_decke' | 'kein_ug', string> = {
  vollausbau: 'rohbauAusbau',
  ab_decke: 'nurAusbau',
  kein_ug: 'keins',
}

function untergeschossDelta(delta: Decimal): string {
  if (delta.isZero()) return `±${NNBSP}0${NNBSP}€`
  const sign = delta.isNegative() ? '−' : '+'
  const word = delta.isNegative() ? 'Minderpreis' : 'Mehrpreis'
  return `${sign}${NNBSP}${formatDE(delta.abs(), 0)}${NNBSP}€${NNBSP}${word}`
}

function UntergeschossEditor({ buildingId }: { buildingId: string }) {
  const s = useStore()
  const t = useT()
  const b = s.buildings[buildingId]
  if (!b) return null
  return (
    <div className="mt-4 border-t border-border-subtle pt-4">
      <p className="text-small font-medium text-text-primary">
        {t('configurator.basement.title')}
      </p>
      <div className="mt-2">
        <RadioCardGroup
          legend={t('configurator.basement.title')}
          legendHidden
          value={b.untergeschoss}
          onChange={(v) => s.setUntergeschoss(buildingId, v)}
          onPreview={(v) =>
            s.previewOption(v ? { kind: 'untergeschoss', buildingId, value: v } : null)}
          options={(['vollausbau', 'ab_decke', 'kein_ug'] as const).map((v) => ({
            value: v,
            title: LABEL_UG[v],
            image: optionImage('ugVariante', UG_IMAGE_VALUE[v]),
            consequence: b.untergeschoss === v
              ? 'aktuelle Auswahl'
              : untergeschossDelta(s.optionDelta({ kind: 'untergeschoss', buildingId, value: v })),
          }))}
        />
      </div>
    </div>
  )
}

function ConflictDecision({ conflict }: { conflict: BuildingConflict }) {
  const s = useStore()
  const t = useT()
  const state = deriveConflictState(conflict)
  return (
    <article className="border border-border-warning p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-body font-bold text-text-primary">
          {t(FACT_MESSAGE[conflict.factKey])}
        </h4>
        {state.status === 'open' ? (
          <StatusBadge status="conflict" />
        ) : (
          <Badge sign="✓">{t('buildingScope.status.conflictResolved')}</Badge>
        )}
      </div>
      <p className="mt-2 text-small text-text-secondary">
        {state.status === 'open'
          ? t('buildingScope.conflicts.open')
          : t('buildingScope.conflicts.resolved')}
      </p>
      <ul className="mt-3 grid gap-3">
        {conflict.candidates.map((candidate) => {
          const selected = state.selectedCandidateId === candidate.id
          const provenance = candidate.origin === 'manual'
            ? { kind: 'manual', label: t('buildingScope.provenance.manual') } as const
            : candidate.origin === 'derived'
              ? { kind: 'derived', label: t('buildingScope.provenance.derived') } as const
              : sourcePresentation(candidate.source, t)!
          return (
            <li key={candidate.id} className="border-t border-border-subtle pt-3">
              <p className="numeric text-body text-text-primary">
                {formatConflictValue(conflict.factKey, candidate.value)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ProvenanceChip provenance={provenance} />
                {selected ? (
                  <span className="text-small text-text-secondary">
                    <span aria-hidden="true">✓ </span>
                    {t('buildingScope.conflicts.authoritative')}
                  </span>
                ) : (
                  <Button
                    aria-label={`${t('buildingScope.conflicts.choose')}: ${formatConflictValue(conflict.factKey, candidate.value)}`}
                    onClick={() => resolveCandidate(s, conflict, candidate.id)}
                  >
                    {t('buildingScope.conflicts.choose')}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function resolveCandidate(
  state: ReturnType<typeof useStore.getState>,
  conflict: BuildingConflict,
  candidateId: string,
) {
  const candidate = conflict.candidates.find((item) => item.id === candidateId)
  if (conflict.id === 'DEMO-CONF-0001'
    && (candidate?.origin === 'document' || candidate?.origin === 'customer')) {
    state.resolveWflConflict(candidate.origin)
    return
  }
  state.resolveBuildingConflict(conflict.id, {
    decision: 'selectCandidate',
    candidateId,
  })
}

function formatConflictValue(key: BuildingFactKey, value: string): string {
  if (key === 'documentationName' || key === 'address'
    || key === 'buildingForm' || key === 'buildingClass') return value
  try {
    // Bare counts (Wohneinheiten, and now Geschosse — #16 Part 8) never
    // carry the m² area unit.
    const formatted = formatDE(new Decimal(value), key === 'units' || key === 'storeyStructure' ? 0 : 2)
    return key === 'units' || key === 'storeyStructure' ? formatted : `${formatted}${NNBSP}m²`
  } catch {
    return value
  }
}

export function BuildingScopeReadiness() {
  const s = useStore()
  const t = useT()
  const [journalOpen, setJournalOpen] = useState(false)
  // F-38: `UndoToast`'s own docstring promises "revert always available from
  // the journal" (DC-12/FEEDBACK-001), but this aside had no journal access
  // at all — once the undo toast (8 s, rule 29) expired, an edit made here
  // could not be reverted from this screen. Reuses OfferPanel's proven
  // composition (`.a3-journal-spec` disclosure + undo), filtered to
  // Opportunity-level events (`optionId === null`): no Option exists yet at
  // this stage, so there is no `activeOptionId` to filter by instead.
  const buildingScopeJournal = s.journal.filter((e) => e.optionId === null)
  const selectedIds = includedBuildingIds(s)
  const ready = s.canBeginConfiguration()
  const nextOpen = selectedIds.find((id) => !buildingConfirmed(s, id))
  const items = [
    {
      id: 'building-selected',
      label: t('buildingScope.readiness.selection'),
      ready: selectedIds.length > 0,
      detail: selectedIds.length > 0
        ? t('buildingScope.readiness.selectedCount', { count: selectedIds.length })
        : t('buildingScope.readiness.selectionMissing'),
    },
    ...selectedIds.map((id) => ({
      id,
      label: stableName(s.buildingReviews[id]!, id),
      ready: buildingConfirmed(s, id),
      detail: buildingConfirmed(s, id)
        ? t('buildingScope.status.confirmed')
        : openConflictsFor(s, id).length > 0
          ? t('buildingScope.readiness.conflictOpen')
          : t('buildingScope.status.open'),
    })),
  ]

  const nextAction = ready ? (
    <Button variant="primary" onClick={() => s.setPipelineView('konfigurator')}>
      {t('buildingScope.readiness.openConfigurator')}
    </Button>
  ) : nextOpen ? (
    <Button onClick={() => s.setActiveBuilding(nextOpen)}>
      {t('buildingScope.readiness.reviewNext')}
    </Button>
  ) : (
    <Button
      variant="primary"
      disabled
      disabledReason={t('buildingScope.readiness.selectionMissing')}
    >
      {t('buildingScope.readiness.openConfigurator')}
    </Button>
  )

  return (
    <aside
      aria-label={t('buildingScope.readiness.title')}
      className="flex h-full w-panel-right min-w-0 max-w-panel-right shrink-0 flex-col overflow-y-auto border-l border-border-strong bg-surface-default"
    >
      <div className="p-6">
        <h2 className="text-heading-2 font-bold text-text-primary">
          {t('buildingScope.readiness.title')}
        </h2>
        <div className="mt-4">
          <ReadinessChecklist
            label={t('buildingScope.readiness.title')}
            items={items}
            nextAction={nextAction}
          />
        </div>
        <section className="mt-6 border-t border-border-strong pt-5">
          <p className="text-body font-bold text-text-primary">
            {t('buildingScope.readiness.pricingNotStarted')}
          </p>
          <p className="mt-2 text-small text-text-secondary">
            {t('buildingScope.readiness.pricingExplanation')}
          </p>
        </section>
        {/* F-38: session journal (DC-12) — internal only, same gate as
            OfferPanel's own instance; not part of the client projection. */}
        {s.mode === 'intern' && (
          <div className="a3-journal-spec mt-5 border-t border-border-strong pt-5">
            <button
              type="button"
              onClick={() => setJournalOpen((v) => !v)}
              aria-expanded={journalOpen}
              className="a3-journal-disclose outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span aria-hidden="true">{journalOpen ? '▾ ' : '▸ '}</span>
              {buildingScopeJournal.length === 0
                ? t('journal.empty')
                : buildingScopeJournal.length === 1
                  ? t('journal.buildingScope.summaryOne')
                  : t('journal.buildingScope.summary', { count: buildingScopeJournal.length })}
            </button>

            {journalOpen && buildingScopeJournal.length > 0 && (
              <ol className="a3-journal-items overflow-y-auto"
                  style={{ maxHeight: 'calc(var(--space-8) * 3)' }}>
                {[...buildingScopeJournal].reverse().map((e) => (
                  <li key={e.seq}>
                    <span className="numeric">{e.seq}</span>
                    <span>{e.label}</span>
                    <span className="numeric">
                      {e.deltaExact ? signed(e.deltaExact) : '—'}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-2">
              <Button onClick={() => s.undo()}
                      disabled={!s.canUndo()}
                      disabledReason={t('journal.undoUnavailable')}>
                {t('common.undo')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
