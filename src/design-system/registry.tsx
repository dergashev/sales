import { useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Decimal } from 'decimal.js'
import { NNBSP, formatDE, label as moneyLabel, present, rate } from '../engine/money'
import demo from '../fixtures/demo-0001.json'
import {
  Button,
  NumericField,
  ProvenanceChip,
  Skeleton,
} from '../components/primitives'
import { EstimateUncertaintyBadge } from '../components/EstimateUncertaintyBadge'
import {
  DataStateBoundary,
  EmptyState,
  ErrorState,
  PartialState,
  PermissionState,
  StaleState,
  type DataStateKind,
  type OwnerDataState,
} from '../components/DataStates'
import { Combobox, RadioCardGroup, SegmentedControl, Switch } from '../components/controls'
import {
  Badge,
  Card,
  DisclosureRow,
  FormField,
  NextStep,
  OutputProfileSwitch,
  PageHeader,
  ReadinessChecklist,
  SectionSheet,
  SelectField,
  SmallText,
} from '../components/designSystem'
import { Dialog, type DialogHandle } from '../components/Dialog'
import { OriginPopover } from '../components/OriginPopover'
import { DocumentAnalysis } from '../components/DocumentAnalysis'
import { DateField, Stepper } from '../components/controls'
import { optionImage } from '../assets/option-images'
import { MediaFrame } from './MediaFrame'
import { SemanticStatus } from './SemanticStatus'
import { AuthorityTrace, MetricReadout } from './AuthorityTrace'
import { DocumentRow, ProcessingJob } from './ProcessingJob'
import { ActionGate, PrerequisiteState, ProjectReadiness } from './ActionGate'
import { ChoiceGroup } from './ChoiceGroup'
import { CommercialNumber } from './CommercialNumber'
import { ScheduleEditor } from './ScheduleEditor'
import {
  ReviewIndex, ReviewSection, ValidationReview,
} from './ValidationReview'
import { SaveFailureNotice, SaveReceipt } from './SaveReceipt'
import {
  CommercialRailChange, CommercialRailScope, CommercialRailStatus,
} from './CommercialRail'
import {
  KGConfigurationPage, ServiceDecisionRow, ServiceDetailPanel, ServiceGroup,
} from './KGConfiguration'
import {
  ScopeDecisionLedger, type ScopeLedgerRow,
} from './ScopeDecisionLedger'
import {
  BuildingBaselineProvenance,
  BuildingBaselineRow,
  BuildingBaselineSheet,
  BuildingIdentityCard,
  BuildingIdentityGroup,
} from './BuildingScopePanel'
import { ConflictResolver } from './ConflictResolver'
import { QuestionItem, QuestionQueue } from './QuestionQueue'
import { CompositionBar, type CompositionSegment } from './CompositionBar'
import { WorkflowStepper, type WorkflowStep } from './WorkflowStepper'
import { WorkflowNavigator, type WorkflowStage } from './WorkflowNavigator'
import { Pagination } from './Pagination'
import { useSemanticMotion } from './motion'

export type ContractStateDeclaration = Readonly<Record<DataStateKind, string>>

export type Specimen = {
  id: string
  groupId: 'states' | 'foundations' | 'selections' | 'feedback' | 'domain' | 'r1'
  title: string
  note?: string
  contractId: string
  requirements: ReadonlyArray<string>
  composedContracts: ReadonlyArray<string>
  interactionStates: ReadonlyArray<string>
  dataStates: ContractStateDeclaration
  blockedVariants: ReadonlyArray<string>
  maturity: 'alpha' | 'beta' | 'stable'
  evidence: string
  render: () => JSX.Element
}

export type SpecimenGroup = {
  id: Specimen['groupId']
  title: string
  intro?: string
  specimens: Specimen[]
}

const DATA_KEYS: DataStateKind[] = [
  'loading', 'empty', 'partial', 'ready', 'error', 'stale', 'permission',
]

function declareDataStates(
  supported: ReadonlyArray<DataStateKind>,
  notApplicableReason: string,
): ContractStateDeclaration {
  return Object.fromEntries(DATA_KEYS.map((state) => [
    state,
    supported.includes(state) ? 'supported' : `not applicable — ${notApplicableReason}`,
  ])) as Record<DataStateKind, string>
}

const ALL_DATA_STATES = declareDataStates(DATA_KEYS, '')
const STATIC_LAYOUT_STATES = declareDataStates(
  [],
  'layout and typography roots do not load or interpret owner data',
)
const LOCAL_CONTROL_STATES = declareDataStates(
  ['ready', 'permission'],
  'the local control stores a value; result states belong to its owner',
)
const ACTION_STATES = declareDataStates(
  ['loading', 'ready', 'error', 'permission'],
  'empty, partial, and stale belong to the block the action serves',
)

function SegmentedDemo() {
  const [value, setValue] = useState<'a' | 'b'>('a')
  return (
    <SegmentedControl
      legend="Demo-Einstellung"
      value={value}
      onChange={setValue}
      options={[
        { value: 'a', label: 'Zustand A' },
        { value: 'b', label: 'Zustand B' },
      ]}
    />
  )
}

/**
 * The compact size, next to the default one, because the whole point of the
 * variant is the COMPARISON: same control, same 44 × 44 press target, less
 * visual weight where the header cannot afford 46 px.
 */
function SegmentedCompactDemo() {
  const [value, setValue] = useState<'de' | 'en'>('de')
  return (
    <SegmentedControl
      layout="inline"
      size="compact"
      legend="Sprache"
      value={value}
      onChange={setValue}
      options={[
        { value: 'de', label: 'DE' },
        { value: 'en', label: 'EN' },
      ]}
    />
  )
}

/**
 * The searchable single select, in its ready state and in the three states
 * an option SOURCE can be in — because those are the states a consumer has
 * to design for and the ones a catalogue that only shows `ready` hides.
 */
function ComboboxDemo() {
  const [value, setValue] = useState('')
  return (
    <div className="grid gap-4">
      <Combobox
        id="specimen-combobox"
        label="Stadt"
        value={value}
        onChange={setValue}
        placeholder="Alle"
        options={[
          { value: '', label: 'Alle' },
          { value: 'Freiburg', label: 'Freiburg im Breisgau' },
          { value: 'Hamburg', label: 'Hamburg' },
          { value: 'Leipzig', label: 'Leipzig' },
          { value: 'Wien', label: 'Wien' },
        ]}
      />
      <Combobox
        id="specimen-combobox-loading"
        label="Stadt · loading"
        value=""
        onChange={() => {}}
        options={[]}
        loading
      />
      <Combobox
        id="specimen-combobox-error"
        label="Stadt · error"
        value=""
        onChange={() => {}}
        options={[]}
        error="Die Liste konnte nicht geladen werden."
        onRetry={() => {}}
      />
      <Combobox
        id="specimen-combobox-permission"
        label="Stadt · permission"
        value=""
        onChange={() => {}}
        options={[]}
        disabled
        disabledReason="Für diese Rolle nicht verfügbar."
        stale="Stand 10:00 — seitdem nicht aktualisiert."
        partial="Archivierte Einträge fehlen."
      />
    </div>
  )
}

function SwitchDemo() {
  const [on, setOn] = useState(false)
  return <Switch label="Demo-Einstellung" checked={on} onChange={setOn} />
}

function RadioCardDemo() {
  const [value, setValue] = useState<'x' | 'y' | 'z'>('x')
  return (
    <RadioCardGroup
      legend="Demo-Optionen"
      legendHidden
      value={value}
      onChange={setValue}
      options={[
        { value: 'x', title: 'Option X', consequence: 'aktuelle Auswahl' },
        {
          value: 'y', title: 'Option Y',
          consequence: `≈${NNBSP}+97.000${NNBSP}€${NNBSP}Mehrpreis`,
          recommended: true,
        },
        {
          value: 'z', title: 'Option Z', consequence: 'Preis nicht ermittelt',
          disabled: true, disabledReason: 'GK 5 nicht gewählt',
        },
      ]}
    />
  )
}

function OutputProfileDemo() {
  const [mode, setMode] = useState<'intern' | 'praesentation'>('intern')
  return (
    <OutputProfileSwitch
      mode={mode}
      onCheck={() => setMode('praesentation')}
      onExit={() => setMode('intern')}
    />
  )
}

function SelectDemo() {
  const [value, setValue] = useState('de')
  return (
    <SelectField
      label="Sprache der Ausgabe"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      helperText="Die Sprache der Oberfläche bleibt unabhängig."
    >
      <option value="de">Deutsch</option>
      <option value="en">English</option>
      <option value="fr">Français mit längerer Bezeichnung</option>
    </SelectField>
  )
}

function DataBoundaryDemo() {
  const [state, setState] = useState<OwnerDataState<string[]>>({
    status: 'loading',
    label: 'Dokumente werden geprüft',
  })
  return (
    <div>
      <DataStateBoundary
        state={state}
        label="Prüfergebnis"
        renderReady={(rows) => (
          <ul className="a3-preflight-list">
            {rows.map((row) => <li key={row}>✓ {row}</li>)}
          </ul>
        )}
      />
      <div className="a3-specimen-actions">
        <Button onClick={() => setState({ status: 'loading', label: 'Dokumente werden geprüft' })}>
          Laden zeigen
        </Button>
        <Button
          variant="primary"
          onClick={() => setState({ status: 'ready', data: ['Klassifikation bestätigt', 'Preisstand vorhanden'] })}
        >
          Ergebnis zeigen
        </Button>
      </div>
    </div>
  )
}

function FormFieldDemo() {
  const id = useId()
  return (
    <FormField label="Projektbezeichnung" htmlFor={id} helperText="Sichtbar im internen Arbeitsraum">
      <input id={id} defaultValue="Musterprojekt Nordfeld" />
    </FormField>
  )
}

function CardDemo() {
  return (
    <Card
      title="Musterprojekt Nordfeld"
      meta="Berlin · Opportunity DEMO-0001"
      status={<Badge sign="▲">in Vorbereitung</Badge>}
      actions={<Button>Vorbereitung öffnen</Button>}
      onOpen={() => {}}
    >
      3 Gebäude · 12 Dokumente
    </Card>
  )
}

function DisclosureDemo() {
  return (
    <div className="a3-tbl-scroll">
      <table className="a3-data-table">
        <caption>Leistungsumfang</caption>
        <tbody>
          <DisclosureRow label="KG 300 · Bauwerk" cells={[`1.840.000${NNBSP}€`]}>
            Bezugsgröße: BGF oberirdisch · Stand 08/2026
          </DisclosureRow>
        </tbody>
      </table>
    </div>
  )
}

function DialogDemo() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<DialogHandle>(null)
  const titleId = useId()
  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>Dialog öffnen</Button>
      <Dialog
        ref={dialogRef}
        open={open}
        onOpenChange={setOpen}
        labelledBy={titleId}
        initialFocusRef={titleRef}
        returnFocusTo={triggerRef}
      >
        <h4 ref={titleRef} id={titleId} tabIndex={-1}>Freigabe prüfen</h4>
        <p>Der Dialog hält Fokus und Hintergrund bis zum vollständigen Ausgang.</p>
        <div className="a3-row">
          <Button variant="primary" onClick={() => dialogRef.current?.close()}>Freigabe bestätigen</Button>
          <Button variant="ghost" onClick={() => dialogRef.current?.close()}>Abbrechen</Button>
        </div>
      </Dialog>
    </>
  )
}

