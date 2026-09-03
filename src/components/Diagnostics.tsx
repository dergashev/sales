import { useMemo } from 'react'
import { useT } from '../i18n'
import type { FontCheck } from '../lib/font-check'
import catalog from '../fixtures/catalog.json'
import demo from '../fixtures/demo-0001.json'
import { commercialReconciliation, useStore } from '../state/store'

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

type T = ReturnType<typeof useT>

/**
 * Localise a raw fixture enum value (e.g. "inactive", "open", "material")
 * through the i18n dictionary so the visible diagnostics carry no raw,
 * mixed-language token. Falls back to the raw value for an unexpected enum
 * rather than showing a bare message key. The fixture data itself is never
 * mutated — this only affects the display label.
 */
function localizedValue(t: T, prefix: string, value: string): string {
  const key = `${prefix}.${value}`
  const label = t(key)
  return label === key ? value : label
}

function useChecks(fonts: FontCheck | null, cascade: string[] | null): Row[] {
  const t = useT()
  // The LIVE commercial result, not an archived fixture run: the whole point
  // of the reconciliation check is that it describes what the product is
  // currently showing (VR3-03, F-001).
  const s = useStore()
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

    /**
     * VR3-03 (audit F-001, P0): this check used to read the ARCHIVED fixture
     * run `DEMO-RUN-0007` and compare its `drivers` array against that run's
     * total. That array is a documented two-entry EXCERPT, not the run's
     * full contribution set — so the check could only ever fail, and it did,
     * on a surface a user can reach: "2 Treiber ergeben 3244500.00,
     * Ergebnis 3817835.00", printed next to a number the product asks people
     * to trust. It was never a defect in the arithmetic; it was a diagnostic
     * comparing two things that were never meant to be equal.
     *
     * It now reconciles the LIVE canonical commercial result — the
     * contributions the rail is actually showing, the DIN 276 composition
     * they are grouped into, and the total printed above both
     * (`commercialReconciliation`). That is the relation the ticket requires
     * to pass, and the one whose failure would mean something.
     */
    const reconciliation = commercialReconciliation(s)
    rows.push({
      key: 'drivers',
      name: t('diagnostics.check.drivers'),
      ok: reconciliation.reconciles,
      detail: reconciliation.contributionCount > 0
        ? t('diagnostics.detail.drivers.ok', {
            count: reconciliation.contributionCount,
            sum: reconciliation.contributionsExact.toFixed(2),
            total: reconciliation.totalExact.toFixed(2),
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
            state: localizedValue(t, 'diagnostics.value.issueState', issue.state),
            materiality: localizedValue(t, 'diagnostics.value.materiality', issue.materiality),
            count: issue.blockedOutputProfiles.length,
          })
        : t('diagnostics.detail.blocker.fail'),
    })

    return rows
  }, [fonts, cascade, t, s])
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
          factor: localizedValue(t, 'diagnostics.value.regionalFactor', demo.scenario.regionalFactor),
        })}
      </p>
    </section>
  )
}
