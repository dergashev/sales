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
  useStore,
} from '../state/store'
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
  type StoreyKind,
  type StoreyStructure,
} from '../state/buildingReview'
import {
  Badge,
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
import { DataStateBoundary, EmptyState } from '../components/DataStates'
import { useT } from '../i18n'

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

function stableName(
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

function factPresentation<T>(
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

export function BuildingScope() {
  const s = useStore()
  const t = useT()
  const buildingIds = Object.keys(s.buildings)
  const selectedIds = includedBuildingIds(s)
  const selectedCount = selectedIds.length
  const confirmedCount = selectedIds.filter((id) => buildingConfirmed(s, id)).length
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
                  return (
                    <li key={id} className="border-b border-border-subtle py-4">
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
                      <dl className="mt-2 grid gap-1 pl-7 text-small text-text-secondary">
                        <FactSummary
                          label={t('buildingScope.fact.address')}
                          value={address ?? t('buildingScope.value.addressMissing')}
                        />
                        <FactSummary
                          label={t('buildingScope.fact.form')}
                          value={form ? t(FORM_MESSAGE[form]) : t('buildingScope.value.formMissing')}
                        />
                        <FactSummary
                          label={t('buildingScope.fact.class')}
                          value={buildingClass
                            ? t(CLASS_MESSAGE[buildingClass])
                            : t('buildingScope.value.classMissing')}
                        />
                      </dl>
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

  useEffect(() => {
    if (focusConfirmation && confirmed) {
      confirmationRef.current?.focus({ preventScroll: true })
      setFocusConfirmation(false)
    }
  }, [confirmed, focusConfirmation])

  const confirm = () => {
    s.confirmBuilding(buildingId)
    setFocusConfirmation(true)
    announce(t('buildingScope.announcement.confirmed', {
      building: stableName(review, buildingId),
    }))
  }

  return (
    <div className="grid gap-6">
      <FactGroup title={t('buildingScope.group.identity')}>
        <TextFactField buildingId={buildingId} factKey="documentationName" />
        <TextFactField buildingId={buildingId} factKey="address" />
        <SelectFactField
          buildingId={buildingId}
          factKey="buildingForm"
          values={FORM_VALUES}
          messageFor={(value) => FORM_MESSAGE[value]}
        />
        <SelectFactField
          buildingId={buildingId}
          factKey="buildingClass"
          values={CLASS_VALUES}
          messageFor={(value) => CLASS_MESSAGE[value]}
          helper={t('buildingScope.class.helper')}
        />
      </FactGroup>

      <FactGroup title={t('buildingScope.group.above')}>
        <DecimalFactField buildingId={buildingId} factKey="bgfRAbove" unit="m²" />
        <DecimalFactField buildingId={buildingId} factKey="bgfSAbove" unit="m²" />
        <DecimalFactField buildingId={buildingId} factKey="bgfRSAbove" unit="m²" derived />
      </FactGroup>

      <FactGroup title={t('buildingScope.group.below')}>
        <DecimalFactField buildingId={buildingId} factKey="bgfRBelow" unit="m²" />
        <DecimalFactField buildingId={buildingId} factKey="bgfSBelow" unit="m²" />
        <DecimalFactField buildingId={buildingId} factKey="bgfRSBelow" unit="m²" derived />
      </FactGroup>

      <FactGroup title={t('buildingScope.group.total')}>
        <DecimalFactField buildingId={buildingId} factKey="bgfRSTotal" unit="m²" derived />
        <DecimalFactField buildingId={buildingId} factKey="wfl" unit="m²" />
        <DecimalFactField buildingId={buildingId} factKey="nuf" unit="m²" />
        <DecimalFactField buildingId={buildingId} factKey="units" integer />
      </FactGroup>

      <FactGroup title={t('buildingScope.group.storeys')}>
        <StoreyEditor buildingId={buildingId} />
      </FactGroup>

      <FactGroup title={t('buildingScope.group.decisions')}>
        {conflicts.length === 0 ? (
          <p className="text-small text-text-secondary">
            <span aria-hidden="true">✓ </span>
            {t('buildingScope.conflicts.none')}
          </p>
        ) : conflicts.map((conflict) => (
          <ConflictDecision key={conflict.id} conflict={conflict} />
        ))}
      </FactGroup>

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
              disabled={openConflicts.length > 0}
              disabledReason={openConflicts.length > 0
                ? t('buildingScope.confirm.conflictReason', {
                  count: openConflicts.length,
                })
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

function FactGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border-subtle pt-5">
      <h3 className="text-heading-3 font-bold text-text-primary">{title}</h3>
      <div className="mt-3 grid grid-cols-1 gap-4">{children}</div>
    </section>
  )
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

  useEffect(() => {
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
            setDraft(event.target.value)
            setAttempted(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
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
    'documentationName' | 'address' | 'buildingForm' | 'buildingClass' | 'storeyStructure'>
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
      <Button
        aria-label={`${t('buildingScope.action.apply')}: ${label}`}
        onClick={commit}
      >
        {t('buildingScope.action.apply')}
      </Button>
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
    <div className="flex flex-wrap items-center gap-3">
      {provenance && <ProvenanceChip provenance={provenance} />}
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
    </div>
  )
}

function StoreyEditor({ buildingId }: { buildingId: string }) {
  const s = useStore()
  const t = useT()
  const fact = s.buildingReviews[buildingId]!.facts.storeyStructure
  const current = effectiveFactValue(fact)
  const currentCounts = countsFromStoreys(current)
  const [counts, setCounts] = useState(currentCounts)
  const [error, setError] = useState(false)

  useEffect(() => {
    setCounts(currentCounts)
    setError(false)
  }, [buildingId, storeySummary(current)])

  const commit = () => {
    const levels = (['UG', 'EG', 'OG', 'SG'] as const)
      .filter((kind) => counts[kind] > 0)
      .map((kind) => ({ kind, count: counts[kind] }))
    if (levels.length === 0) {
      setError(true)
      return
    }
    s.setBuildingFactOverride(buildingId, 'storeyStructure', {
      levels,
      context: t('buildingScope.storeys.manualContext'),
    })
    setError(false)
  }

  return (
    <div className="grid gap-3 border-b border-border-subtle pb-4">
      <p className="text-body text-text-primary">
        {current
          ? storeySummary(current)
          : t('buildingScope.value.storeysMissing')}
      </p>
      {factPresentation(fact, t) && (
        <ProvenanceChip provenance={factPresentation(fact, t)!} />
      )}
      <div className="grid grid-cols-1 gap-3">
        {(['UG', 'EG', 'OG', 'SG'] as const).map((kind) => (
          <FormField
            key={kind}
            label={t(`buildingScope.storeys.${kind.toLowerCase()}`)}
            htmlFor={`storeys-${buildingId}-${kind}`}
          >
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className="numeric"
              value={counts[kind]}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10)
                setCounts((previous) => ({
                  ...previous,
                  [kind]: Number.isFinite(value) && value >= 0 ? value : 0,
                }))
                setError(false)
              }}
            />
          </FormField>
        ))}
      </div>
      {error && <p role="alert" className="text-small text-text-secondary">
        {t('buildingScope.validation.storeys')}
      </p>}
      <div className="flex flex-wrap gap-3">
        <Button
          aria-label={`${t('buildingScope.action.apply')}: ${t('buildingScope.fact.storeys')}`}
          onClick={commit}
        >
          {t('buildingScope.action.apply')}
        </Button>
        {fact.override && (
          <Button
            variant="ghost"
            aria-label={`${t('buildingScope.action.reset')}: ${t('buildingScope.fact.storeys')}`}
            onClick={() => s.clearBuildingFactOverride(buildingId, 'storeyStructure')}
          >
            {t('buildingScope.action.reset')}
          </Button>
        )}
      </div>
    </div>
  )
}

function countsFromStoreys(value: StoreyStructure | null): Record<StoreyKind, number> {
  const counts: Record<StoreyKind, number> = { UG: 0, EG: 0, OG: 0, SG: 0 }
  value?.levels.forEach((level) => { counts[level.kind] = level.count })
  return counts
}

function storeySummary(value: StoreyStructure | null): string {
  if (!value) return ''
  return value.levels.map((level) => level.count === 1
    ? level.kind
    : `${level.count}${NNBSP}${level.kind}`).join(` + `)
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
    || key === 'buildingForm' || key === 'buildingClass'
    || key === 'storeyStructure') return value
  try {
    const formatted = formatDE(new Decimal(value), key === 'units' ? 0 : 2)
    return key === 'units' ? formatted : `${formatted}${NNBSP}m²`
  } catch {
    return value
  }
}

export function BuildingScopeReadiness() {
  const s = useStore()
  const t = useT()
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
      </div>
    </aside>
  )
}