function SurfaceFoundationsDemo() {
  const stageSegments: CompositionSegment[] = [
    { id: 'kg300', label: 'KG 300', value: new Decimal('2681920'), categorySlot: 1 },
    { id: 'kg400', label: 'KG 400', value: new Decimal('906120'), categorySlot: 3 },
    { id: 'kg700', label: 'KG 700', value: new Decimal('355960'), categorySlot: 6 },
  ]
  const stageTotal = stageSegments.reduce((sum, segment) => sum.plus(segment.value), new Decimal(0))
  return (
    <div className="a3-surface-foundations">
      <article className="a3-surface-foundation a3-canvas">
        <header className="a3-surface-foundation__head">
          <p className="a3-surface-foundation__eyebrow">Canvas · Umgebung</p>
          <h3 className="a3-surface-foundation__title">Portfolio &amp; Orientierung</h3>
        </header>
        <div className="a3-surface-foundation__content">
          <div className="a3-surface-foundation__sheet">
            <p className="a3-surface-foundation__eyebrow">Opportunities</p>
            <p className="a3-surface-foundation__section-title">Arbeitsfläche liegt auf Canvas</p>
            <div className="a3-surface-foundation__identity" aria-label="Abstrakte Projektidentität">
              Musterprojekt Nordfeld
            </div>
          </div>
          <p className="a3-surface-foundation__support">Nur Hintergrund und Orientierung. Nie eine Datenkarte.</p>
          <p className="a3-surface-foundation__caption">Canvas · environmental layer</p>
        </div>
      </article>
      <article className="a3-surface-foundation a3-paper">
        <header className="a3-surface-foundation__head">
          <p className="a3-surface-foundation__eyebrow">Paper · Lesen</p>
          <h3 className="a3-surface-foundation__title">Lesen &amp; entscheiden</h3>
        </header>
        <div className="a3-surface-foundation__content">
          <p className="a3-surface-foundation__eyebrow">Projektgrundlage</p>
          <p className="a3-surface-foundation__section-title">Arbeitsinhalt ohne Kartenstapel</p>
          <dl className="a3-surface-foundation__rules">
            <div><dt>BGF oberirdisch</dt><dd>3.200{NNBSP}m²</dd></div>
            <div><dt>WFL</dt><dd>1.560{NNBSP}m²</dd></div>
            <div><dt>Haus B</dt><dd>nicht erfasst</dd></div>
          </dl>
          <Button variant="primary">Grundlage bestätigen</Button>
          <p className="a3-surface-foundation__support">Typografie und Linien gliedern die Lesefläche — nicht verschachtelte Container.</p>
          <p className="a3-surface-foundation__caption">Paper · primary reading plane</p>
        </div>
      </article>
      <article className="a3-surface-foundation a3-stage">
        <header className="a3-surface-foundation__head">
          <p className="a3-surface-foundation__eyebrow">Stage · Fokus</p>
          <h3 className="a3-surface-foundation__title">Fokus &amp; Sales-Moment</h3>
        </header>
        <div className="a3-surface-foundation__content">
          <p className="a3-surface-foundation__eyebrow">Empfohlene Option</p>
          <p className="a3-surface-foundation__section-title">Option 2 · Balance</p>
          <p className="a3-surface-foundation__number">3.944.000{NNBSP}€</p>
          <p className="a3-surface-foundation__support">Eine bewusste Bühne für die empfohlene Entscheidung — nie generischer Status.</p>
          <CompositionBar segments={stageSegments} total={stageTotal} variant="compact" />
          <Button variant="primary">Balance präsentieren</Button>
          <p className="a3-surface-foundation__caption">Stage · selected decision</p>
        </div>
      </article>
      <article className="a3-surface-foundation a3-stage-deep">
        <header className="a3-surface-foundation__head">
          <p className="a3-surface-foundation__eyebrow">Stage-deep · Ergebnis</p>
          <h3 className="a3-surface-foundation__title">Kommerzieller Höhepunkt</h3>
        </header>
        <div className="a3-surface-foundation__content">
          <p className="a3-surface-foundation__eyebrow">Gesamt netto</p>
          <p className="a3-surface-foundation__number a3-display-accent">3.944.000{NNBSP}€</p>
          <p className="a3-surface-foundation__support">Nur für Ergebnis, Angebot und kalkulatorische Aufmerksamkeit — nie als allgemeine Karte.</p>
          <CompositionBar segments={stageSegments} total={stageTotal} variant="compact" onDark />
          <p className="a3-surface-foundation__caption">Stage-deep · commercial climax</p>
        </div>
      </article>
    </div>
  )
}

/**
 * R1 · Composed: Workflow specimen body — WorkflowStepper (both sizes) above
 * chapter content that demonstrates the DIRECTION motion verb (motion.ts):
 * an ordered forward/backward transition, not a lateral fade. Reduced motion
 * is real, not asserted — `motionTokens.reduced` drives the visible caption
 * and (per the motion.ts fix above) the transition genuinely has zero
 * duration/offset when active, not just zero shift.
 */
const WORKFLOW_DEMO_CHAPTERS = [
  { id: 'kg200', label: 'KG 200', title: 'KG 200 · Herrichten & Erschließen', body: 'Erdarbeiten, Bodenplatte und Erschließung — Umfang aus den Grundlagen übernommen.' },
  { id: 'kg300', label: 'KG 300', title: 'KG 300 · Baukonstruktion', body: 'Rohbau, Fassade und Innenausbau — die größte Kostengruppe dieses Projekts.' },
  { id: 'kg400', label: 'KG 400', title: 'KG 400 · Technische Anlagen', body: 'Heizung, Elektro und Sanitär — noch keine Auswahl getroffen.' },
] as const

