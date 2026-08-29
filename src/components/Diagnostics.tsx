import { useMemo } from 'react'
import { useT } from '../i18n'
import type { FontCheck } from '../lib/font-check'
import catalog from '../fixtures/catalog.json'
import demo from '../fixtures/demo-0001.json'
import { Decimal } from 'decimal.js'

/**
 * Diagnostik der Grundlagen. Fünf Prüfungen, jede ein Defekt, der schon
 * einmal passiert ist und einen Audit-Zyklus gekostet hat. Sichtbar
 * angezeigt: ein stiller Fehlschlag würde den ursprünglichen Fehler
 * wiederholen, bei dem der Font stumm nicht geladen wurde und es erst auf
 * den Layouts auffiel.
 *
 * Status wird nie allein über Farbe transportiert — daneben steht immer ein
 * Zeichen und eine Beschriftung (Projektregel 8).
 *
 * VR2-00: Diese interne QA-Diagnose steht in den Produktsprachen
 * (de Quelle, en Übersetzung) über den i18n-Wörterbuchschlüsseln (Regel 36)
 * statt in interner Entwicklersprache — die Grundlagen-Oberfläche darf keine
 * untranslatierte, sprachgemischte Diagnose zeigen.
 */

type Row = { key: string; name: string; ok: boolean | null; detail: string }

function useChecks(fonts: FontCheck | null, cascade: string[] | null): Row[] {
  const t = useT()
  return useMemo(() => {
    const rows: Row[] = []

    rows.push({
      key: 'fonts',
      name: t('diagnostics.check.fonts'),
      ok: fonts ? fonts.ok : null,
      detail: fonts
        ? fonts.ok
          ? t('diagnostics.detail.fonts.ok')
          : t('diagnostics.detail.fonts.missing', { missing: fonts.missing.join('; ') })
        : t('diagnostics.detail.fonts.waiting'),
    })

    rows.push({
      key: 'cascade',
      name: t('diagnostics.check.cascade'),
      ok: cascade ? cascade.length === 0 : null,
      detail: cascade
        ? cascade.length === 0
          ? t('diagnostics.detail.cascade.ok')
          : cascade.join(' · ')
        : t('diagnostics.detail.cascade.waiting'),
    })

    // Tokens: löst die Variable nicht auf, kommt ein leerer String zurück.
    const probe = getComputedStyle(document.documentElement)
    const accent = probe.getPropertyValue('--color-text-display-accent').trim()
    const space4 = probe.getPropertyValue('--space-4').trim()
    rows.push({
      key: 'tokens',
      name: t('diagnostics.check.tokens'),
      ok: Boolean(accent && space4),
      detail: accent && space4
        ? t('diagnostics.detail.tokens.ok', { accent, space: space4 })
        : t('diagnostics.detail.tokens.fail'),
    })

    // Fixture: nicht «Datei vorhanden», sondern «Zahlen stimmen überein».
    const run = demo.runs.find((r) => r.calculationRunId === 'DEMO-RUN-0007')
    const drivers = run?.drivers ?? []
    const sum = drivers.reduce((acc, d) => acc.plus(new Decimal(d.exact)), new Decimal(0))
    const total = new Decimal(run?.total.exact ?? '0')
    rows.push({
      key: 'drivers',
      name: t('diagnostics.check.drivers'),
      ok: sum.equals(total) && drivers.length > 0,
      detail: drivers.length
        ? t('diagnostics.detail.drivers.ok', {
            count: drivers.length,
            sum: sum.toFixed(2),
            total: total.toFixed(2),
          })
        : t('diagnostics.detail.drivers.fail'),
    })

    // Ein offener Blocker muss alle fünf Kundenprofile schließen — die
    // Fixture reproduziert bewusst das blockierende Szenario, kein bequemes.
    const issue = demo.validationIssues[0]
    rows.push({
      key: 'blocker',
      name: t('diagnostics.check.blocker'),
      ok: issue?.state === 'open' && issue.blockedOutputProfiles.length === 5,
      detail: issue
        ? t('diagnostics.detail.blocker.ok', {
            id: issue.id,
            state: issue.state,
            materiality: issue.materiality,
            count: issue.blockedOutputProfiles.length,
          })
        : t('diagnostics.detail.blocker.fail'),
    })

    return rows
  }, [fonts, cascade, t])
}

export function Diagnostics({
  fonts,
  cascade,
}: {
  fonts: FontCheck | null
  cascade: string[] | null
}) {
  const t = useT()
  const rows = useChecks(fonts, cascade)
  const failed = rows.filter((r) => r.ok === false)

  return (
    <section className="mt-7">
      <h2 className="text-body font-bold text-text-primary">{t('diagnostics.title')}</h2>

      {failed.length > 0 && (
        <p className="mt-3 border-contrast border-border-error p-4 text-body font-medium text-text-primary">
          {t('diagnostics.failed', { failed: failed.length, total: rows.length })}
        </p>
      )}

      {/* Jede Tabelle in einem Container mit horizontalem Scroll: Font-Metriken
          werden nicht in Pixel gebacken (Regel 3a). */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th className="py-3 pr-5 font-medium">{t('diagnostics.col.check')}</th>
              <th className="py-3 pr-5 font-medium">{t('diagnostics.col.state')}</th>
              <th className="py-3 font-medium">{t('diagnostics.col.detail')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border-subtle align-top">
                <td className="py-3 pr-5 font-medium text-text-primary">{r.name}</td>
                <td className="py-3 pr-5 whitespace-nowrap">
                  {r.ok === null ? (
                    <span className="text-text-muted">{t('diagnostics.state.checking')}</span>
                  ) : r.ok ? (
                    <span className="text-text-primary">{t('diagnostics.state.ok')}</span>
                  ) : (
                    <span className="font-medium text-text-primary">{t('diagnostics.state.fail')}</span>
                  )}
                </td>
                <td className="py-3 text-text-secondary">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-small text-text-muted">
        {t('diagnostics.fixture', {
          scenario: demo.scenario.scenarioId,
          run: demo.scenario.calculationRunId,
          rules: catalog.rulesetVersion,
          factor: demo.scenario.regionalFactor,
        })}
      </p>
    </section>
  )
}
