import catalog from '../fixtures/catalog.json'
import { useTx } from '../i18n'
import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { SegmentedControl, Switch } from '../components/controls'

/**
 * S6 Einstellungen — скрыто от клиента.
 *
 * Ставки маржи и драйверы риска — провизорные (⚙) и показываются как данные
 * конфигурации, не редактируются в прототипе: их калибровка — протокол
 * ревизии, а не поле ввода. Живой здесь Regionalfaktor: его состояние входит
 * в снапшот оффера (D-15), и включение — событие журнала с дельтой.
 */
export function S6Einstellungen() {
  const tx = useTx()
  const s = useStore()
  // Числа не хардкодятся в экране: internalConfig извлечён построителем
  // из calculation-spec §1.1 — один источник, одно место правки.
  const cfg = catalog.internalConfig

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <h1 className="text-heading-2 font-bold text-text-primary">{tx('Einstellungen · intern')}</h1>
      </header>

      <section className="mt-5" aria-label="Regionalfaktor">
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Regionalfaktor')}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border border-border-default p-4">
          <div>
            <p className="text-body text-text-primary">
              Musterland · Faktor 1,08 ⚙ ·{' '}
              {s.regionalfaktorActive
                ? <><span aria-hidden="true">✓ </span>{tx('aktiviert')}</>
                : <>{tx('Standard: aus (D-15) — Kalkulation nach Bundesdurchschnitt')}</>}
            </p>
            <p className="a3-cap mt-1">
              Wirkt auf den Bauwerk-Block (KG{NNBSP}300{NNBSP}+{NNBSP}400{NNBSP}+{NNBSP}UG),
              nicht auf Risikozuschläge. Der Zustand geht in den Snapshot des
              Angebots ein; im Kostentreiber steht der Faktor immer als Zeile —
              deaktiviert mit dem Betrag, den er hinzufügen würde.
            </p>
          </div>
          {/* Switch — контрактный контрол именно для этой настройки
              (components-core §Switch: «Regionalfaktor anwenden»). */}
          <Switch
            label="Regionalfaktor anwenden"
            checked={s.regionalfaktorActive}
            onChange={() => s.toggleRegionalfaktor()}
          />
        </div>
      </section>

      {/* Маржа и риск-ставки в презентации ОТСУТСТВУЮТ, не скрыты стилем
          (правило 11, R-17): содержимое не попадает в дерево. */}
      {s.mode === 'praesentation' && (
        <p className="mt-6 border border-border-default p-4 text-body text-text-secondary">
          <span aria-hidden="true">○ </span>{tx('Interne Kalibrierung (Marge, Risikozuschläge) ist im Präsentationsmodus nicht verfügbar.')}</p>
      )}
      {s.mode === 'intern' && (<>
      <section className="mt-6" aria-label="Marge">
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Marge (kundenseitig unsichtbar, D-01)')}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <caption className="sr-only">{tx('Margensätze nach Leistungsart')}</caption>
            <tbody>
              <tr className="border-b border-border-subtle">
                <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">{tx('Marge Eigenleistung')}</th>
                <td className="numeric py-2 text-right text-text-primary">
                  {cfg.margins.eigenleistungPercent}{NNBSP}% ⚙
                </td>
              </tr>
              <tr className="border-b border-border-subtle">
                <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">{tx('Marge Fremdleistung')}</th>
                <td className="numeric py-2 text-right text-text-primary">
                  {cfg.margins.fremdleistungPercent}{NNBSP}% ⚙
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-small text-text-muted">{tx('Provisorisch (⚙): Kalibrierung folgt dem Revisionsprotokoll (calculation-spec §5), nicht einem Eingabefeld. Das Verhältnis 2:1 ist wichtiger als die Absolutwerte.')}</p>
      </section>

      <section className="mt-6" aria-label="Risikozuschlag">
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Risikozuschlag-Treiber (D-02)')}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <caption className="sr-only">{tx('Risikozuschlag-Treiber mit Basis und Satz')}</caption>
            <thead>
              <tr className="border-b border-border-strong text-left">
                <th className="py-2 pr-4 font-medium">{tx('Treiber')}</th>
                <th className="py-2 pr-4 font-medium">{tx('Basis')}</th>
                <th className="py-2 text-right font-medium">{tx('Satz ⚙')}</th>
              </tr>
            </thead>
            <tbody>
              {cfg.riskDrivers.map((d) => (
                <tr key={d.label} className="border-b border-border-subtle">
                  {/* Код параметра из источника не показывается: формулировки
                      на языке следствий, не кодов (DC-44). */}
                  <td className="py-2 pr-4 text-text-primary">
                    {d.label.replace(/ \(`[^`]+`\)/, '')}
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">{d.base}</td>
                  <td className="numeric py-2 text-right text-text-primary">
                    +{NNBSP}{d.ratePercent}{NNBSP}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-small text-text-muted">
          Der Treiber existiert, damit ihn ein nachgereichtes Dokument
          auflöst. Summe aktiver Treiber gedeckelt bei{' '}
          {cfg.riskCapPercentOfBauwerk}{NNBSP}% vom Bauwerk.
        </p>
      </section>

      </>)}

      <section className="mt-6" aria-label="Dichte">
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Dichte')}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border border-border-default p-4">
          <p className="max-w-content text-small text-text-secondary">{tx('Unabhängige Nutzereinstellung (D-16) — der Modus ändert sie nie. Vor dem Teilen des Bildschirms wird Komfortabel empfohlen (Checklisten-Punkt in der Prüfung, kein Zwang).')}</p>
          <SegmentedControl
            legend="Darstellungsdichte"
            value={s.density}
            onChange={(d) => s.setDensity(d)}
            options={[
              { value: 'komfortabel', label: 'Komfortabel' },
              { value: 'kompakt', label: 'Kompakt' },
            ]}
          />
        </div>
      </section>

      <section className="mt-6" aria-label="Sprache">
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Sprache')}</h2>
        <div className="mt-2 border border-border-default p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Живой переключатель (правило 36): ключи словаря, de — источник
                и fallback. Язык артефактов — ОТДЕЛЬНАЯ настройка (D-13),
                которой в прототипе нет: числа и клиентские подписи остаются
                немецкими при любом языке UI. */}
            <SegmentedControl
              legend="Oberflächensprache"
              value={s.uiLanguage}
              onChange={(l) => s.setUiLanguage(l)}
              options={[
                { value: 'de', label: 'DE' },
                { value: 'en', label: 'EN' },
              ]}
            />
          </div>
          <p className="mt-3 text-small text-text-secondary">{tx('EN-Guidance-Texte sind nicht übersetzt und fallen sichtbar auf Deutsch zurück (D-20); Kundenartefakte auf Englisch werden nicht erzeugt (LOCALE-001). Artefaktsprache ist eine eigene Einstellung (D-13) und existiert im Prototyp nicht.')}</p>
        </div>
      </section>
    </div>
  )
}
