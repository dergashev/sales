import { useRef, useState } from "react";
import { Decimal } from "decimal.js";
import {
  configForOption,
  eligibleClientOptions,
  projectionForOption,
  resolvedViewedOptionId,
  useStore,
  type OptionConfig,
} from "../state/store";
import {
  NNBSP,
  present,
  formatDE,
  rateLabel,
  label as moneyLabel,
} from "../engine/money";
import { Button } from "../components/primitives";
import {
  Badge,
  NextStep,
  PageHeader,
  SelectField,
} from "../components/designSystem";
import { SegmentedControl } from "../components/controls";
import { PartialState } from "../components/DataStates";
import { useSemanticMotion } from "../design-system/motion";
import { useT, useTx } from "../i18n";
import { copyFor } from "../i18n/internal-refs";
import {
  isClientProjection,
  isVisibleInOutputProfile,
} from "../state/clientProjection";
import { CompositionBar } from "../design-system/CompositionBar";
import { buildKgCompositionSegments } from "../components/costComposition";

/**
 * S4 Variantenvergleich — созданные Opportunity Options рядом.
 *
 * Колонка = Option. До ревью № 13 здесь стояли три ЗАШИТЫХ сценария
 * (Basis / Ohne UG / EH 40) — пользователь видел интерфейс сравнения, но
 * сравнивал не то, что создал. Теперь каждая колонка считается живым
 * движком из конфигурации своей Option (`projectionForOption`), и второй
 * источник значений не существует.
 *
 * Дельты названы явно «zur Vergleichsbasis» — роли колонок независимы
 * (VARIANT-001): звезда зарезервирована за целевым оффером и базу
 * сравнения не означает. Интервал точности у каждой Option свой: он
 * сужается подтверждениями, а подтверждения принадлежат Option (D-19).
 */

const ES_LABEL: Record<string, string> = {
  GEG: "GEG",
  EH_55: `EH${NNBSP}55`,
  EH_40: `EH${NNBSP}40`,
};

