import { useState } from 'react'
import { Decimal } from 'decimal.js'
import { NNBSP } from '../engine/money'
import demo from '../fixtures/demo-0001.json'
import {
  Button, NumericField, ProvenanceChip, Skeleton, UncertaintyBadge,
} from '../components/primitives'
import {
  EmptyState, ErrorState, PartialState, PermissionState, StaleState,
} from '../components/DataStates'
import { RadioCardGroup, SegmentedControl, Switch } from '../components/controls'
import { OriginPopover } from '../components/OriginPopover'
import { DocumentAnalysis } from '../components/DocumentAnalysis'

/**
 * Реестр специменов — **единственное место, где объявляется образец**
 * (решение D-28).
 *
 * До него образец существовал дважды: рукописной разметкой в витрине
 * `all3-design-system.html` и второй рукописной разметкой в галерее
 * QA{' '}Foundation. Компонент — это разметка, поведение и стиль; система
 * поставляла один стиль, а две трети писались заново каждым потребителем.
 * Расхождение при таком устройстве не нарушение дисциплины, а свойство
 * конструкции, и оно держалось из релиза в релиз именно поэтому.
 *
 * Здесь объявление одно. Галерея его показывает, витрина будет показывать
 * его же (задание № 30) — и никто из них не имеет собственной разметки
 * образца. Проверка `GALLERY-SINGLE-SOURCE` в `tools/verify.py` держит это
 * свойство: экран галереи не вправе рисовать специмены сам.
 *
 * `render` — функция, а не элемент: у части образцов есть собственное
 * состояние, и они обязаны быть живыми, а не снимками.
 */

export type Specimen = {
  /** Стабильный идентификатор образца — по нему сверяются контракты. */
  id: string
  /** Заголовок образца в галерее. */
  title: string
  /** Что образец доказывает. Не описание вида, а названное требование. */
  note?: string
  /** Контракт, которому образец принадлежит: `DC-…` либо имя примитива. */
  contract: string
  render: () => JSX.Element
}

export type SpecimenGroup = {
  id: string
  title: string
  intro?: string
  specimens: Specimen[]
}

