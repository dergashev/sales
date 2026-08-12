import { useId, useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import { NNBSP } from '../engine/money'
import demo from '../fixtures/demo-0001.json'
import {
  Button,
  NumericField,
  ProvenanceChip,
  Skeleton,
  UncertaintyBadge,
} from '../components/primitives'
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

export type ContractStateDeclaration = Readonly<Record<DataStateKind, string>>

export type Specimen = {
  id: string
  groupId: 'states' | 'foundations' | 'selections' | 'feedback' | 'domain'
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
    id: 'uncertainty', groupId: 'domain', title: 'UncertaintyBadge (DC-3)', contractId: 'DC-3',
    requirements: ['R-08'], composedContracts: ['Badge'], interactionStates: ['default'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Explicit ± interval in text.', render: () => <UncertaintyBadge pp={22} />,
  },
  {
    id: 'docanalysis', groupId: 'domain', title: 'DocumentAnalysis (DC-10)', contractId: 'DC-10',
    requirements: ['STATE-005', 'SKELETON-001'], composedContracts: ['Button', 'DataStateBlock'],
    interactionStates: ['idle', 'loading', 'cancelled', 'ready'], dataStates: ALL_DATA_STATES,
    blockedVariants: [], maturity: 'alpha', evidence: 'Live fixture simulation with phase protocol and no invented percentage.',
    render: () => <DocumentAnalysis docs={demo.documents.map((document) => ({ file: document.file, pages: typeof document.pages === 'number' ? document.pages : null, parseStatus: document.parseStatus }))} onManualCapture={() => {}} />,
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
]

export const SPECIMEN_GROUPS: SpecimenGroup[] = GROUP_META.map((group) => ({
  ...group,
  specimens: COMPONENT_REGISTRY.filter((specimen) => specimen.groupId === group.id),
}))

export const ALL_SPECIMENS = COMPONENT_REGISTRY
