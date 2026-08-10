import { useState } from 'react'
import { useTx } from '../i18n'
import { Decimal } from 'decimal.js'
import { Diagnostics } from '../components/Diagnostics'
import type { FontCheck } from '../lib/font-check'
import { Button, NumericField, ProvenanceChip, Skeleton, UncertaintyBadge } from '../components/primitives'
import { RadioCardGroup, SegmentedControl, Switch } from '../components/controls'
import { DocumentAnalysis } from '../components/DocumentAnalysis'
import { OriginPopover } from '../components/OriginPopover'
import { NNBSP } from '../engine/money'
import demo from '../fixtures/demo-0001.json'

/**
 * Grundlagen — внутренняя QA-витрина (в навигации помечена QA).
 *
 * Две задачи:
 * 1. Диагностика шрифта и каскада (правило 3 требует рантайм-проверку).
 * 2. Витрина примитивов и их состояний: правило 30 требует от каждого
 *    data-компонента пять состояний данных плюс оси stale/permission —
 *    здесь они показаны ГЛАЗАМИ, а не только объявлены в контракте.
 *
 * Все значения — фикстурные или контрактные образцы; собственных чисел
 * у витрины нет.
 */

function Specimen({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="a3-sheet">
      <h3 className="text-heading-3 font-bold text-text-primary">{title}</h3>
      {note && <p className="a3-cap a3-lede mt-1">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Grundlagen({ fonts, cascade }: {
  fonts: FontCheck | null
  cascade: string[] | null
}) {
  const tx = useTx()
  const [segDemo, setSegDemo] = useState<'a' | 'b'>('a')
  const [switchDemo, setSwitchDemo] = useState(false)
  const [radioDemo, setRadioDemo] = useState<'x' | 'y' | 'z'>('x')

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <p className="a3-cap">{tx('QA · intern')}</p>
        <h1 className="mt-1 text-heading-2 font-bold text-text-primary">{tx('Grundlagen')}</h1>
      </header>

      <Diagnostics fonts={fonts} cascade={cascade} />

      <h2 className="mt-7 text-heading-3 font-bold text-text-primary">{tx('Zustände der Datenkomponenten (Regel 30)')}</h2>
      <p className="mt-1 max-w-content text-small text-text-secondary">{tx('Fünf Datenzustände plus die Achsen stale und permission — hier sichtbar, nicht nur im Vertrag deklariert. Werte sind Fixture- oder Vertragsmuster.')}</p>

      <div className="mt-4 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(38ch, 1fr))' }}>
        <Specimen title="loading" note="Skeleton: flache Blöcke ohne Shimmer (Regel 4/30).">
          <Skeleton lines={3} />
        </Specimen>

        <Specimen title="empty" note="Leere ist benannt und erklärt, nie stumm.">
          <p className="border border-border-default p-3 text-body text-text-secondary">
            <span aria-hidden="true">○ </span>{tx('Keine Optionen verfügbar — die Fixture DEMO-0001 definiert für dieses Kapitel keine Auswahl.')}</p>
        </Specimen>

        <Specimen title="partial" note={`Preis ohne Rechenbasis: nie 0 € (Regel 16, SCOPE-001).`}>
          <p className="numeric border border-border-default p-3 text-body text-text-primary">{tx('Preis nicht ermittelt')}<span className="mt-1 block text-small text-text-secondary">{tx('Zwischensumme der kalkulierten Positionen statt Gesamt')}</span>
          </p>
        </Specimen>

        <Specimen title="error" note="Ursache · Folge · Mittel — immer zu dritt.">
          <div className="border-contrast border-border-error p-3">
            <p className="text-body text-text-primary">
              <span aria-hidden="true">✗ </span>{tx('Statik_Auszug_Muster.jpg nicht lesbar: Auflösung zu gering')}</p>
            <p className="a3-cap mt-1">{tx('Werte aus dieser Datei fehlen · Mittel: Manuell erfassen')}</p>
          </div>
        </Specimen>

        <Specimen title="stale" note="Veraltetes trägt seinen Stand, statt aktuell auszusehen.">
          <p className="border border-border-warning p-3 text-body text-text-primary">
            <span aria-hidden="true">▲ </span>{tx('Veraltet · Stand 04.08.2026 — Kalkulation erneut ausführen')}</p>
        </Specimen>

        <Specimen title="permission" note="Nicht Berechtigtes fehlt im Baum, statt versteckt zu sein (R-17).">
          <p className="border border-border-default p-3 text-body text-text-secondary">
            <span aria-hidden="true">○ </span>{tx('Interne Kalibrierung ist in dieser Rolle nicht verfügbar.')}</p>
        </Specimen>
      </div>

      <h2 className="mt-7 text-heading-3 font-bold text-text-primary">{tx('Primitive nach components-core')}</h2>

      <div className="mt-4 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(38ch, 1fr))' }}>
        <Specimen title="Button" note="aria-disabled statt disabled: Grund bleibt fokussierbar (Regel 12).">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">{tx('Primär')}</Button>
            <Button>{tx('Sekundär')}</Button>
            <Button variant="ghost">{tx('Ghost')}</Button>
            <Button disabled disabledReason="Demonstration der benannten Sperre">{tx('Gesperrt')}</Button>
          </div>
        </Specimen>

        <Specimen title="SegmentedControl" note="Native Radios: Pfeile bewegen und wählen; Zustand, nicht Aktion (LAYOUT-008).">
          <SegmentedControl
            legend="Demo-Einstellung"
            value={segDemo}
            onChange={setSegDemo}
            options={[
              { value: 'a', label: 'Zustand A' },
              { value: 'b', label: 'Zustand B' },
            ]}
          />
        </Specimen>

        <Specimen title="Switch" note="Nur für Berechnungs-/UI-Einstellungen, nie für Angebotsoptionen (OPTION-008).">
          <Switch label="Demo-Einstellung" checked={switchDemo} onChange={setSwitchDemo} />
        </Specimen>

        <Specimen title="RadioCardGroup" note="Folge sichtbar ohne Hover (R-05); Empfohlen ≠ Ausgewählt (RADIO-002).">
          <RadioCardGroup
            legend="Demo-Optionen"
            legendHidden
            value={radioDemo}
            onChange={setRadioDemo}
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
        </Specimen>

        <Specimen title="ProvenanceChip (DC-1)" note="Zeichen + Text, nie nur Farbe (Regel 8).">
          <div className="flex flex-wrap gap-4">
            <ProvenanceChip provenance="aus Dokument" />
            <ProvenanceChip provenance="vom Kunden bestätigt" />
            <ProvenanceChip provenance="abgeleitet" />
            <ProvenanceChip provenance="manuell erfasst" />
          </div>
        </Specimen>

        <Specimen title="OriginPopover (DC-21)" note="Erklärt nur; Esc schließt und gibt den Fokus zurück (KEY-002).">
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
        </Specimen>

        <Specimen title="NumericField (DC-4)" note="Enter — bestätigt, Tab — manuell, Esc — verwerfen.">
          <NumericField
            label="Demo-Fläche"
            value={new Decimal('1500')}
            unit="m²"
            provenance="aus Dokument"
            onCommit={() => {}}
          />
        </Specimen>

        <Specimen title="UncertaintyBadge (DC-3)">
          <UncertaintyBadge pp={22} />
        </Specimen>
      </div>

      <h2 className="mt-7 text-heading-3 font-bold text-text-primary">{tx('DC-10 · Dokumentanalyse (Simulation live abspielbar)')}</h2>
      <div className="mt-4">
        <DocumentAnalysis
          docs={demo.documents.map((d) => ({
            file: d.file,
            pages: typeof d.pages === 'number' ? d.pages : null,
            parseStatus: d.parseStatus,
          }))}
          onManualCapture={() => {}}
        />
      </div>

      <p className="mt-7 border-t border-border-subtle pt-3 text-small text-text-muted">{tx('Nicht gebaute Contract-Primitive (Tooltip, Dialog, Link, Slider, SaveStatus, KeyboardShortcuts) warten auf offene ADR-Token (docs/audit/adr-blocking.md §6a) — Werte zu erfinden ist untersagt (R-25).')}</p>
    </div>
  )
}