function SegmentedDemo() {
  const [v, setV] = useState<'a' | 'b'>('a')
  return (
    <SegmentedControl
      legend="Demo-Einstellung"
      value={v}
      onChange={setV}
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
  const [v, setV] = useState<'x' | 'y' | 'z'>('x')
  return (
    <RadioCardGroup
      legend="Demo-Optionen"
      legendHidden
      value={v}
      onChange={setV}
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

export const SPECIMEN_GROUPS: SpecimenGroup[] = [
  {
    id: 'data-states',
    title: 'Zustände der Datenkomponenten (Regel 30)',
    intro: 'Fünf Datenzustände plus die Achsen stale und permission — hier '
      + 'sichtbar, nicht nur im Vertrag deklariert. Werte sind Fixture- oder '
      + 'Vertragsmuster.',
    specimens: [
      {
        id: 'state-loading', title: 'loading', contract: 'STATE-002',
        note: 'Skeleton: flache Blöcke ohne Shimmer (Regel 4/30).',
        render: () => <Skeleton lines={3} />,
      },
      {
        id: 'state-empty', title: 'empty', contract: 'DC-24',
        note: 'Leere ist benannt und erklärt, nie stumm.',
        render: () => (
          <EmptyState>
            Keine Optionen verfügbar — die Fixture DEMO-0001 definiert für dieses Kapitel keine Auswahl.
          </EmptyState>
        ),
      },
      {
        id: 'state-partial', title: 'partial', contract: 'SCOPE-001',
        note: 'Preis ohne Rechenbasis: nie 0 € (Regel 16, SCOPE-001).',
        render: () => (
          <PartialState
            label="Preis nicht ermittelt"
            consequence="Zwischensumme der kalkulierten Positionen statt Gesamt"
          />
        ),
      },
      {
        id: 'state-error', title: 'error', contract: 'STATE-005',
        note: 'Ursache · Folge · Mittel — immer zu dritt.',
        render: () => (
          <ErrorState
            cause="Statik_Auszug_Muster.jpg nicht lesbar: Auflösung zu gering"
            remedy="Werte aus dieser Datei fehlen · Mittel: Manuell erfassen"
          />
        ),
      },
      {
        id: 'state-stale', title: 'stale', contract: 'STATE-008',
        note: 'Veraltetes trägt seinen Stand, statt aktuell auszusehen.',
        render: () => (
          <StaleState>Veraltet · Stand 04.08.2026 — Kalkulation erneut ausführen</StaleState>
        ),
      },
      {
        id: 'state-permission', title: 'permission', contract: 'R-17',
        note: 'Nicht Berechtigtes fehlt im Baum, statt versteckt zu sein (R-17).',
        render: () => (
          <PermissionState>Interne Kalibrierung ist in dieser Rolle nicht verfügbar.</PermissionState>
        ),
      },
    ],
  },
  {
    id: 'primitives',
    title: 'Primitive nach components-core',
    specimens: [
      {
        id: 'button', title: 'Button', contract: 'components-core · Button',
        note: 'aria-disabled statt disabled: Grund bleibt fokussierbar (Regel 12).',
        render: () => (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primär</Button>
            <Button>Sekundär</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled disabledReason="Demonstration der benannten Sperre">
              Gesperrt
            </Button>
          </div>
        ),
      },
      {
        id: 'segmented', title: 'SegmentedControl',
        contract: 'components-core · SegmentedControl',
        note: 'Native Radios: Pfeile bewegen und wählen; Zustand, nicht Aktion (LAYOUT-008).',
        render: () => <SegmentedDemo />,
      },
      {
        id: 'switch', title: 'Switch', contract: 'components-core · Switch',
        note: 'Nur für Berechnungs-/UI-Einstellungen, nie für Angebotsoptionen (OPTION-008).',
        render: () => <SwitchDemo />,
      },
      {
        id: 'radiocards', title: 'RadioCardGroup',
        contract: 'components-core · RadioCardGroup',
        note: 'Folge sichtbar ohne Hover (R-05); Empfohlen ≠ Ausgewählt (RADIO-002).',
        render: () => <RadioCardDemo />,
      },
      {
        id: 'provenance', title: 'ProvenanceChip (DC-1)', contract: 'DC-1',
        note: 'Zeichen + Text, nie nur Farbe (Regel 8).',
        render: () => (
          <div className="flex flex-wrap gap-4">
            <ProvenanceChip provenance="aus Dokument" />
            <ProvenanceChip provenance="vom Kunden bestätigt" />
            <ProvenanceChip provenance="abgeleitet" />
            <ProvenanceChip provenance="manuell erfasst" />
          </div>
        ),
      },
      {
        id: 'origin', title: 'OriginPopover (DC-21)', contract: 'DC-21',
        note: 'Erklärt nur; Esc schließt und gibt den Fokus zurück (KEY-002).',
        render: () => (
          <p className="numeric text-body text-text-primary">
            ≈{NNBSP}3.818.000{NNBSP}€{' '}
            <OriginPopover
              rows={[
                { label: 'Grundleistung', value: `3.090.000${NNBSP}€` },
                { label: 'Exakter Rechenwert', value: `3.817.835,00${NNBSP}€`, strong: true },
              ]}
              rounding={`Gerundet auf 1.000${NNBSP}€; exakter Rechenwert 3.817.835,00${NNBSP}€`}
              runRef="Regelsatz RS-2026.2 · DEMO-SC-01 · DEMO-RUN-0007"
            />
          </p>
        ),
      },
      {
        id: 'numericfield', title: 'NumericField (DC-4)', contract: 'DC-4',
        note: 'Enter — bestätigt, Tab — manuell, Esc — verwerfen.',
        render: () => (
          <NumericField
            label="Demo-Fläche"
            value={new Decimal('1500')}
            unit="m²"
            provenance="aus Dokument"
            onCommit={() => {}}
          />
        ),
      },
      {
        id: 'uncertainty', title: 'UncertaintyBadge (DC-3)', contract: 'DC-3',
        render: () => <UncertaintyBadge pp={22} />,
      },
    ],
  },
  {
    id: 'document-analysis',
    title: 'DC-10 · Dokumentanalyse (Simulation live abspielbar)',
    specimens: [
      {
        id: 'docanalysis', title: 'DocumentAnalysis (DC-10)', contract: 'DC-10',
        render: () => (
          <DocumentAnalysis
            docs={demo.documents.map((d) => ({
              file: d.file,
              pages: typeof d.pages === 'number' ? d.pages : null,
              parseStatus: d.parseStatus,
            }))}
            onManualCapture={() => {}}
          />
        ),
      },
    ],
  },
]

/** Все образцы одним списком — для проверок покрытия. */
export const ALL_SPECIMENS: Specimen[] =
  SPECIMEN_GROUPS.flatMap((g) => g.specimens)
