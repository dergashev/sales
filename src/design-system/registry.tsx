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
import { RadioCardGroup, SegmentedControl, Switch } from '../components/controls'
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
import { CompositionBar, type CompositionSegment } from './CompositionBar'
import { WorkflowStepper, type WorkflowStep } from './WorkflowStepper'
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

  const go = (delta: 1 | -1) => {
    const next = Math.min(lastIndex, Math.max(0, index + delta))
    if (next === index) return
    setDir(delta > 0 ? 'forward' : 'backward')
    setIndex(next)
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
    blockedVariants: [], maturity: 'alpha', evidence: 'Explicit ± interval in text.', render: () => <EstimateUncertaintyBadge presentation="compact" pp={22} />,
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
]

const GROUP_META: Array<Omit<SpecimenGroup, 'specimens'>> = [
  {
    id: 'states', title: 'Zustände der Datenkomponenten (Regel 30)',
    intro: 'Fünf Datenzustände plus stale und permission. Ready ist echter Owner-Inhalt, kein grüner Statusblock.',
  },
  { id: 'foundations', title: 'Fundament · Aktionen, Form, Layout und Datenanzeige' },
  { id: 'selections', title: 'Auswahlkontrollen' },
  { id: 'feedback', title: 'Feedback, Dialog und nächste Schritte' },
  { id: 'domain', title: 'Domänenkompositionen' },
  {
    id: 'r1', title: 'REDESIGN R1 · Visual language, expression & motion foundations',
    intro: 'Neue kanonische Fähigkeiten (efcbdaf3): Surface-Modell, Media, Metrik-Hierarchie, Composition-Grafik, WorkflowStepper, DateField/Stepper — plus zusammengesetzte Referenzspezimen, die die Sprache als System zeigen, keine Produktmigration.',
  },
]

export const SPECIMEN_GROUPS: SpecimenGroup[] = GROUP_META.map((group) => ({
  ...group,
  specimens: COMPONENT_REGISTRY.filter((specimen) => specimen.groupId === group.id),
}))
