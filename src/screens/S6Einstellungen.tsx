import catalog from '../fixtures/catalog.json'
import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'

/**
 * S6 Einstellungen — скрыто от клиента.
 *
 * Ставки маржи и драйверы риска — провизорные (⚙) и показываются как данные
 * конфигурации, не редактируются в прототипе: их калибровка — протокол
 * ревизии, а не поле ввода. Живой здесь Regionalfaktor: его состояние входит
 * в снапшот оффера (D-15), и включение — событие журнала с дельтой.
 */
export function S6Einstellungen() {
  const s = useStore()
  // Числа не хардкодятся в экране: internalConfig извлечён построителем
  // из calculation-spec §1.1 — один источник, одно место правки.
  const cfg = catalog.internalConfig

  return (
    <div className="mx-auto max-w-content px-5 py-5">
      <header className="border-b border-border-strong pb-3">
        <h1 className="text-body font-bold text-text-primary">
          Einstellungen · intern
        </h1>
      </header>

      <section className="mt-5" aria-label="Regionalfaktor">
        <h2 className="text-body font-bold text-text-primary">Regionalfaktor</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border border-border-default p-4">
          <div>
            <p className="text-body text-text-primary">
              Musterland · Faktor 1,08 ⚙ ·{' '}
              {s.regionalfaktorActive
                ? <><span aria-hidden="true">✓ </span>aktiviert</>
                : <>Standard: aus (D-15) — Kalkulation nach Bundesdurchschnitt</>}
            </p>
            <p className="mt-1 text-small text-text-secondary">
              Wirkt auf den Bauwerk-Block (KG{NNBSP}300{NNBSP}+{NNBSP}400{NNBSP}+{NNBSP}UG),
              nicht auf Risikozuschläge. Der Zustand geht in den Snapshot des
              Angebots ein; im Kostentreiber steht der Faktor immer als Zeile —
              deaktiviert mit dem Betrag, den er hinzufügen würde.
            </p>
          </div>
          <Button variant={s.regionalfaktorActive ? 'primary' : 'secondary'}
                  onClick={() => s.toggleRegionalfaktor()}
                  aria-pressed={s.regionalfaktorActive}>
            {s.regionalfaktorActive ? 'Deaktivieren' : 'Aktivieren'}
          </Button>
        </div>
      </section>

      <section className="mt-6" aria-label="Marge">
        <h2 className="text-body font-bold text-text-primary">
          Marge (kundenseitig unsichtbar, D-01)
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <caption className="sr-only">Margensätze nach Leistungsart</caption>
            <tbody>
              <tr className="border-b border-border-subtle">
                <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">
                  Marge Eigenleistung
                </th>
                <td className="numeric py-2 text-right text-text-primary">
                  {cfg.margins.eigenleistungPercent}{NNBSP}% ⚙
                </td>
              </tr>
              <tr className="border-b border-border-subtle">
                <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">
                  Marge Fremdleistung
                </th>
                <td className="numeric py-2 text-right text-text-primary">
                  {cfg.margins.fremdleistungPercent}{NNBSP}% ⚙
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-small text-text-muted">
          Provisorisch (⚙): Kalibrierung folgt dem Revisionsprotokoll
          (calculation-spec §5), nicht einem Eingabefeld. Das Verhältnis 2:1
          ist wichtiger als die Absolutwerte.
        </p>
      </section>

      <section className="mt-6" aria-label="Risikozuschlag">
        <h2 className="text-body font-bold text-text-primary">Risikozuschlag-Treiber (D-02)</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <caption className="sr-only">Risikozuschlag-Treiber mit Basis und Satz</caption>
            <thead>
              <tr className="border-b border-border-strong text-left">
                <th className="py-2 pr-4 font-medium">Treiber</th>
                <th className="py-2 pr-4 font-medium">Basis</th>
                <th className="py-2 text-right font-medium">Satz ⚙</th>
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

      <section className="mt-6" aria-label="Sprache">
        <h2 className="text-body font-bold text-text-primary">Sprache</h2>
        <p className="mt-2 border border-border-default p-4 text-body text-text-secondary">
          Oberfläche: DE · EN-Guidance-Texte sind nicht übersetzt und werden
          intern als solche markiert; Kundenartefakte auf Englisch werden
          nicht erzeugt (D-20, LOCALE-001). Artefaktsprache ist eine eigene
          Einstellung (D-13).
        </p>
      </section>
    </div>
  )
}