export function S4Vergleich() {
  const s = useStore();
  const tx = useTx();
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { reduced: reducedMotion } = useSemanticMotion();
  const client = isClientProjection(s.mode);
  // REDESIGN R3: only client-eligible Options (the PD-3 export-readiness
  // signal — `eligibleClientOptions`) may become a column/selectable Option
  // in Kundenansicht. Vorbereitung keeps seeing every created Option,
  // ready or not — that is exactly what preparation work is for.
  const eligibleIds = client
    ? new Set(eligibleClientOptions(s).map((o) => o.id))
    : null;
  const viewedId = resolvedViewedOptionId(s);

  const cols = s.options.flatMap((o) => {
    if (eligibleIds && !eligibleIds.has(o.id)) return [];
    const cfg = configForOption(s, o.id);
    const p = projectionForOption(s, o.id);
    return cfg && p ? [{ option: o, cfg, p }] : [];
  });

  if (cols.length === 0) {
    if (client && s.options.length > 0) {
      // Real Option(s) exist for this Opportunity — they are just not
      // client-ready yet. A distinct, honest state from "none exist at
      // all" below: the empty-state principle forbids collapsing "not yet
      // relevant" and "cannot be presented" into the same sentence.
      return (
        <div className="px-7 py-6">
          <PageHeader title={tx("Optionen")} />
          <p className="mt-4 text-body text-text-secondary">
            <span aria-hidden="true">○ </span>
            {tx(
              "Für dieses Projekt ist noch keine Option bereit für die Kundenansicht.",
            )}
          </p>
        </div>
      );
    }
    // В конвейер без Option не попасть, но состояние обязано объяснить
    // себя, а не рендерить пустую таблицу (правило 30: empty — не пропуск).
    return (
      <div className="px-7 py-6">
        <p className="text-body text-text-secondary">
          <span aria-hidden="true">○ </span>
          {tx(
            "Noch keine Opportunity Option angelegt. Optionen entstehen auf der Opportunity-Karte, nachdem Konflikte gelöst und Parameter bestätigt sind.",
          )}
        </p>
      </div>
    );
  }

  const base = cols[0]!;

  const money = (d: Decimal) => {
    const pr = present(d);
    return `${pr.prefix}${pr.prefix ? NNBSP : ""}${pr.display}`;
  };
  const delta = (d: Decimal) => {
    if (d.isZero()) return "—";
    const pr = present(d.abs());
    const sign = d.isNegative() ? "−" : "+";
    return `${sign}${NNBSP}${pr.prefix ? pr.prefix + NNBSP : ""}${pr.display}`;
  };
  const perBuilding = (cfg: OptionConfig, f: (id: string) => string) =>
    Object.keys(cfg.buildings)
      .filter((id) => cfg.included[id])
      .map(f)
      .join(" · ");
  // QA (Rebuild Configurator Workspace, AC-11): falling back to the raw `id`
  // whenever `client` was false leaked fixture ids (e.g. "DEMO-B-A") into
  // Vorbereitung, which is still human-facing, just not the final client
  // artifact. `stableName` is fixture-level data (present in every mode),
  // so resolve it unconditionally — never the raw id.
  const buildingLabel = (id: string, config: OptionConfig) =>
    config.buildings[id]?.stableName ?? tx("Gebäude");

  type Sub = { text: string; save: boolean } | null;
  type Row = {
    label: string;
    group: string;
    cells: string[];
    subCells?: Sub[];
  };

  const rows: Row[] = [
    {
      group: "ERGEBNIS",
      label: `${tx(base.p.result.totalLabel)} (€)`,
      cells: cols.map((c) => money(c.p.result.total.exact)),
      // Дельта к базе — подстрочник той же ячейки (.a3-d контракта DC-11),
      // экономия получает .a3-save; отдельная строка дельты не существует.
      subCells: cols.map((c, i) =>
        i === 0
          ? null
          : {
              text: `${delta(c.p.result.total.exact.minus(base.p.result.total.exact))} gegenüber ${base.option.name}`,
              save: c.p.result.total.exact.lt(base.p.result.total.exact),
            },
      ),
    },
    {
      // Each Option can carry a different building set and therefore a
      // different typed denominator. The denominator travels with its cell;
      // a shared row label may never borrow it from the base column.
      group: "ERGEBNIS",
      label: t("comparison.leadRate"),
      cells: cols.map((c) => rateLabel(c.p.leadRate)),
    },
    {
      group: "ERGEBNIS",
      label: "Schätzunsicherheit",
      cells: cols.map((c) => `±${NNBSP}${c.p.uncertaintyPp}${NNBSP}%`),
    },
    {
      group: "ERGEBNIS",
      label: "Bauzeit (ab OKBP)",
      cells: cols.map(
        (c) =>
          `${c.p.duration.prefix}${c.p.duration.prefix ? NNBSP : ""}${c.p.duration.display}`,
      ),
    },
    {
      group: "ERGEBNIS",
      label: "Fertigstellung",
      cells: cols.map((c) => formatDate(c.p.duration.completionDate)),
    },
    {
      group: "UMFANG",
      label: "Gebäude im Angebot",
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) => buildingLabel(id, c.cfg)),
      ),
    },
    {
      group: "UMFANG",
      label: "Untergeschoss",
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) =>
          c.cfg.buildings[id]!.untergeschoss === "kein_ug"
            ? `${buildingLabel(id, c.cfg)}: nicht Bestandteil`
            : `${buildingLabel(id, c.cfg)}: enthalten`,
        ),
      ),
    },
    {
      group: "UMFANG",
      label: "BGF unterirdisch (m²)",
      cells: cols.map((c) =>
        formatDE(
          Object.keys(c.cfg.buildings)
            .filter(
              (id) =>
                c.cfg.included[id] &&
                c.cfg.buildings[id]!.untergeschoss !== "kein_ug",
            )
            .reduce(
              (a, id) => a.plus(c.cfg.buildings[id]!.bgfBelowGround),
              new Decimal(0),
            ),
          2,
        ),
      ),
    },
    ...(!client
      ? [
          {
            group: "UMFANG",
            label: "KG 700",
            cells: cols.map((c) =>
              c.cfg.kg700Mode === "hoaiAho"
                ? "nach HOAI und AHO als eigene Position"
                : "im All3-Verfahren 70/22/8 verteilt",
            ),
          },
        ]
      : []),
    {
      group: "QUALITÄT",
      label: "Energiestandard",
      cells: cols.map((c) =>
        perBuilding(
          c.cfg,
          (id) =>
            `${buildingLabel(id, c.cfg)}: ${ES_LABEL[c.cfg.buildings[id]!.energiestandard]}`,
        ),
      ),
    },
    {
      group: "QUALITÄT",
      label: "Klassifikation nach MBO §2",
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) =>
          c.cfg.buildings[id]!.gebaeudeklasse.confirmed
            ? `${buildingLabel(id, c.cfg)}: ✓ bestätigt`
            : `${buildingLabel(id, c.cfg)}: ▲ nicht bestätigt`,
        ),
      ),
    },
  ];

  // «Различается» — вычисляется из ячеек, а не объявляется: строка с
  // одинаковыми значениями во всех колонках различием не является.
  const visible = rows.filter(
    (r) => showAll || new Set(r.cells).size > 1 || r.group === "ERGEBNIS",
  );
  const groups = [...new Set(visible.map((r) => r.group))];

  return (
    <div className="px-7 py-6">
      <PageHeader
        title={
          client && cols.length === 1
            ? tx("Ihr Angebot")
            : tx("Variantenvergleich")
        }
        meta={
          client && cols.length === 1 ? undefined : (
            <>
              {cols.length}
              {NNBSP}
              {cols.length === 1 ? "Option" : "Optionen"}
            </>
          )
        }
      />

      {!client && (
        <nav className="mt-4 flex flex-wrap items-center gap-3"
             aria-label={tx("Vergleichsnavigation")}>
          <Button variant="ghost" onClick={() => s.setPipelineView("konfigurator")}>
            {t("nav.konfigurator")}
          </Button>
          <Button
            onClick={() => s.setPipelineView("export")}
            disabled={!s.canBeginConfiguration() || !s.configurationComplete()}
            disabledReason={t("configurator.finalGate.exportBlockedReason")}
          >
            {t("nav.export")}
          </Button>
        </nav>
      )}

      {/* REDESIGN R3: with >=2 client-eligible Options, the salesperson can
          switch which one is PRESENTED without leaving this screen and
          without touching the internally active/preparation Option
          (`setViewedOption` only ever writes `viewedOptionId`). This is a
          distinct capability from the comparison table below it — Option
          selector vs comparison, per the ticket's own boundary — they just
          currently share a screen; a Kundenansicht-wide selector reachable
          from every narrative section is out of scope for this candidate. */}
      {client &&
        cols.length >= 2 &&
        (() => {
          const segments = cols.map((c) => ({
            value: c.option.id,
            label: `${c.option.name} · ${money(c.p.result.total.exact)}${NNBSP}€`,
          }));
          const currentId = cols.some((c) => c.option.id === viewedId)
            ? viewedId!
            : cols[0]!.option.id;
          const current = cols.find((c) => c.option.id === currentId)!;
          return (
            <div className="mt-4">
              {segments.length <= 3 ? (
                <SegmentedControl
                  legend={tx("Wird präsentiert")}
                  value={currentId}
                  onChange={(id) => s.setViewedOption(id)}
                  options={segments}
                />
              ) : (
                <SelectField
                  label={tx("Wird präsentiert")}
                  value={currentId}
                  onChange={(event) => s.setViewedOption(event.target.value)}
                >
                  {cols.map((c) => (
                    <option key={c.option.id} value={c.option.id}>
                      {c.option.name} · {money(c.p.result.total.exact)}
                      {NNBSP}€
                    </option>
                  ))}
                </SelectField>
              )}
              {/* One concise polite announcement per switch (a11y contract) —
                not a per-value trickle. */}
              <p className="sr-only" aria-live="polite">
                {`${tx("Wird präsentiert")}: ${current.option.name} · ${money(current.p.result.total.exact)}${NNBSP}€`}
              </p>
            </div>
          );
        })()}

      {/* REDESIGN R3 (AUD-audit F20 companion): one eligible Option used to
          render this screen fully blank in Kundenansicht — the audit's
          headline empty-state defect. A single client-eligible Option now
          gets a real, deliberate summary instead of nothing. */}
      {client &&
        cols.length === 1 &&
        (() => {
          const c = cols[0]!;
          const priceUnavailable = c.p.result.total.exact.isZero();
          return (
            <div className="a3-heroband mt-4">
              <div className="a3-hb a3-hb-total">
                <h3 className="a3-hb-cap">{tx(c.p.result.totalLabel)}</h3>
                {priceUnavailable ? (
                  <PartialState
                    label={t("money.priceNotDetermined")}
                    consequence={c.p.result.totalLabel}
                  />
                ) : (
                  <p className="a3-hb-num numeric">
                    {c.p.result.total.prefix && (
                      <span aria-hidden="true">
                        {c.p.result.total.prefix}
                        {NNBSP}
                      </span>
                    )}
                    {present(c.p.result.total.exact).display}
                    <span className="a3-hb-unit">{NNBSP}€</span>
                  </p>
                )}
              </div>
              {!priceUnavailable && (
                <>
                  <div className="a3-hb">
                    <p className="a3-hb-num numeric">
                      {c.p.leadRate.prefix && (
                        <span aria-hidden="true">
                          {c.p.leadRate.prefix}
                          {NNBSP}
                        </span>
                      )}
                      {c.p.leadRate.display}
                      <span className="a3-hb-unit">{NNBSP}€/m²</span>
                    </p>
                    <span className="a3-hb-cap">
                      {tx(c.p.leadRate.denominatorLabel)}
                    </span>
                  </div>
                  <div className="a3-hb">
                    <p className="a3-hb-num numeric">
                      {c.p.duration.prefix && (
                        <span aria-hidden="true">
                          {c.p.duration.prefix}
                          {NNBSP}
                        </span>
                      )}
                      {c.p.duration.display.replace(`${NNBSP}Monate`, "")}
                      <span className="a3-hb-unit">{NNBSP}Monate</span>
                    </p>
                    <span className="a3-hb-cap">
                      {tx("ab OKBP")} · {tx("Fertigstellung")}{" "}
                      {formatDate(c.p.duration.completionDate)}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      {client && cols.length === 1 && (
        <p className="a3-cap mt-3">
          {perBuilding(cols[0]!.cfg, (id) => buildingLabel(id, cols[0]!.cfg))}
        </p>
      )}

      {/* The row-filter toggle only means something once a table exists
          (F20/AC-08): with fewer than two options it would be a live
          control over nothing. */}
      {cols.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-text-secondary">
            {t(showAll ? "comparison.allHint" : "comparison.differencesHint")}
          </p>
          <Button onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
            {tx(showAll ? "nur Unterschiede" : "alle Zeilen anzeigen")}
          </Button>
        </div>
      )}

      {cols.length < 2 && isVisibleInOutputProfile(s.mode, "internalOnly") && (
        <div className="mt-4">
          <NextStep
            description={tx(
              "Zum Vergleichen braucht es eine zweite Option. Sie entsteht auf der Opportunity-Karte — mit eigener Konfiguration, unabhängig von dieser.",
            )}
            action={tx("Zur Opportunity-Karte")}
            onAction={() => {
              if (s.opportunityId) s.openOpportunity(s.opportunityId);
            }}
          />
        </div>
      )}

      {/* F20: with fewer than two options the guidance card above is the
          whole state — no comparison table renders alongside it (AC-08
          forbids a table coexisting with the "need a second option"
          guidance, not just an empty one). */}
      {cols.length > 1 && (
        <>
          <div
            className="a3-comparison-controls mt-4"
            aria-label={tx("Vergleich horizontal steuern")}
          >
            <Button
              onClick={() =>
                scrollRef.current?.scrollTo({
                  left: 0,
                  behavior: reducedMotion ? "auto" : "smooth",
                })
              }
            >
              {tx("Zum Zeilenanfang")}
            </Button>
            <Button
              onClick={() =>
                scrollRef.current?.scrollTo({
                  left: scrollRef.current.scrollWidth,
                  behavior: reducedMotion ? "auto" : "smooth",
                })
              }
            >
              {tx("Zum Zeilenende")}
            </Button>
          </div>

          <div
            ref={scrollRef}
            className="a3-comparison-scroll mt-3"
            role="region"
            aria-label={tx("Horizontal scrollbarer Variantenvergleich")}
            tabIndex={0}
          >
            <table className="a3-cmp border-collapse">
              <caption className="sr-only">
                {tx("Vergleich der Opportunity Options")}
              </caption>
              {/* One `<col>` per option gives the whole column a definite,
              stable width up front (kept from an earlier rework round —
              harmless, and it makes the scroll-snap math in
              components.css predictable). It is NOT what fixes the P1
              money-value defect; see components.css for the actual root
              cause (the sticky first column visually covering scrolled
              content, not a table-sizing/paint issue) and its fix
              (scroll-snap). The label column needs no `<col>` width of its
              own; its sticky/min-width already comes from the
              `:first-child` rule in components.css. */}
              <colgroup>
                <col />
                {cols.map((c) => (
                  <col key={c.option.id} className="a3-cmp-optioncol" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th>{showAll ? "alle Zeilen" : "nur Unterschiede"}</th>
                  {cols.map((c, i) => {
                    // REDESIGN R2 §5 "COLUMN IDENTITY": the same OptionCard DNA
                    // (building chips, headline subtotal, KG mini-composition)
                    // above the existing dense table — no second reading of any
                    // value, the SAME `kgSplit`/`buildKgCompositionSegments`
                    // OptionCard already uses (costComposition.ts).
                    const segments = buildKgCompositionSegments(
                      c.p.kgSplit,
                      (group) => t(`costGroup.${group}`),
                    );
                    return (
                      // This `<th>` is the scroll-snap target for its column
                      // (components.css: `scroll-snap-align:end`) — see there
                      // for why the money value needed protecting from the
                      // sticky first column, not a width/sizing fix.
                      <th
                        key={c.option.id}
                        className={`a3-num${c.option.id === s.activeOptionId ? " a3-target" : ""}`}
                      >
                        {c.option.name}
                        <span className="mt-1 flex flex-wrap justify-end gap-1 text-small font-regular text-text-secondary">
                          {!client && <span>{c.option.id}</span>}
                          {i === 0 && (
                            <Badge sign="B">{tx("Vergleichsbasis")}</Badge>
                          )}
                          {c.option.id === s.activeOptionId && (
                            <Badge sign="●">{tx("in Arbeit")}</Badge>
                          )}
                        </span>
                        {perBuilding(c.cfg, (id) =>
                          buildingLabel(id, c.cfg),
                        ) && (
                          <span className="mt-2 flex flex-wrap justify-end gap-1">
                            {Object.keys(c.cfg.buildings)
                              .filter((id) => c.cfg.included[id])
                              .map((id) => (
                                <span
                                  key={id}
                                  className="border border-border-default px-2 py-1 text-small font-regular text-text-secondary"
                                >
                                  {buildingLabel(id, c.cfg)}
                                </span>
                              ))}
                          </span>
                        )}
                        <span className="mt-2 block text-metric-section font-bold text-text-primary numeric">
                          {moneyLabel(present(c.p.result.total.exact))}
                        </span>
                        {segments.length > 0 && (
                          <div className="mt-2">
                            <CompositionBar
                              segments={segments}
                              total={c.p.result.total.exact}
                              variant="compact"
                              incompleteLabel={t("money.priceNotDetermined")}
                            />
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows
                    key={g}
                    group={g}
                    span={cols.length + 1}
                    rows={visible.filter((r) => r.group === g)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-small text-text-muted">
            {copyFor(
              tx(
                "Jede Spalte wird live aus der Konfiguration ihrer Option gerechnet — es gibt keinen zweiten Zahlenbestand. Die Schätzunsicherheit gehört der Option: sie verengt sich durch Bestätigungen, nicht durch Options-Wahl (D-19).",
              ),
              s.mode,
            )}
          </p>
          <p className="mt-2 text-small text-text-muted">
            {copyFor(
              tx(
                "Rollen sind unabhängige Text-Badges: Deltas rechnen zur benannten Vergleichsbasis (VARIANT-001, XSC-08).",
              ),
              s.mode,
            )}
          </p>
        </>
      )}

      {cols.length > 1 && (
        <div className="mt-5">
          <NextStep
            description={tx(
              "Die aktive Option ist verglichen — weiter zur Prüfung und zum Versand des Angebots.",
            )}
            action={tx("Angebot prüfen und exportieren")}
            onAction={() => s.setPipelineView("export")}
          />
        </div>
      )}
    </div>
  );
}

function GroupRows({
  group,
  span,
  rows,
}: {
  group: string;
  span: number;
  rows: Array<{
    label: string;
    cells: string[];
    subCells?: Array<{ text: string; save: boolean } | null>;
  }>;
}) {
  if (!rows.length) return null;
  return (
    <>
      <tr className="a3-comparison-group">
        <th
          colSpan={span}
          scope="colgroup"
          className="text-small"
          style={{ gridColumn: "1 / -1" }}
        >
          {group}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.label}>
          <th scope="row" className="text-text-secondary">
            {r.label}
          </th>
          {r.cells.map((c, i) => (
            <td
              key={i}
              className="a3-num"
            >
              {c}
              {r.subCells?.[i] && (
                <span
                  className={"a3-d" + (r.subCells[i]!.save ? " a3-save" : "")}
                >
                  {r.subCells[i]!.text}
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