function WorkflowDirectionDemo() {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'forward' | 'backward'>('forward')
  const motionTokens = useSemanticMotion()
  const chapter = WORKFLOW_DEMO_CHAPTERS[index] ?? WORKFLOW_DEMO_CHAPTERS[0]
  const lastIndex = WORKFLOW_DEMO_CHAPTERS.length - 1

  const projectSteps: WorkflowStep[] = [
    { id: 'doc', label: 'Dokumente', state: 'done', onSelect: () => {} },
    { id: 'baseline', label: 'Grundlage', state: 'done', onSelect: () => {} },
    { id: 'scope', label: 'Umfang', state: 'current', onSelect: () => {} },
    { id: 'export', label: 'Export', state: 'blocked', blockedReason: 'Erst nach vollständiger Konfiguration verfügbar.' },
  ]
  const chapterSteps: WorkflowStep[] = WORKFLOW_DEMO_CHAPTERS.map((c, i) => ({
    id: c.id,
    label: c.label,
    state: i < index ? 'done' : i === index ? 'current' : 'upcoming',
    onSelect: () => { setDir(i > index ? 'forward' : 'backward'); setIndex(i) },
  }))

  // QA (66b4242 cycle): reading `index` from the render closure meant two
  // rapid clicks queued in the same tick both computed the same stale
  // `next`, so React collapsed them into a single step — "interaction state
  // must remain correct under rapid repeated input" violated in the very
  // specimen meant to demonstrate the pattern. The functional updater reads
  // the pending value instead, so each click advances independently.
  const go = (delta: 1 | -1) => {
    setDir(delta > 0 ? 'forward' : 'backward')
    setIndex((current) => Math.min(lastIndex, Math.max(0, current + delta)))
  }

  return (
    <div className="grid gap-6">
      <WorkflowStepper ariaLabel="Projekt-Workflow" size="workflow" steps={projectSteps} />
      <div style={{ maxWidth: '28rem' }}>
        <WorkflowStepper ariaLabel="Konfigurator-Kapitel" size="chapter" steps={chapterSteps} />
        <div className="relative mt-4 overflow-hidden" style={{ minHeight: '6rem' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={chapter.id}
              variants={motionTokens.direction[dir]}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <p className="text-section-title font-bold text-text-primary">{chapter.title}</p>
              <p className="mt-1 text-small text-text-secondary">{chapter.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary" onClick={() => go(-1)}
            disabled={index === 0} disabledReason="Erstes Kapitel — kein vorheriges Kapitel vorhanden."
          >
            Zurück
          </Button>
          <Button
            variant="primary" onClick={() => go(1)}
            disabled={index === lastIndex} disabledReason="Letztes Kapitel — kein weiteres Kapitel vorhanden."
          >
            Weiter
          </Button>
        </div>
        <p className="a3-cap mt-2">
          {motionTokens.reduced
            ? 'prefers-reduced-motion aktiv — Übergang ist sofort sichtbar, kein Versatz und keine Dauer'
            : 'Weiter = direction.forward · Zurück = direction.backward (motion.ts, ADR-R1-05)'}
        </p>
      </div>
    </div>
  )
}

/**
 * The only specimen/contract manifest (D-28). Gallery groups are derived
 * below; no screen owns a second specimen declaration.
 */
export const COMPONENT_REGISTRY: Specimen[] = [
  {
    id: 'state-loading', groupId: 'states', title: 'loading',
    contractId: 'DC-35 · Skeleton', requirements: ['STATE-002', 'SKELETON-001'],
    composedContracts: [], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: ['motion token values remain ADR-pending'], maturity: 'alpha',
    evidence: 'Static specimen: flat blocks, no shimmer and no automatic live region.',
    render: () => <Skeleton lines={3} />,
  },
  {
    id: 'state-ready', groupId: 'states', title: 'loading → ready',
    contractId: 'DataStateBoundary', requirements: ['STATE-001', 'STATE-002', 'STATE-003'],
    composedContracts: ['DC-35', 'DataStateBlock'], interactionStates: ['default'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Typed owner renders real ready content and replaces Skeleton without a minimum hold.',
    render: () => <DataBoundaryDemo />,
  },
  {
    id: 'state-empty', groupId: 'states', title: 'empty',
    contractId: 'DataStateBlock · empty', requirements: ['STATE-004', 'DC-24'],
    composedContracts: [], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Named absence with a non-color sign.',
    render: () => <EmptyState>Keine Optionen verfügbar — für dieses Kapitel ist keine Auswahl definiert.</EmptyState>,
  },
  {
    id: 'state-partial', groupId: 'states', title: 'partial',
    contractId: 'DataStateBlock · partial', requirements: ['SCOPE-001', 'R-18'],
    composedContracts: [], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Unknown price is never rendered as zero.',
    render: () => <PartialState label="Preis nicht ermittelt" consequence="Zwischensumme der kalkulierten Positionen statt Gesamt" />,
  },
  {
    id: 'state-error', groupId: 'states', title: 'error',
    contractId: 'DataStateBlock · error', requirements: ['STATE-005'],
    composedContracts: ['Button'], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Cause, impact, remedy, and retry policy are all present.',
    render: () => (
      <ErrorState
        cause="Datei nicht lesbar: Auflösung zu gering."
        impact="Die Flächen aus dieser Datei fehlen im Ergebnis."
        remedy="Erfassen Sie die Werte manuell oder ersetzen Sie die Datei."
        retryPolicy="Erneut prüfen ist nach dem Ersetzen sicher."
      />
    ),
  },
  {
    id: 'state-stale', groupId: 'states', title: 'stale',
    contractId: 'DataStateBlock · stale', requirements: ['STATE-008'],
    composedContracts: [], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Carries an absolute stand and update action in text.',
    render: () => <StaleState>Veraltet · Stand 04.08.2026 — Kalkulation erneut ausführen</StaleState>,
  },
  {
    id: 'state-permission', groupId: 'states', title: 'permission',
    contractId: 'DataStateBlock · permission', requirements: ['R-16', 'R-17'],
    composedContracts: [], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Names the role-safe reason; protected data remains absent.',
    render: () => <PermissionState>Interne Kalibrierung ist in dieser Rolle nicht verfügbar.</PermissionState>,
  },
  {
    id: 'button', groupId: 'foundations', title: 'Button', contractId: 'components-core · Button',
    requirements: ['BUTTON-001', 'BUTTON-002', 'BUTTON-003', 'BUTTON-004'],
    composedContracts: [], interactionStates: ['default', 'hover', 'focus', 'pressed', 'loading', 'disabled'],
    dataStates: ACTION_STATES, blockedVariants: ['destructive', 'secondary pressed tone', 'ghost pressed tone'],
    maturity: 'alpha', evidence: 'Shared React source preserves focus and width while loading.',
    render: () => (
      <div className="a3-row">
        <Button variant="primary">Primär</Button><Button>Sekundär</Button><Button variant="ghost">Ghost</Button>
        <Button variant="primary" loading loadingLabel="Option wird erstellt …">Opportunity Option anlegen</Button>
        <Button disabled disabledReason="Demonstration der benannten Sperre">Gesperrt</Button>
      </div>
    ),
  },
  {
    id: 'form-field', groupId: 'foundations', title: 'FormField', contractId: 'components-core · FormField',
    requirements: ['FORM-001', 'FORM-003'], composedContracts: ['Skeleton'],
    interactionStates: ['default', 'hover', 'focus', 'disabled', 'readOnly'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Visible label, helper, error/reason slots and aria-busy owner.',
    render: () => <FormFieldDemo />,
  },
  {
    id: 'select', groupId: 'foundations', title: 'Select', contractId: 'components-core · Select',
    requirements: ['LOCALE-004', 'STATE-006'], composedContracts: ['FormField'],
    interactionStates: ['default', 'hover', 'focus', 'disabled'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Native select stays within its host with long localized values.',
    render: () => <SelectDemo />,
  },
  {
    id: 'layout', groupId: 'foundations', title: 'SectionSheet · PageHeader · SmallText',
    contractId: 'components-core · Product layout primitives', requirements: ['LAYOUT-003'],
    composedContracts: [], interactionStates: ['not applicable — static layout'], dataStates: STATIC_LAYOUT_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Typed React roots reuse the canonical a3-sheet/a3-masthead/a3-cap API.',
    render: () => (
      <SectionSheet as="div" title="Abschnitt" intro="Ein zusammenhängender Produktblock.">
        <PageHeader title="Bildschirmtitel" meta="Stand 08/2026" lede="Ein stabiler Titel in jedem Datenzustand." />
        <SmallText>Neutrale Metadaten in Small 14/20.</SmallText>
      </SectionSheet>
    ),
  },
  {
    id: 'card', groupId: 'foundations', title: 'Card', contractId: 'components-core · Card',
    requirements: ['CARD-001'], composedContracts: ['Badge', 'Button'],
    interactionStates: ['default', 'hover', 'focus'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'One stretched primary destination; secondary action remains separate.',
    render: () => <CardDemo />,
  },
  {
    id: 'badge', groupId: 'foundations', title: 'Badge', contractId: 'components-core · Badge',
    requirements: ['BADGE-001', 'BADGE-002'], composedContracts: [],
    interactionStates: ['default'], dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Text plus sign carries status beyond color.', render: () => <Badge sign="✓">bestätigt</Badge>,
  },
  {
    id: 'disclosure', groupId: 'foundations', title: 'DisclosureRow',
    contractId: 'components-core · DisclosureRow', requirements: ['TABLE-004', 'TABLE-005'],
    composedContracts: ['DataTable'], interactionStates: ['default', 'hover', 'focus', 'expanded'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Native button owns aria-expanded/controls inside a scroll-safe table.', render: () => <DisclosureDemo />,
  },
  {
    id: 'segmented', groupId: 'selections', title: 'SegmentedControl',
    contractId: 'components-core · SegmentedControl', requirements: ['TABS-002', 'DENSITY-002', 'LOCALE-004'],
    composedContracts: [], interactionStates: ['default', 'hover', 'focus', 'selected', 'disabled'],
    dataStates: LOCAL_CONTROL_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'One native radio API with visible legend, check, text, and selection border.', render: () => <SegmentedDemo />,
  },
  {
    id: 'segmented-compact', groupId: 'selections', title: 'SegmentedControl · compact',
    contractId: 'components-core · SegmentedControl',
    requirements: ['TABS-002', 'DENSITY-002', 'LOCALE-004', 'R-04'],
    composedContracts: [], interactionStates: ['default', 'hover', 'focus', 'selected', 'disabled'],
    dataStates: LOCAL_CONTROL_STATES, blockedVariants: [], maturity: 'alpha',
    note: 'Visible height 32 px; the press and focus target stays 44 × 44 through '
      + '.hit-target::before, and each segment stays at least 44 px WIDE so the two '
      + 'invisible zones cannot overlap — both halves of R-04, not one.',
    evidence: 'Same radio API and same selection carrier as the default size, at '
      + '--size-control-visual-sm.',
    render: () => <SegmentedCompactDemo />,
  },
  {
    id: 'combobox', groupId: 'selections', title: 'Combobox',
    contractId: 'components-core · Combobox',
    requirements: ['LOCALE-004', 'STATE-003', 'R-04'],
    composedContracts: [],
    interactionStates: ['default', 'hover', 'focus', 'open', 'active-option', 'selected', 'disabled'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    note: 'Single select from a list that narrows as it is typed — what '
      + 'SegmentedControl cannot do past three values and Select cannot do at all.',
    evidence: 'ARIA 1.2 editable combobox: the role is on the input, the popup is a '
      + 'listbox, the active option is named by aria-activedescendant so typing is '
      + 'never interrupted, and the field never keeps an uncommitted query.',
    render: () => <ComboboxDemo />,
  },
  {
    id: 'switch', groupId: 'selections', title: 'Switch', contractId: 'components-core · Switch',
    requirements: ['OPTION-008'], composedContracts: [], interactionStates: ['default', 'hover', 'focus', 'checked', 'disabled'],
    dataStates: LOCAL_CONTROL_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'One canonical Switch DOM/CSS API with label and Ein/Aus text.', render: () => <SwitchDemo />,
  },
  {
    id: 'radiocards', groupId: 'selections', title: 'RadioCardGroup',
    contractId: 'components-core · RadioCardGroup', requirements: ['RADIO-001', 'RADIO-002', 'OPTION-009'],
    composedContracts: [], interactionStates: ['default', 'hover', 'focus', 'selected', 'disabled'],
    dataStates: LOCAL_CONTROL_STATES, blockedVariants: ['control-indicator size ADR'], maturity: 'alpha',
    evidence: 'Consequence remains visible and native arrows move and choose.', render: () => <RadioCardDemo />,
  },
  {
    id: 'dialog', groupId: 'feedback', title: 'Dialog', contractId: 'components-core · Dialog',
    requirements: ['FEEDBACK-002', 'KEY-002', 'R-21'], composedContracts: ['Button'],
    interactionStates: ['open', 'focus', 'closing'], dataStates: ACTION_STATES,
    blockedVariants: ['motion token values remain ADR-pending'], maturity: 'alpha',
    evidence: 'Live portal specimen uses inert background, title focus, trap, topmost Escape, and focus return.',
    render: () => <DialogDemo />,
  },
  {
    id: 'readiness', groupId: 'feedback', title: 'ReadinessChecklist (DC-26)', contractId: 'DC-26',
    requirements: ['R-20'], composedContracts: ['NextStep'], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Every unmet output requirement is named; no ring or percentage.',
    render: () => (
      <ReadinessChecklist
        label="Kundenprofil clientScreen"
        items={[
          { id: 'scope', label: 'Declared Pricing Scope', ready: true },
          { id: 'classification', label: 'Klassifikation bestätigt', ready: false, detail: 'Quelle: Gebäudeklassifikation' },
        ]}
        nextAction={<Button variant="primary">Klassifikation prüfen</Button>}
      />
    ),
  },
  {
    id: 'next-step', groupId: 'feedback', title: 'NextStep (DC-27)', contractId: 'DC-27',
    requirements: ['R-20'], composedContracts: ['Button'], interactionStates: ['default'], dataStates: ACTION_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Exactly one visible primary continuation.',
    render: () => <NextStep description="Die Voraussetzungen sind erfüllt." action="Opportunity Option anlegen" onAction={() => {}} />,
  },
  {
    id: 'output-profile', groupId: 'feedback', title: 'OutputProfileSwitch (DC-22)', contractId: 'DC-22',
    requirements: ['GATE-001', 'GATE-003', 'GATE-005'], composedContracts: ['SegmentedControl', 'Button'],
    interactionStates: ['default', 'focus', 'selected', 'disabled'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha',
    evidence: 'The client projection has a permanent text indicator, gated entry, and an explicit exit.',
    render: () => <OutputProfileDemo />,
  },
  {
    id: 'provenance', groupId: 'domain', title: 'ProvenanceChip (DC-1)', contractId: 'DC-1',
    requirements: ['D-22'], composedContracts: [], interactionStates: ['default'], dataStates: STATIC_LAYOUT_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Sign and text, never color alone.',
    render: () => <div className="a3-row">
      <ProvenanceChip provenance={{ kind: 'document', label: 'aus Dokument', detail: 'S. 15' }} />
      <ProvenanceChip provenance={{ kind: 'customerConfirmed', label: 'vom Kunden bestätigt' }} />
    </div>,
  },
  {
    id: 'origin', groupId: 'domain', title: 'OriginPopover (DC-21)', contractId: 'DC-21',
    requirements: ['KEY-002'], composedContracts: ['Dialog'], interactionStates: ['default', 'open', 'focus'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Esc closes and returns focus.',
    render: () => (
      <p className="numeric">≈{NNBSP}3.818.000{NNBSP}€ <OriginPopover rows={[{ label: 'Grundleistung', value: `3.090.000${NNBSP}€` }]} rounding="Gerundet auf 1.000 €" runRef="DEMO-RUN-0007" /></p>
    ),
  },
  {
    id: 'numericfield', groupId: 'domain', title: 'NumericField (DC-4)', contractId: 'DC-4',
    requirements: ['FORM-001'], composedContracts: ['FormField', 'ProvenanceChip'],
    interactionStates: ['default', 'focus', 'error'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Enter confirms, Tab records manually, Esc discards.',
    render: () => <NumericField label="Demo-Fläche" value={new Decimal('1500')} unit="m²" provenance={{ kind: 'document', label: 'aus Dokument' }} onCommit={() => {}} />,
  },
  {
    id: 'uncertainty', groupId: 'domain', title: 'EstimateUncertaintyBadge (DC-3)', contractId: 'DC-3',
    requirements: ['R-08'], composedContracts: ['Badge'], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Explicit ± interval in text.', render: () => <EstimateUncertaintyBadge language="de" presentation="compact" pp={22} />,
  },
  {
    id: 'docanalysis', groupId: 'domain', title: 'DocumentAnalysis (DC-10)', contractId: 'DC-10',
    requirements: ['STATE-005', 'SKELETON-001'], composedContracts: ['Button', 'DataStateBlock'],
    interactionStates: ['idle', 'loading', 'cancelled', 'ready'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Live fixture simulation with phase protocol and no invented percentage.',
    render: () => <DocumentAnalysis docs={demo.documents.map((document) => ({ file: document.file, pages: typeof document.pages === 'number' ? document.pages : null, parseStatus: document.parseStatus }))} onManualCapture={() => {}} />,
  },
  // SIDEBAR 03 (backlog 2be8e69c, SB-21): the four offer-rail contracts in
  // components-core.md §13. None of the four is an extracted, standalone
  // React component (they compose inline inside OfferPanel.tsx's own
  // markup) — the specimen shows the SAME canonical CSS classes the
  // product renders, matching the classes named by the contract's own
  // "Анатомия" section, not a second implementation of the rail.
  {
    id: 'offer-rail-shell', groupId: 'domain', title: 'OfferRailShell (§13)', contractId: 'OfferRailShell',
    requirements: ['SB-29', 'SB-19'], composedContracts: [], interactionStates: ['default'],
    dataStates: declareDataStates(['empty', 'partial', 'ready', 'permission'],
      'error/loading/stale belong to the calculation owner above the rail, not the shell'),
    blockedVariants: [], maturity: 'beta',
    evidence: 'One scroll owner; a real, visually hidden h2 root heading (SB-29) beneath the landmark aria-label.',
    render: () => (
      <aside aria-label="Angebot" className="a3-rail" style={{ width: '20rem', maxHeight: '12rem', overflowY: 'auto' }}>
        <h2 className="a3-visually-hidden">Angebot</h2>
        <div className="a3-rail-sticky-top">
          <div className="a3-rail-header-budget">
            <p className="a3-mtag">Gesamt · gesamter Komplex</p>
          </div>
        </div>
      </aside>
    ),
  },
  {
    id: 'offer-rail-band', groupId: 'domain', title: 'StickyCommercialBand (§13)', contractId: 'StickyCommercialBand',
    requirements: ['SB-01', 'SB-02', 'SB-17'], composedContracts: ['EstimateUncertaintyBadge', 'OriginPopover'],
    interactionStates: ['default', 'preview', 'changed'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'beta',
    evidence: 'Height-budgeted heroband with an unreserved, overlaid change slot and a scoped aria-live announcer (SB-17), not the whole band.',
    render: () => (
      <div className="a3-heroband">
        <div className="a3-hb a3-hb-total">
          <h3 className="a3-hb-cap">Gesamt netto · Grundleistung All3</h3>
          <p className="a3-hb-num numeric">3.818.000<span className="a3-hb-unit">{NNBSP}€</span></p>
        </div>
        <div className="a3-hb">
          <p className="a3-hb-num numeric">2.545<span className="a3-hb-unit">{NNBSP}€/m²</span></p>
          <p className="a3-hb-cap">WFL nach WoFlV</p>
        </div>
      </div>
    ),
  },
  {
    id: 'offer-rail-composition-row', groupId: 'domain', title: 'CompositionRow (§13)', contractId: 'CompositionRow',
    requirements: ['SB-03', 'SB-13'], composedContracts: [], interactionStates: ['default', 'expanded'],
    dataStates: declareDataStates(['empty', 'partial', 'ready', 'permission'], 'error/loading/stale belong to the calculation owner'),
    blockedVariants: [], maturity: 'beta',
    evidence: 'One merged DIN-276 list (no recap/drivers duplication, SB-03); same-label siblings aggregate in the client profile (SB-13).',
    render: () => (
      <table className="a3-kg w-full border-collapse">
        <tbody>
          <tr className="a3-expand a3-open">
            <td><button type="button" className="a3-twistbtn" aria-expanded>KG 300 Baukonstruktionen</button></td>
            <td className="a3-num">2.672.000{NNBSP}€</td>
            <td className="a3-num">67{NNBSP}%</td>
          </tr>
          <tr className="a3-kg-child">
            <td colSpan={3}>
              <ul>
                <li className="flex justify-between gap-2 border-b border-border-subtle py-1 text-small">
                  <span className="text-text-secondary">Energiestandard EH 55</span>
                  <span className="numeric shrink-0 text-text-primary">≈{NNBSP}+{NNBSP}155.000{NNBSP}€</span>
                </li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: 'offer-rail-table', groupId: 'domain', title: 'RailTable (§13)', contractId: 'RailTable',
    requirements: ['SB-18', 'SB-31', 'SB-32'], composedContracts: ['OriginPopover'],
    interactionStates: ['default', 'focus'], dataStates: declareDataStates(['partial', 'ready'], 'the table itself does not own empty/loading/error/stale/permission — its owner does'),
    blockedVariants: [], maturity: 'beta',
    evidence: '--color-text-secondary rounding note (SB-18, not --color-text-muted below its minimum size) and a 44×44 Details trigger (SB-31).',
    render: () => (
      <div className="a3-tbl-scroll">
        <table className="a3-driver-table">
          <tbody>
            <tr className="a3-drv">
              <th scope="row" className="py-2 pr-3 text-left font-regular text-text-secondary">Energiestandard EH 55</th>
              <td className="a3-val">
                ≈{NNBSP}+{NNBSP}155.000{NNBSP}€
                <span className="mt-1 block font-regular">
                  <OriginPopover triggerLabel="Details" rows={[{ label: 'Beitrag exakt', value: `+${NNBSP}155.000,00${NNBSP}€` }]} rounding={null} runRef={null} accessibleName="Details · Energiestandard EH 55" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-small text-text-secondary">Zeilen und Prozentanteile werden unabhängig gerundet.</p>
      </div>
    ),
  },

  /* ============ REDESIGN R1 (efcbdaf3) — new canonical capabilities ====
     Individual primitives first, then the required composed reference
     specimens (ticket §"REQUIRED COMPOSED REFERENCE SPECIMENS") proving
     the foundations work together, not just in isolation. Realistic
     commercial data throughout (rule: "real content, not ideal content"). */
  {
    id: 'r1-surface-foundations', groupId: 'r1', title: 'Surface foundations (R1)', contractId: 'R1 · surface model',
    requirements: ['DESIGN-04'], composedContracts: [],
    interactionStates: ['canvas', 'paper', 'stage', 'stage-deep'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Four comparable semantic compositions show their role before the caption. They are governance evidence only, not product adoption: Canvas remains active; Paper, Stage, and Stage-deep remain approved for their named downstream owners.',
    render: () => <SurfaceFoundationsDemo />,
  },
  {
    id: 'r1-mediaframe', groupId: 'r1', title: 'MediaFrame (R1)', contractId: 'R1 · MediaFrame',
    requirements: ['DESIGN-05'], composedContracts: [],
    interactionStates: ['loaded', 'loading', 'empty', 'unavailable', 'error', 'fallback'],
    dataStates: declareDataStates(['ready', 'empty', 'error'], 'media states are the contract here, not the data-state axis'),
    blockedVariants: [], maturity: 'alpha',
    evidence: 'All six states render designed placeholder art, never a grey rectangle; error state offers retry.',
    render: () => (
      <div className="grid grid-cols-3 gap-4">
        {/* Reuses an EXISTING provenanced asset (manifest: design-system/
            assets/options/manifest.json, OPT-IMAGE-checked) rather than a
            newly-sourced Unsplash/Pexels placeholder — no new external
            asset was fetched to build this specimen. */}
        <MediaFrame ratio="card" state="loaded" src={optionImage('fassade', 'timber')?.url} alt="Fassade in Holzverkleidung" seed="Musterprojekt Nordfeld" caption="Fassade · Holz" sourceId="fassade/timber" />
        <MediaFrame ratio="card" state="loading" seed="Musterprojekt Nordfeld" />
        <MediaFrame ratio="card" state="fallback" seed="Musterprojekt Nordfeld" fallbackLabel="Noch kein Projektfoto hinterlegt" />
        <MediaFrame ratio="tile" state="empty" seed="Haus B" />
        <MediaFrame ratio="tile" state="error" seed="Haus B" onRetry={() => {}} />
        <MediaFrame ratio="pano" state="unavailable" seed="Nordfeld" />
      </div>
    ),
  },
  {
    id: 'r1-compositionbar', groupId: 'r1', title: 'CompositionBar (R1)', contractId: 'R1 · CompositionBar',
    requirements: ['DESIGN-12'], composedContracts: [],
    interactionStates: ['compact', 'expanded', 'incomplete-remainder'],
    dataStates: declareDataStates(['ready', 'partial'], 'the bar itself has no loading/error state — its data owner does'),
    blockedVariants: [], maturity: 'alpha',
    evidence: 'Fixture-exact reconciliation proven in src/design-system/__tests__/composition-bar.test.ts; a genuinely partial input renders an honest labelled remainder, never a silently-100%-filled bar (rule 16).',
    render: () => {
      const segments: CompositionSegment[] = [
        { id: 'kg200', label: 'KG 200 · Herrichten & Erschließen', value: new Decimal('184300'), categorySlot: 1 },
        { id: 'kg300', label: 'KG 300 · Baukonstruktion', value: new Decimal('2148900'), categorySlot: 2 },
        { id: 'kg400', label: 'KG 400 · Technische Anlagen', value: new Decimal('612050'), categorySlot: 3 },
        { id: 'kg500', label: 'KG 500 · Außenanlagen', value: new Decimal('96300'), categorySlot: 4 },
      ]
      const total = segments.reduce((acc, s) => acc.plus(s.value), new Decimal(0))
      return (
        <div className="grid gap-4">
          <div>
            <p className="a3-cap mb-1">compact</p>
            <CompositionBar segments={segments} total={total} variant="compact" />
          </div>
          <div>
            <p className="a3-cap mb-1">expanded</p>
            <CompositionBar segments={segments} total={total} variant="expanded" />
          </div>
          <div>
            <p className="a3-cap mb-1">partial — KG 600 not yet priced</p>
            <CompositionBar segments={segments.slice(0, 2)} total={total} variant="expanded" />
          </div>
        </div>
      )
    },
  },
  {
    id: 'r1-workflowstepper', groupId: 'r1', title: 'WorkflowStepper (R1)', contractId: 'R1 · WorkflowStepper',
    requirements: ['DESIGN-14'], composedContracts: [],
    interactionStates: ['upcoming', 'current', 'done', 'attention', 'blocked', 'skipped', 'done+current composite'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'One family, two sizes; aria-current="step" (not "true"); the composite done+current class pairing carries the same guard that fixed the recorded orange-on-green collision elsewhere in this system.',
    render: () => {
      const projectSteps: WorkflowStep[] = [
        { id: 'doc', label: 'Dokumente', state: 'done', onSelect: () => {} },
        { id: 'baseline', label: 'Grundlage', state: 'done', previouslyDone: true, onSelect: () => {} },
        { id: 'scope', label: 'Umfang', state: 'current', previouslyDone: true, rationale: 'Zurückgekehrt, um die Kellervariante zu prüfen.', onSelect: () => {} },
        { id: 'config', label: 'Konfiguration', state: 'attention', rationale: 'KG 400 hat noch keine Auswahl.', onSelect: () => {} },
        { id: 'export', label: 'Export', state: 'blocked', blockedReason: 'Erst nach vollständiger Konfiguration verfügbar.' },
      ]
      const chapterSteps: WorkflowStep[] = [
        { id: 'kg200', label: 'KG 200', state: 'done', onSelect: () => {} },
        { id: 'kg300', label: 'KG 300', state: 'current' },
        { id: 'kg400', label: 'KG 400', state: 'upcoming' },
        { id: 'kg500', label: 'KG 500', state: 'skipped' },
      ]
      return (
        <div className="grid gap-6">
          <WorkflowStepper ariaLabel="Projekt-Workflow" size="workflow" steps={projectSteps} />
          <div style={{ maxWidth: '16rem' }}>
            <WorkflowStepper ariaLabel="Konfigurator-Kapitel" size="chapter" steps={chapterSteps} />
          </div>
        </div>
      )
    },
  },
  {
    id: 'r1-datefield', groupId: 'r1', title: 'DateField (R1)', contractId: 'R1 · DateField',
    requirements: ['DESIGN-15'], composedContracts: [], interactionStates: ['empty', 'filled', 'invalid'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Replaces the native date input on Termine/Kundenansicht; keyboard-first TT.MM.JJJJ entry, no native calendar chrome.',
    render: () => <DateField label="Baubeginn" value={new Date(2027, 2, 1)} onCommit={() => {}} helperText="Format TT.MM.JJJJ" />,
  },
  {
    id: 'r1-stepper', groupId: 'r1', title: 'Stepper (R1)', contractId: 'R1 · Stepper',
    requirements: ['DESIGN-15'], composedContracts: [], interactionStates: ['default', 'min-reached', 'max-reached'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Replaces the native range slider for Rabatt; discrete steps with an accessible name/value pair a slider cannot express, plus a live-impact slot.',
    render: () => <Stepper label="Rabatt" value={3} min={0} max={15} unit="%" onChange={() => {}} impact={<span>− 114.500{NNBSP}€</span>} />,
  },

  /* ── Composed reference specimens (ticket-required, not decoration) ── */
  {
    id: 'r1-composed-project-identity', groupId: 'r1', title: 'Composed: Project Identity', contractId: 'R1 · composed',
    requirements: ['DESIGN-05', 'DESIGN-04'], composedContracts: ['MediaFrame'],
    interactionStates: ['default', 'fallback'], dataStates: STATIC_LAYOUT_STATES, blockedVariants: [],
    maturity: 'alpha',
    evidence: 'Panoramic MediaFrame + a realistically long German project name (rule 37: overflow-wrap/hyphens under lang) + the DC-38 metric triple (rule 31: Zwischensumme hero on white via .text-display-accent, Leitkennzahl naming its norm via engine/money rate(), Bauzeit) — identity, hierarchy and metrics composed, not a product migration. Second row proves the designed fallback treatment for a project with no photo yet.',
    render: () => {
      const leitkennzahl = rate(new Decimal('7845000'), new Decimal('3082'), 'WFL_WOFLV')
      return (
        <div className="grid gap-6">
          <div style={{ maxWidth: '32rem' }}>
            <MediaFrame ratio="pano" state="loaded" src={optionImage('fassade', 'timber')?.url} alt="Fassade in Holzverkleidung" seed="Quartiersentwicklung Friedrichshafen-Nord" caption="Ansicht Süd · Baufeld 3" sourceId="fassade/timber" />
            <p className="mt-3 text-section-title font-bold text-text-primary" lang="de" style={{ overflowWrap: 'break-word', hyphens: 'auto' }}>
              Quartiersentwicklung Friedrichshafen-Nord, Baufeld 3
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-8">
              <div>
                <p className="a3-cap">Zwischensumme der kalkulierten Positionen</p>
                <p className="text-display-accent numeric">{moneyLabel(present(new Decimal('7845000')), '€')}</p>
              </div>
              <div>
                <p className="a3-cap">Leitkennzahl</p>
                <p className="font-bold text-text-primary numeric" style={{ fontSize: 'var(--type-display-numeric-narrow-size)', lineHeight: 'var(--type-display-numeric-narrow-line)' }}>
                  {leitkennzahl.display}
                  <span style={{ fontSize: 'var(--type-heading-3-size)' }}>{NNBSP}€/m²{NNBSP}WFL nach WoFlV</span>
                </p>
              </div>
              <div>
                <p className="a3-cap">Bauzeit</p>
                <p className="font-bold text-text-primary numeric" style={{ fontSize: 'var(--type-display-numeric-narrow-size)', lineHeight: 'var(--type-display-numeric-narrow-line)' }}>
                  14
                  <span style={{ fontSize: 'var(--type-heading-3-size)' }}>{NNBSP}Monate</span>
                </p>
              </div>
            </div>
          </div>
          <div style={{ maxWidth: '32rem' }}>
            <p className="a3-cap mb-1">designed fallback — kein Projektfoto hinterlegt</p>
            <MediaFrame ratio="pano" state="fallback" seed="Quartiersentwicklung Friedrichshafen-Nord" fallbackLabel="Noch kein Projektfoto hinterlegt" />
          </div>
        </div>
      )
    },
  },
  {
    id: 'r1-composed-option', groupId: 'r1', title: 'Composed: Option / Commercial Object', contractId: 'R1 · composed',
    requirements: ['DESIGN-09', 'DESIGN-12'], composedContracts: ['MediaFrame', 'CompositionBar', 'Badge'],
    interactionStates: ['default', 'selected'], dataStates: STATIC_LAYOUT_STATES, blockedVariants: [],
    maturity: 'alpha',
    evidence: 'Identity (MediaFrame) + hero section-metric + CompositionBar + status in one card — the new foundations composed, not a product migration.',
    render: () => {
      const segments: CompositionSegment[] = [
        { id: 'kg200', label: 'KG 200', value: new Decimal('184300'), categorySlot: 1 },
        { id: 'kg300', label: 'KG 300', value: new Decimal('2148900'), categorySlot: 2 },
        { id: 'kg400', label: 'KG 400', value: new Decimal('612050'), categorySlot: 3 },
      ]
      const total = segments.reduce((acc, s) => acc.plus(s.value), new Decimal(0))
      return (
        <div className="border border-border-subtle" style={{ maxWidth: '22rem' }}>
          <MediaFrame ratio="card" state="fallback" seed="Option A · Haus A+B" fallbackLabel="Kein Bild — Konzeptdarstellung" />
          <div className="p-4">
            <Badge sign="+" kind="metadata">Neu</Badge>
            <p className="mt-2 text-section-title font-bold text-text-primary">Option A · Haus A+B</p>
            <p className="mt-1 text-metric-section font-bold text-text-primary numeric">
              {moneyLabel(present(total), '€')}
            </p>
            <p className="text-small text-text-secondary">Zwischensumme der kalkulierten Positionen</p>
            <div className="mt-3">
              <CompositionBar segments={segments} total={total} variant="compact" />
            </div>
          </div>
        </div>
      )
    },
  },
  {
    id: 'r1-composed-workflow', groupId: 'r1', title: 'Composed: Workflow', contractId: 'R1 · composed',
    requirements: ['DESIGN-14'], composedContracts: ['WorkflowStepper'],
    interactionStates: ['upcoming', 'current', 'done', 'blocked', 'direction-forward', 'direction-backward'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Project + chapter WorkflowStepper above chapter content that demonstrates the DIRECTION motion verb (motion.ts, ADR-R1-05) with a genuinely working reduced-motion equivalent (see the motion.ts fix in this same candidate) — stepper and directional transition as one family, not isolated widgets.',
    render: () => <WorkflowDirectionDemo />,
  },
  {
    id: 'r1-composed-stage', groupId: 'r1', title: 'Composed: Commercial Stage Moment', contractId: 'R1 · composed',
    requirements: ['DESIGN-04', 'DESIGN-12'], composedContracts: ['CompositionBar'],
    interactionStates: ['default'], dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'The stage-deep surface + display hero + expanded composition — the one expressive peak (ADR-R1-02), flat geometry preserved (ADR-R1-00).',
    render: () => {
      const segments: CompositionSegment[] = [
        { id: 'kg200', label: 'KG 200', value: new Decimal('184300'), categorySlot: 1 },
        { id: 'kg300', label: 'KG 300', value: new Decimal('2148900'), categorySlot: 2 },
        { id: 'kg400', label: 'KG 400', value: new Decimal('612050'), categorySlot: 3 },
        { id: 'kg700', label: 'KG 700', value: new Decimal('312449'), categorySlot: 6 },
      ]
      const total = segments.reduce((acc, s) => acc.plus(s.value), new Decimal(0))
      // minWidth: the stage-deep hero renders at display-numeric size
      // (64px) — a real 7-digit total overflowed the narrow gallery grid
      // column (scrollWidth 383 > clientWidth 336, caught visually via
      // Playwright, not by any automated check); this specimen shows the
      // component at a width closer to its real consuming surface (the
      // offer rail, ~440-520px) rather than squeezed to fit.
      return (
        <div className="p-8" style={{ background: 'var(--color-surface-stage-deep)', minWidth: '26rem' }}>
          <p className="text-small text-text-inverse">Gesamt netto · Grundleistung All3</p>
          <p
            className="mt-1 font-bold numeric"
            style={{
              fontSize: 'var(--type-display-numeric-desktop-size)',
              lineHeight: 'var(--type-display-numeric-desktop-line)',
              color: 'var(--color-text-display-accent-on-stage-deep)',
            }}
          >
            {formatDE(total, 0)}<span style={{ fontSize: 'var(--type-heading-3-size)' }}>{NNBSP}€</span>
          </p>
          <div className="mt-6">
            <CompositionBar segments={segments} total={total} variant="expanded" onDark />
          </div>
        </div>
      )
    },
  },
  // ── VR3-01 · project readiness family ─────────────────────────────────
  // Ten canonical capabilities declared by VR3-01 (backlog 1dedc823) for the
  // project half of the journey. Each is DECLARED here once and CONSUMED by
  // `src/screens/ProjectHome.tsx`; the manifest at
  // `design-system/capability-governance.json` records that adoption, and
  // GOV-CAPABILITY refuses a registry-only declaration.
  {
    id: 'vr3-semantic-status', groupId: 'domain', title: 'SemanticStatus',
    contractId: 'VR3 · SemanticStatus', requirements: ['STATE-003', 'R-08'],
    composedContracts: [], interactionStates: ['default'], dataStates: STATIC_LAYOUT_STATES,
    blockedVariants: [], maturity: 'alpha',
    evidence: 'Every tone renders a non-colour glyph AND a word; error is reserved for something that actually failed, never for a question.',
    render: () => (
      <div className="grid gap-2">
        <SemanticStatus tone="neutral" label="Nicht gestartet" />
        <SemanticStatus tone="progress" label="Läuft" />
        <SemanticStatus tone="ok" label="Verarbeitet" />
        <SemanticStatus tone="attention" label="Geringe Erkennung" reason="Seite 3 schwer lesbar" />
        <SemanticStatus tone="error" label="Fehlgeschlagen" />
        <SemanticStatus tone="stale" label="Erneut prüfen" />
        <SemanticStatus tone="unknown" label="Unbekannt" />
      </div>
    ),
  },
  {
    id: 'vr3-authority-trace', groupId: 'domain', title: 'AuthorityTrace',
    contractId: 'VR3 · AuthorityTrace', requirements: ['DC-1', 'M-1', 'STATE-003'],
    composedContracts: ['SemanticStatus'], interactionStates: ['default'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'The value and its authority are ONE element: nothing can render the number without its origin, and newer evidence marks a confirmed value stale instead of replacing it.',
    render: () => (
      <div className="grid gap-4">
        <AuthorityTrace
          authority="confirmed"
          evidence={{ label: '22_B_Wohnflaechenberechnung_V2.pdf', version: 'V2', issuedAt: '2026-04-27' }}
          confirmation={{ actor: 'sales-user', at: '2026-05-02' }}
          layout="stacked"
        >
          <span className="numeric">3.410 m²</span>
        </AuthorityTrace>
        <AuthorityTrace
          authority="confirmed"
          freshness={{ staleReason: 'Neuere Planversion liegt vor — erneut prüfen.' }}
          layout="stacked"
        >
          <span className="numeric">19.710 m²</span>
        </AuthorityTrace>
      </div>
    ),
  },
  {
    id: 'vr3-metric-readout', groupId: 'domain', title: 'MetricReadout',
    contractId: 'VR3 · MetricReadout', requirements: ['DC-38', 'R-24', 'LOCALE-004'],
    composedContracts: ['SemanticStatus'], interactionStates: ['default'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'The unit is a separate element at a smaller size on the same baseline, never concatenated into the value string.',
    render: () => (
      <dl className="grid gap-4">
        <MetricReadout label="BGF R+S" value="19.470" unit="m²" variant="emphasis" authority="derived" />
        <MetricReadout label="Gebäude" value="3" variant="compact" />
      </dl>
    ),
  },
  {
    id: 'vr3-processing-job', groupId: 'domain', title: 'ProcessingJob',
    contractId: 'VR3 · ProcessingJob', requirements: ['DC-10', 'R-25'],
    composedContracts: ['SemanticStatus', 'DocumentRow'], interactionStates: ['default', 'busy'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Per-file truth with the real denominator: no page spinner stands in for the job story and no percentage is estimated. READY carries no progress treatment at all, and a terminal job with open outcomes is never dressed as an unqualified success.',
    render: () => (
      <div className="grid gap-6">
        <ProcessingJob
          state="RUNNING" processedCount={27} totalCount={36} progressPercent={75}
          activeFileName="04_Flaechenliste_Gesamt_FINAL.xlsx.pdf" activePhaseLabel="Wird gegengeprüft"
          filterLegend="Dateien filtern"
        >
          <DocumentRow
            file="24_C_Grundriss_UG_V1_SCAN.pdf" typeLabel="Grundriss" versionLabel="V1"
            associationLabel="Gebäude Stadthaus" state="FAILED" stateLabel="Fehlgeschlagen"
            stateReason="sehr geringe Erkennung · beschnittener Scan" progress={1}
          />
        </ProcessingJob>
        {/* The rail layout: the same job as a narrow contextual column
            beside the register it describes. No row list, and READY shows
            no progress bar because no work has been accepted. */}
        <div style={{ inlineSize: 'var(--measure-analysis-rail)' }}>
          <ProcessingJob
            layout="rail" state="READY" heading="Bereit für die Analyse"
            processedCount={0} totalCount={8} progressPercent={0}
            summary={<p className="a3-docws-rail-lede">8 Dokumente · 8 analysierbar</p>}
            actions={<Button variant="primary" onClick={() => {}}>Alle 8 analysierbaren Dokumente analysieren</Button>}
          />
        </div>
        <div style={{ inlineSize: 'var(--measure-analysis-rail)' }}>
          <ProcessingJob
            layout="rail" state="COMPLETE_WITH_ISSUES" heading="Mit Hinweisen abgeschlossen"
            processedCount={36} totalCount={36} progressPercent={100}
            actions={<Button variant="primary" onClick={() => {}}>Projektverständnis prüfen</Button>}
          />
        </div>
      </div>
    ),
  },
  {
    id: 'docws-workflow-navigator', groupId: 'domain', title: 'WorkflowNavigator',
    contractId: 'DOCWS · WorkflowNavigator', requirements: ['STEP-003', 'KEY-003', 'R-04'],
    composedContracts: [], interactionStates: ['default', 'current', 'locked'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Six grouped stages replace thirteen first-level rows without changing one route: grouping is presentation. A stage discloses its own members only while it is current, and a future stage is neutral orientation rather than a repeated failure.',
    render: () => {
      const stages: WorkflowStage[] = [
        { id: 'documents', label: 'Dokumente', state: 'current', onSelect: () => {} },
        {
          id: 'understand',
          label: 'Verstehen',
          state: 'locked',
          lockedReason: 'Dokumentanalyse fehlt',
        },
        {
          id: 'configure',
          label: 'Konfigurieren',
          state: 'upcoming',
          steps: [
            { id: 'createOption', label: 'Option anlegen', state: 'upcoming' },
            { id: 'buildingScope', label: 'Gebäude & Umfang', state: 'upcoming' },
          ],
        },
        { id: 'calculate', label: 'Kalkulieren', state: 'upcoming' },
        { id: 'validate', label: 'Prüfen', state: 'upcoming' },
        { id: 'present', label: 'Präsentieren', state: 'upcoming' },
      ]
      /**
       * VR3-KG-UNIFY-00 — the same capability with its second presentation:
       * a current stage whose members are an ORDERED SEQUENCE draws them as
       * the compact chapter progression. Same members, same disclosure rule.
       */
      const progression: WorkflowStage[] = [
        { id: 'configure', label: 'Konfigurieren', state: 'done', onSelect: () => {} },
        {
          id: 'calculate',
          label: 'Kalkulieren',
          state: 'current',
          onSelect: () => {},
          stepsPresentation: 'progression',
          steps: [
            { id: 'kg200', label: 'KG 200', state: 'done', onSelect: () => {} },
            { id: 'kg300', label: 'KG 300', state: 'current', onSelect: () => {} },
            { id: 'kg400', label: 'KG 400', state: 'upcoming', onSelect: () => {}, attention: '1 ungültige Eingabe' },
            { id: 'kg500', label: 'KG 500', state: 'done', onSelect: () => {}, outOfScope: true },
            { id: 'kg600', label: 'KG 600', state: 'upcoming', onSelect: () => {} },
            { id: 'kg700', label: 'KG 700', state: 'upcoming', onSelect: () => {} },
            { id: 'verantwortung', label: 'Schnittstellen & Verantwortung', shortLabel: 'Verantwortung', state: 'upcoming', onSelect: () => {} },
            { id: 'terminplan', label: 'Terminplan', state: 'locked', lockedReason: 'Kostengruppen offen' },
          ],
        },
        { id: 'validate', label: 'Prüfen', state: 'upcoming' },
        { id: 'present', label: 'Präsentieren', state: 'upcoming' },
      ]
      return (
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <WorkflowNavigator stages={stages} ariaLabel="Projektablauf (Beispiel)" />
          <WorkflowNavigator stages={progression} ariaLabel="Optionsablauf (Beispiel · Kapitelprogression)" />
        </div>
      )
    },
  },
  {
    id: 'docws-pagination', groupId: 'domain', title: 'Pagination',
    contractId: 'DOCWS · Pagination', requirements: ['KEY-003', 'R-04', 'LOCALE-004'],
    composedContracts: [], interactionStates: ['default', 'current', 'disabled'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Controlled page state with a bounded numeric model: seven pages or fewer are all listed, above that first · last · current ±1 with ellipses, and an ellipsis never stands for a single page it could have shown. It owns no live region and implies no scope.',
    render: () => (
      <div className="grid gap-4">
        <Pagination
          page={2} pageCount={6} onPageChange={() => {}}
          ariaLabel="Dokumentseiten (Beispiel, 6 Seiten)"
          rangeLabel="11–20 von 60 Dokumenten"
          pageButtonLabel={(n) => `Seite ${n}`}
        />
        <Pagination
          page={8} pageCount={15} onPageChange={() => {}}
          ariaLabel="Dokumentseiten (Beispiel, 15 Seiten)"
          rangeLabel="71–80 von 150 Dokumenten"
          pageButtonLabel={(n) => `Seite ${n}`}
        />
      </div>
    ),
  },
  {
    id: 'vr3-document-row', groupId: 'domain', title: 'DocumentRow',
    contractId: 'VR3 · DocumentRow', requirements: ['DC-10', 'R-04', 'KEY-003'],
    composedContracts: ['SemanticStatus'], interactionStates: ['default', 'expanded'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'A document is a workflow entity: filename and state are always both present, the accessible name of the state names the file, and inspection is INDEPENDENT of recovery — a row with nothing to retry still has evidence to open.',
    render: () => (
      <ul className="a3-pjob-rows">
        <DocumentRow
          density="compact"
          file="06_A_Grundriss_EG_REV-B.pdf" typeLabel="Grundriss" versionLabel="REV-B"
          associationLabel="Gebäude Kontorhaus" state="READY" stateLabel="Bereit für die Analyse"
          detail={<p className="a3-doc-detail-meta">Beleg · 2026-04-27</p>}
          detailToggleLabel="Beleg ansehen"
          onToggleDetail={() => {}}
        />
        <DocumentRow
          density="compact"
          file="13_A_Grundriss_EG_REV-B_KOPIE.pdf" typeLabel="Grundriss · Doppel" versionLabel="REV-B"
          associationLabel="Gebäude Kontorhaus" state="WARNING" stateLabel="Hinweis"
          note="Inhaltsgleiches Doppel unter anderem Dateinamen" progress={1}
          detail={<p className="a3-doc-detail-meta">Beleg · 2026-05-02</p>}
          detailToggleLabel="Beleg ansehen"
          onToggleDetail={() => {}}
          actions={[
            { id: 'retry', label: 'Erneut lesen', onSelect: () => {} },
            { id: 'remove', label: 'Entfernen', priority: 'ghost', onSelect: () => {} },
          ]}
        />
      </ul>
    ),
  },
  {
    id: 'vr3-prerequisite-state', groupId: 'domain', title: 'PrerequisiteState',
    contractId: 'VR3 · PrerequisiteState', requirements: ['STATE-004', 'DC-24', 'DC-27'],
    composedContracts: ['Button'], interactionStates: ['default'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Before the prerequisite action has produced anything, the downstream result anatomy is NOT MOUNTED — the absence is named instead of being rendered as zeros.',
    render: () => (
      <PrerequisiteState
        eyebrow="Dokumentation vorhanden · Analyse nicht gestartet"
        heading="Wohnhof Lindenhain"
        explanation="Die 8 Projektdokumente liegen bereit."
        absenceTitle="Noch keine Analyseergebnisse"
        absenceDetail="Werte, strittige Angaben und Fragen entstehen erst, wenn die Analyse Belege erzeugt hat."
        action={<Button variant="primary" onClick={() => {}}>Dokumentanalyse starten</Button>}
      />
    ),
  },
  {
    id: 'vr3-action-gate', groupId: 'domain', title: 'ActionGate',
    contractId: 'VR3 · ActionGate', requirements: ['R-12', 'GATE-001'],
    composedContracts: ['Button', 'SemanticStatus'], interactionStates: ['default', 'locked', 'busy', 'error'],
    dataStates: ACTION_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'A workflow gate states its status, its unmet prerequisites, the route that resolves them and the available alternative. A disabled control alone never stands for a gate (rule 12).',
    render: () => (
      <ActionGate
        status="locked"
        reason="Gesperrt: 6 blockierende strittige Angaben entscheiden."
        prerequisites={[
          { id: 'analysis', label: 'Dokumentanalyse abgeschlossen', met: true },
          { id: 'conflicts', label: 'Keine blockierenden strittigen Angaben', met: false, detail: 'Noch offen: 6' },
        ]}
        route={{ label: 'Zu den strittigen Angaben', onSelect: () => {} }}
      >
        <Button variant="primary" disabled disabledReason="Gesperrt: 6 blockierende strittige Angaben entscheiden." onClick={() => {}}>
          Option anlegen
        </Button>
      </ActionGate>
    ),
  },
  {
    id: 'vr3-building-scope-panel', groupId: 'domain', title: 'BuildingScopePanel',
    contractId: 'VR3 · BuildingScopePanel', requirements: ['R-13', 'SCOPE-001'],
    composedContracts: ['MediaFrame', 'SemanticStatus', 'AuthorityTrace', 'ActionGate'],
    interactionStates: ['selected', 'excluded', 'reviewing', 'editing', 'confirmed'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'One system, two densities: a single building is a review, several are a comparison. Every metric, provenance line and edit renders inside exactly one named building, and the identity image supports recognition without ever replacing a label.',
    render: () => (
      <BuildingIdentityGroup label="Gebäude im Angebotsumfang" density="comparison">
        <BuildingIdentityCard
          designation="Gebäude A"
          name="Kontorhaus"
          meta="100 Prozent Büro · Kein UG"
          selected
          status="confirmed"
          onToggle={() => {}}
          selectLabel="Im Angebotsumfang führen · Gebäude A · Kontorhaus"
        />
        <BuildingIdentityCard
          designation="Gebäude B"
          name="Hofhaus"
          meta="100 Prozent Wohnen · UG"
          selected
          status="stale"
          onToggle={() => {}}
          selectLabel="Im Angebotsumfang führen · Gebäude B · Hofhaus"
        />
        <BuildingIdentityCard
          designation="Gebäude C"
          name="Stadthaus"
          meta="Erdgeschoss Gewerbe · Teil-UG"
          selected={false}
          status="unselected"
          onToggle={() => {}}
          selectLabel="Im Angebotsumfang führen · Gebäude C · Stadthaus"
        />
      </BuildingIdentityGroup>
    ),
  },
  {
    id: 'vr3-building-baseline', groupId: 'domain', title: 'BuildingBaselineSheet',
    contractId: 'VR3 · BuildingScopePanel', requirements: ['R-13', 'DATA-001'],
    composedContracts: ['SemanticStatus', 'Button'],
    interactionStates: ['default', 'editing', 'invalid', 'confirmed'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'The baseline heading names its building, so the table below it cannot be read as belonging to another one. Value and provenance are adjacent columns bound by aria-describedby — one object, printed once.',
    render: () => (
      <BuildingBaselineSheet
        title="Grundlage · Gebäude A · Kontorhaus"
        authorityLabel="Herkunft: aus Quelle belegt"
        rows={(
          <>
            <BuildingBaselineRow
              label="Geschosse"
              value="EG + 5 OG"
              provenance={(
                <BuildingBaselineProvenance
                  authority={{ tone: 'ok', label: 'bestätigt' }}
                  evidence="Planwerk"
                />
              )}
            />
            <BuildingBaselineRow
              label="BGF R oberirdisch"
              value="5.820"
              unit="m²"
              provenance={(
                <BuildingBaselineProvenance
                  authority={{ tone: 'neutral', label: 'berechnet' }}
                  evidence="B-DOC-09"
                />
              )}
            />
          </>
        )}
        actions={<Button variant="primary" onClick={() => {}}>Gebäudegrundlage bestätigen</Button>}
      />
    ),
  },
  {
    id: 'vr3-project-readiness', groupId: 'domain', title: 'ProjectReadiness',
    contractId: 'VR3 · ProjectReadiness', requirements: ['DC-27', 'DC-38'],
    composedContracts: ['ActionGate', 'Button'], interactionStates: ['default'],
    dataStates: STATIC_LAYOUT_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'Readiness is derived from states, never from an empty array: "no conflicts recorded" and "conflicts not yet computed" stay different facts.',
    render: () => (
      <ProjectReadiness
        eyebrow="Projekt bereit"
        heading="Alle blockierenden strittigen Angaben sind entschieden."
        rows={[
          { id: 'blocking', label: 'Blockierende strittige Angaben', value: 0 },
          { id: 'metrics', label: 'Erforderliche Angaben', value: 'Vollständig' },
        ]}
        action={<Button variant="primary" onClick={() => {}}>Option anlegen</Button>}
      />
    ),
  },
  {
    id: 'vr3-conflict-resolver', groupId: 'domain', title: 'ConflictResolver',
    contractId: 'VR3 · ConflictResolver', requirements: ['M-1', 'M-4', 'STATE-003'],
    composedContracts: ['AuthorityTrace', 'SemanticStatus', 'Button'],
    interactionStates: ['default', 'selected', 'resolved'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha',
    evidence: 'A comparison, not a red card: each competing value stays inside the source that produced it, the recommendation is labelled as a recommendation, and the rejected value stays visible historically.',
    render: () => (
      <ConflictResolver
        conceptLabel="Wohnungsanzahl Gebäude B" scopeLabel="Gebäude Hofhaus" blocking
        impact="Die Wohnungsanzahl bestimmt Mengen für Wohnungsausbau, Sanitär und Elektro."
        sources={[
          {
            id: 'a', value: '48', authority: 'sourceEvidenced',
            authorityLabel: 'aktuelle Beschreibung · widersprüchliches Feld',
            documentLabel: '23_B_Baubeschreibung_FINAL.pdf', version: 'FINAL', issuedAt: '2026-04-29',
          },
          {
            id: 'b', value: '46', authority: 'sourceEvidenced', recommended: true,
            authorityLabel: 'aktuelle koordinierte Liste',
            documentLabel: '22_B_Wohnflaechenberechnung_V2.pdf', version: 'V2', issuedAt: '2026-04-27',
          },
        ]}
        recommendation="46 übernehmen"
        choiceLegend="Welcher Wert gilt?"
        choices={[
          { id: 'a', label: '48 übernehmen', detail: 'Ältere Quelle', selected: false, onSelect: () => {} },
          { id: 'b', label: '46 übernehmen', detail: 'Systemvorschlag', selected: true, onSelect: () => {} },
        ]}
        confirmAction={<Button variant="primary" onClick={() => {}}>Entscheidung bestätigen</Button>}
      />
    ),
  },
  {
    id: 'vr3-question-queue', groupId: 'domain', title: 'QuestionQueue',
    contractId: 'VR3 · QuestionQueue', requirements: ['DC-9', 'STATE-003'],
    composedContracts: ['SemanticStatus', 'Button'], interactionStates: ['default', 'answered'],
    dataStates: ALL_DATA_STATES, blockedVariants: [], maturity: 'alpha',
    evidence: 'No universal blocking rule: each item states whether it blocks, and a permitted assumption says what will carry into Final Validation. `error` is never a question tone.',
    render: () => (
      <QuestionQueue
        heading="Fragen, keine Fehler"
        summary="7 offene Fragen · 0 davon blockieren · 5 mit zulässiger Annahme."
      >
        <QuestionItem
          kind="question" status="open" blocking={false}
          question="Umfasst Gebäude A den Mieterausbau oder nur Rohbau und Kern?"
          scopeLabel="Gebäude Kontorhaus"
          matters="Wesentlicher Umfangseffekt auf KG 300 und KG 400."
          evidenceContext="Nachtrag zur Kundenvorgabe unvollständig."
          assumption="Annahme: Rohbau und Kern · Kundenbestätigung angefordert."
        />
      </QuestionQueue>
    ),
  },
  // ── VR3-03 · the unified configuration family ─────────────────────────
  // Five canonical capabilities declared by VR3-03 (backlog a0136b78). Each
  // is DECLARED here once and CONSUMED by the product surfaces the manifest
  // at `design-system/capability-governance.json` names; GOV-CAPABILITY
  // refuses a registry-only declaration.
  {
    id: 'vr3-choice-group', groupId: 'domain', title: 'ChoiceGroup',
    contractId: 'VR3 · ChoiceGroup', requirements: ['RADIO-001', 'R-04', 'R-05'],
    composedContracts: [], interactionStates: ['undecided', 'chosen', 'disabled'],
    dataStates: LOCAL_CONTROL_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'A RECORDED DECISION, not a setting: nothing is checked until someone answers, and each option states its own consequence at all times.',
    evidence: 'The first group is UNDECIDED — no option carries `checked` — and the decorative check layer is pointer-inert, so an ordinary click on the label activates the native input (audit F-009).',
    render: () => (
      <div className="grid gap-3">
        <ChoiceGroup
          legend="Entscheidung KG 200 Vorbereitende Maßnahmen"
          value={null}
          onChange={() => {}}
          density="compact"
          options={[
            { value: 'included', label: 'enthalten', consequence: `+ 180.000 € Mehrpreis` },
            { value: 'excluded', label: 'nicht enthalten', consequence: 'ohne Preiswirkung' },
          ]}
        />
        <ChoiceGroup
          legend="Entscheidung Wärmekonzept"
          value="central"
          onChange={() => {}}
          options={[
            { value: 'central', label: 'Zentraler Ambient-Loop' },
            { value: 'perBuilding', label: 'Gebäudeweise Anlagen' },
          ]}
        />
        {/* VR3-TGA-UX-00 · the CARD layout for engineering alternatives: one
            column (`stack`) for five or more or long names, a two-column grid
            (`grid`) for two to four short ones. Each card has fixed slots —
            name, one differentiator, a neutral badge, the consequence. */}
        <ChoiceGroup
          legend="Entscheidung Wärmeerzeuger"
          value="WE_LW_WP"
          layout="stack"
          onChange={() => {}}
          options={[
            {
              value: 'WE_LW_WP', label: 'Luft/Wasser-Wärmepumpe',
              description: 'Außenluft als Wärmequelle · elektrisch',
              badge: 'All3-Standard', consequence: 'im Ansatz',
            },
            {
              value: 'WE_FW', label: 'Fernwärme-Übergabestation',
              description: 'Anschluss an das Fernwärmenetz', consequence: `− 64.000 €`,
            },
            {
              value: 'WE_SW_WP', label: 'Sole/Wasser-Wärmepumpe (Erdsonde)',
              description: 'Erdwärme über Sonden', consequence: 'keine Preiswirkung',
            },
          ]}
        />
      </div>
    ),
  },
  {
    id: 'vr3-scope-decision-ledger', groupId: 'domain', title: 'ScopeDecisionLedger',
    contractId: 'VR3 · ScopeDecisionLedger', requirements: ['SCOPE-001', 'R-18'],
    composedContracts: ['VR3 · ChoiceGroup', 'VR3 · SemanticStatus'],
    interactionStates: ['undecided', 'partial', 'complete'],
    dataStates: STATIC_LAYOUT_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'Six binary decisions in six compact rows — the replaced surface spent a full-width option card on each of them, and had already answered three.',
    evidence: 'Each row names the cost group, its concise boundary, both explicit choices, what the decision means for the scope and what it means downstream; UNDECIDED is a state, not a missing value.',
    render: () => (
      <ScopeDecisionLedger
        caption="Leistungsabgrenzung: sechs Kostengruppen, je eine ausdrückliche Entscheidung."
        columns={{
          group: 'Kostengruppe', decision: 'Entscheidung',
          summary: 'Bedeutung für den Umfang', downstream: 'Folge',
        }}
        decisionLegend={(row: ScopeLedgerRow) => `Entscheidung ${row.identity} ${row.meaning}`}
        onDecide={() => {}}
        rows={[
          {
            id: 'KG_200', identity: `KG${NNBSP}200`, meaning: 'Vorbereitende Maßnahmen',
            boundary: 'Baustelle, Rückbau, Erschließung', decision: 'undecided',
            summary: 'Noch offen',
            downstream: { tone: 'attention', label: 'Entscheidung erforderlich' },
            includeLabel: 'enthalten', excludeLabel: 'nicht enthalten',
            includeConsequence: `+ 1.120.000 € Mehrpreis`,
            excludeConsequence: 'ohne Preiswirkung',
          },
          {
            id: 'KG_300', identity: `KG${NNBSP}300`, meaning: 'Baukonstruktion',
            boundary: 'Gründung, Untergeschosse, Tragwerk, Fassaden',
            decision: 'included', summary: 'Im Angebotsumfang',
            downstream: { tone: 'neutral', label: 'Konfiguration erforderlich' },
            includeLabel: 'enthalten', excludeLabel: 'nicht enthalten',
            includeConsequence: 'aktuelle Auswahl',
            excludeConsequence: `− 23.980.000 € Minderpreis`,
          },
          {
            id: 'KG_400', identity: `KG${NNBSP}400`, meaning: 'Technische Anlagen',
            boundary: 'Wärme, Lüftung, Sanitär, Elektro',
            decision: 'excluded', summary: 'Bewusst ausgeschlossen',
            downstream: { tone: 'neutral', label: 'Nicht im Umfang · übersprungen' },
            includeLabel: 'enthalten', excludeLabel: 'nicht enthalten',
            includeConsequence: `+ 8.420.000 € Mehrpreis`,
            excludeConsequence: 'aktuelle Auswahl',
          },
        ]}
      />
    ),
  },
  {
    id: 'vr3-kg-configuration-page', groupId: 'domain', title: 'KGConfigurationPage',
    contractId: 'VR3 · KGConfigurationPage', requirements: ['R-05', 'STATE-003'],
    composedContracts: ['VR3 · ChoiceGroup', 'VR3 · SemanticStatus', 'VR3 · CommercialNumber'],
    interactionStates: ['current', 'incomplete', 'complete', 'invalid'],
    dataStates: STATIC_LAYOUT_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'ONE page anatomy, instantiated by KG 200 through KG 700. Only the domain content and the allowed variants differ; the shell, the row contract and the navigation do not.',
    evidence: 'Identity and scope, progress and validation, group index, service rows with progressive detail, the building-context panel and previous/next — the same six parts in every cost group.',
    render: () => (
      <KGConfigurationPage
        identity={`Konfigurator · KG${NNBSP}400`}
        title={`KG${NNBSP}400 · Technische Anlagen`}
        lead="Wärme, Lüftung, Sanitär und Elektro für drei Baukörper mit unterschiedlicher Nutzung."
        progress={{ tone: 'attention', label: '2 von 3 Entscheidungen getroffen' }}
        context={<p className="a3-cap">Option mit 3 Gebäuden · Grundlage bestätigt</p>}
        nextAction={<Button variant="primary">{`Weiter zu KG${NNBSP}500`}</Button>}
      >
        <ServiceGroup
          id="specimen-heat" label="Wärme & Lüftung" decisionCount={2}
          decisionsLabel="3 Positionen"
        >
          <ServiceDecisionRow
            name="Wärmeerzeugung zentral"
            summary="Gemeinsamer Ambient-Loop mit Wärmepumpen in der Energiezentrale."
            controlLegend="Entscheidung Wärmeerzeugung zentral"
            control={{
              kind: 'toggle', checked: true, label: 'im Angebot', onToggle: () => {},
            }}
            status={{ tone: 'ok', label: 'Enthalten' }}
            amount={<span className="a3-cnum a3-cnum-compact">{`+${NNBSP}1.240.000${NNBSP}€`}</span>}
          />
          <ServiceDecisionRow
            name="Photovoltaik Dachflächen"
            summary="Alle drei Dächer sind geeignet; das Energiekonzept fordert sie nicht."
            controlLegend="Entscheidung Photovoltaik Dachflächen"
            control={{
              kind: 'choice', value: null, includeLabel: 'aufnehmen',
              excludeLabel: 'nicht aufnehmen', onDecide: () => {},
            }}
            status={{ tone: 'attention', label: 'Entscheidung offen' }}
            amount={<span className="a3-cnum a3-cnum-compact">kein Betrag</span>}
          />
          <ServiceDecisionRow
            name="QNG-Siegel"
            summary="QNG-PLUS setzt den Energiestandard Effizienzhaus 40 NH voraus."
            controlLegend="Entscheidung QNG-Siegel"
            control={{
              kind: 'variant', value: 'plus', onDecide: () => {},
              options: [
                { value: 'none', label: 'kein QNG' },
                { value: 'plus', label: 'QNG-PLUS' },
              ],
            }}
            status={{ tone: 'attention', label: 'Voraussetzung fehlt' }}
            invalid
            warning="Diese Position setzt Energiestandard voraus."
            amount={<span className="a3-cnum a3-cnum-compact">kein Betrag</span>}
            detailToggle={{ label: 'Details öffnen', open: true, onToggle: () => {} }}
            detail={(
              <ServiceDetailPanel
                fields={[{ label: 'Herkunft', value: 'Annahme — noch nicht bestätigt' }]}
                dependency={{
                  message: 'Solange Energiestandard nicht entsprechend entschieden ist, trägt diese Position nichts zum Angebot bei.',
                  action: { label: 'Voraussetzung öffnen', onSelect: () => {} },
                }}
              />
            )}
          />
        </ServiceGroup>
      </KGConfigurationPage>
    ),
  },
  {
    id: 'vr3-commercial-rail', groupId: 'domain', title: 'CommercialRail',
    contractId: 'VR3 · CommercialRail', requirements: ['CALC-014', 'R-18'],
    composedContracts: ['VR3 · SemanticStatus', 'VR3 · CommercialNumber'],
    interactionStates: ['updated', 'subtotal', 'error'],
    dataStates: declareDataStates(
      ['ready', 'partial', 'error', 'stale'],
      'die kommerzielle Wirkung wird synchron mit dem Journalereignis neu berechnet; ein Ladezustand existiert nicht, und ein leerer Umfang ist eine Aussage, kein leerer Zustand',
    ),
    blockedVariants: [], maturity: 'alpha',
    note: 'The causal half of the rail: what moved the number, what the number contains, and whether it can be trusted right now.',
    evidence: 'The change block states the decision by name with its signed amount and stays after the delta chip has gone; a subtotal says so; a failed reconciliation is reported rather than asserted away in a caption.',
    render: () => (
      <div className="grid gap-3">
        <CommercialRailScope
          heading="Enthaltener Umfang"
          rows={[
            { label: 'Kostengruppen enthalten', value: '6 von 6' },
            { label: 'aufgenommene Positionen', value: '50' },
            { label: 'offene Entscheidungen', value: '11' },
          ]}
        />
        <CommercialRailChange
          heading="Zuletzt geändert"
          label="Wärmeerzeugung zentral · aufgenommen"
          direction="increase"
          amount={<span className="a3-cnum a3-cnum-default">{`+${NNBSP}1.240.000${NNBSP}€`}</span>}
          meta={`KG${NNBSP}400`}
        />
        <CommercialRailStatus
          tone="attention"
          label="Zwischensumme"
          reason="Noch 11 offene Entscheidungen — die Summe nennt nur die kalkulierten Positionen."
        />
      </div>
    ),
  },
  {
    id: 'vr3-commercial-number', groupId: 'domain', title: 'CommercialNumber',
    contractId: 'VR3 · CommercialNumber', requirements: ['R-16', 'NBSP'],
    composedContracts: [], interactionStates: ['default'],
    dataStates: STATIC_LAYOUT_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'The single formatted output of the canonical commercial result: one rounding rule, one narrow no-break space, one locale bridge.',
    evidence: 'A null amount is rendered as the absence it is and never as 0 (rule 16); a signed value prints U+2212 MINUS, because at these sizes a hyphen reads as a dash and the sign is the message.',
    render: () => (
      <div className="grid gap-2">
        <CommercialNumber exact={new Decimal('38740000')} language="de" emphasis="hero" />
        <CommercialNumber exact={new Decimal('1240000')} language="de" signed />
        <CommercialNumber exact={new Decimal('-310000')} language="de" signed />
        <CommercialNumber exact={null} language="de" absentLabel="kein Betrag" emphasis="compact" />
      </div>
    ),
  },

  /* ───────────────────── VR3-04 (backlog b50baba6) ────────────────────── */
  {
    id: 'vr3-schedule-editor', groupId: 'domain', title: 'ScheduleEditor',
    contractId: 'VR3 · ScheduleEditor', requirements: ['GANTT-003', 'SCHED-D17', 'R-04'],
    composedContracts: ['SemanticStatus', 'DateField'],
    interactionStates: ['default', 'editing', 'invalid', 'confirmed'],
    dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'The schedule as a working stage: key dates beside phase rows, each row carrying its own duration field, its bar and its place in the accessible table.',
    evidence: 'The bar is aria-hidden decoration of a number the row already states; the table alternative is the equal representation, never a footnote (GANTT-003). The two key DATES are the canonical DateField — this capability owns only the half-month duration field, which no existing control can render in German decimals.',
    render: () => (
      <ScheduleEditor
        keyDatesTitle="Schlüsseltermine"
        phasesTitle="Projektphasen"
        keyDates={(
          <div className="a3-sched-field">
            <p className="a3-sched-field-label" id="specimen-schedule-total">Gesamtdauer</p>
            <p className="a3-sched-field-readout numeric" aria-labelledby="specimen-schedule-total">
              {`18,5${NNBSP}Monate`}
            </p>
            <p className="a3-sched-field-hint">Abgeleitet aus den Phasen · Ende 30.09.2028</p>
          </div>
        )}
        phases={[
          {
            id: 'planning', label: 'Planung', unit: 'Gesamtprojekt',
            dependency: 'Baubeginn', startLabel: '15.03.2027', endLabel: '15.08.2027',
            durationLabel: `5${NNBSP}Monate`, offsetPercent: 0, widthPercent: 27,
          },
          {
            id: 'execution', label: 'Ausführung Stadthaus', unit: 'Stadthaus',
            dependency: 'nach Vergabe und Baustelleneinrichtung',
            startLabel: '15.06.2027', endLabel: '31.08.2028',
            durationLabel: `14${NNBSP}Monate`, offsetPercent: 16, widthPercent: 76,
            critical: true,
            durationField: {
              id: 'specimen-duration', label: 'Dauer Ausführung Stadthaus',
              value: '14', unit: 'Monate', kind: 'duration', onCommit: () => {},
            },
          },
        ]}
        notices={[{
          id: 'dependency', tone: 'attention', label: 'Bestätigung offen',
          reason: 'Die dokumentierte offene Frage B-Q-08 zu dieser Abhängigkeit ist noch nicht beantwortet.',
        }]}
        tableCaption="Terminplan nach Phasen mit Einheit, Beginn, Ende, Dauer und Abhängigkeit"
        tableView="Tabellarische Terminansicht"
        columns={{
          phase: 'Phase', unit: 'Einheit', start: 'Beginn', end: 'Ende',
          duration: 'Dauer', dependency: 'Abhängigkeit',
        }}
      />
    ),
  },
  {
    id: 'vr3-validation-review', groupId: 'domain', title: 'ValidationReview',
    contractId: 'VR3 · ValidationReview', requirements: ['R-12', 'STATE-003'],
    composedContracts: ['ReviewIndex', 'ReviewSection', 'SemanticStatus'],
    interactionStates: ['default', 'reviewed', 'stale', 'issue'],
    dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'A long professional review, kept long: a sticky index with a status per entry, a status per section, and an exact return-to-edit route on every finding.',
    evidence: 'The index is a nav of in-document links, not a tablist: a tablist would unmount every section but one, and "the reviewer read all twelve" would then be a claim about a document that was never on screen. Section headings are focusable so a jump is announced rather than silently scrolled.',
    render: () => (
      <ValidationReview
        sectionsLabel="Prüfinhalt"
        index={(
          <ReviewIndex
            label="Prüfabschnitte"
            progressLabel="9 von 12 geprüft"
            entries={[
              { id: 'baseline', label: 'Projektgrundlage', state: 'REVIEWED', stateLabel: 'geprüft', onSelect: () => {} },
              { id: 'kg', label: 'KG 200 – 700', state: 'REVIEWED', stateLabel: 'geprüft', count: { reviewed: 6, total: 6 }, onSelect: () => {} },
              { id: 'schedule', label: 'Terminplan', state: 'ISSUE', stateLabel: 'Befund offen', current: true, onSelect: () => {} },
              { id: 'result', label: 'Kommerzielles Ergebnis', state: 'PENDING', stateLabel: 'noch zu prüfen', onSelect: () => {} },
            ]}
          />
        )}
        sections={(
          <>
            <ReviewSection
              id="specimen-review-baseline" title="Projektgrundlage"
              state="REVIEWED" stateLabel="geprüft"
              rows={[
                { id: 'project', label: 'Projekt', value: 'Quartier Am Güterbogen · Leipzig' },
                { id: 'buildings', label: 'Grundlage', value: `3 Gebäude · 19.470${NNBSP}m² BGF R+S` },
              ]}
            />
            <ReviewSection
              id="specimen-review-schedule" title="Terminplan"
              state="ISSUE" stateLabel="Befund offen"
              rows={[{ id: 'window', label: 'Zeitraum', value: `15.03.2027${NNBSP}→${NNBSP}30.09.2028` }]}
              issues={[{
                id: 'dependency', tone: 'error', label: 'Befund blockiert das Speichern',
                reason: 'Die dokumentierte offene Frage B-Q-08 zu dieser Abhängigkeit ist noch nicht beantwortet.',
                route: { label: 'In Terminplan beheben', onSelect: () => {} },
              }]}
            />
          </>
        )}
      />
    ),
  },
  {
    id: 'vr3-save-receipt', groupId: 'domain', title: 'SaveReceipt',
    contractId: 'VR3 · SaveReceipt', requirements: ['R-12', 'MOTION-M08'],
    composedContracts: ['SemanticStatus'],
    interactionStates: ['default', 'failed'],
    dataStates: ACTION_STATES,
    blockedVariants: [], maturity: 'alpha',
    note: 'The outcome of an explicit commitment: which Option, which version, when — and the one thing the save unlocked, emphasised exactly once (M-08).',
    evidence: 'role="status" announces the receipt politely and a failure is role="alert"; the unlock emphasis is a single non-looping CSS animation the reduced-motion preference removes, and the focus move plus the announcement carry the meaning without it.',
    render: () => (
      <div className="grid gap-5">
        <SaveReceipt
          eyebrow="Option gespeichert · Version 1"
          heading="Option Basis ist kundenbereit."
          explanation="Die gespeicherte interne Option ist ab jetzt die unveränderliche Präsentationsgrundlage."
          rows={[
            { id: 'validation', label: 'Finale Prüfung', value: 'bestätigt' },
            { id: 'savedAt', label: 'Gespeichert am', value: `02.09.2026${NNBSP}·${NNBSP}16:42` },
          ]}
          unlock={{ tone: 'ok', label: 'Kundenmodus freigeschaltet' }}
        />
        <SaveFailureNotice
          label="Speichern fehlgeschlagen"
          reason="Während des Speichervorgangs hat sich die Option geändert — die Prüfung ist erneut zu bestätigen."
          preserved="Die bestätigte Prüfung bleibt bestätigt; kein Arbeitsstand ist verloren."
        />
      </div>
    ),
  },
]

const GROUP_META: Array<Omit<SpecimenGroup, 'specimens'>> = [
  {
    id: 'r1', title: 'REDESIGN R1 · Visual language, expression & motion foundations',
    intro: 'Neue kanonische Fähigkeiten (efcbdaf3): Surface-Modell, Media, Metrik-Hierarchie, Composition-Grafik, WorkflowStepper, DateField/Stepper — plus zusammengesetzte Referenzspezimen, die die Sprache als System zeigen, keine Produktmigration.',
  },
  {
    id: 'states', title: 'Zustände der Datenkomponenten (Regel 30)',
    intro: 'Fünf Datenzustände plus stale und permission. Ready ist echter Owner-Inhalt, kein grüner Statusblock.',
  },
  { id: 'foundations', title: 'Fundament · Aktionen, Form, Layout und Datenanzeige' },
  { id: 'selections', title: 'Auswahlkontrollen' },
  { id: 'feedback', title: 'Feedback, Dialog und nächste Schritte' },
  { id: 'domain', title: 'Domänenkompositionen' },
]

const R1_LEAD_ORDER = [
  'r1-surface-foundations',
  'r1-composed-project-identity',
  'r1-composed-option',
  'r1-composed-workflow',
  'r1-composed-stage',
  'r1-workflowstepper',
  'r1-datefield',
  'r1-stepper',
  'r1-compositionbar',
  'r1-mediaframe',
] as const

export const SPECIMEN_GROUPS: SpecimenGroup[] = GROUP_META.map((group) => ({
  ...group,
  specimens: COMPONENT_REGISTRY
    .filter((specimen) => specimen.groupId === group.id)
    .sort((left, right) => group.id === 'r1'
      ? R1_LEAD_ORDER.indexOf(left.id as typeof R1_LEAD_ORDER[number])
        - R1_LEAD_ORDER.indexOf(right.id as typeof R1_LEAD_ORDER[number])
      : 0),
}))
