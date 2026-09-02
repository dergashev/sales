import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  buildingConfirmed,
  configForOption,
  projectionForOption,
  useStore,
} from "../state/store";
import { buildKgCompositionSegments } from "../components/costComposition";
import { CompositionBar } from "../design-system/CompositionBar";
import {
  NNBSP,
  label as moneyLabel,
  present,
} from "../engine/money";
import { Button } from "../components/primitives";
import { useT, useTx, localizeMoneyText } from "../i18n";
import { InternalNote } from "../components/InternalNote";
import { Badge, Card, FormField } from "../components/designSystem";
import { startContinuityTransition, useSemanticMotion } from "../design-system/motion";
import { Dialog, type DialogHandle } from "../components/Dialog";
import type { Decimal } from "decimal.js";

/**
 * Opportunity Options — die Option als kommerzielles Objekt, plus die
 * DC-43-Notiz-Einstiegsstelle, die mit ihr dieselbe Projektebene teilt.
 *
 * Reine Extraktion aus dem zurückgezogenen `OpportunityCard.tsx`: dieselben
 * Komponenten, dasselbe Markup, dieselben i18n-Schlüssel, dieselbe
 * Accessibility-Anatomie. Der neue Projekt-Bildschirm besitzt das Anlegen
 * einer Option über eine andere kanonische Fähigkeit — deshalb trägt der
 * Abschnitt hier KEINE eigene "Opportunity Option anlegen"-Primäraktion und
 * kein eigenes Gate mehr; die Galerie selbst (1-vs-mehrere-Spalten, Fokus
 * und Scroll auf die frisch angelegte Zeile) bleibt unverändert.
 */

/** Тот же состав, что у `OfferPanel.tsx`'s локального `moneyOut` — не
 *  переизобретается, просто недоступен оттуда как экспорт. */
function optionRowMoney(exact: Decimal, language: "de" | "en"): string {
  return localizeMoneyText(moneyLabel(present(exact)), language);
}

function optionEventTimestamp(iso: string, language: "de" | "en"): string {
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Same signed-delta convention as `S4Vergleich.tsx`'s local `delta()` —
 *  not exported from there, so restated here rather than imported across a
 *  screen boundary for one six-line formatter. */
function optionDeltaMoney(exact: Decimal, language: "de" | "en"): string {
  if (exact.isZero()) return "—";
  const sign = exact.isNegative() ? "−" : "+";
  return localizeMoneyText(
    `${sign}${NNBSP}${moneyLabel(present(exact.abs()))}`,
    language,
  );
}

/**
 * Internal Note (DC-43) behind the canonical `Dialog` (#16 Part 5/AC-07):
 * the header utility button is the ONLY entry point now — the note no
 * longer sits inline at the bottom of the primary page, so it never
 * occupies readiness navigation or competes with the stepper/gate flow for
 * attention. `InternalNote` itself is untouched (data, autosave-on-idle,
 * NOTE-006 presentation-mode hiding all unchanged) — only its mount point
 * moves. The dialog title is `sr-only`: `InternalNote`'s own visible field
 * label already says "Interne Notiz" and is the entire dialog content, so a
 * second visible heading with the same words would be a duplicated label
 * the reader doesn't need (removal test) — the `sr-only` heading still
 * gives the dialog its required accessible name and initial-focus target.
 */
export function InternalNoteDialog({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: RefObject<HTMLElement>;
}) {
  const t = useT();
  const tx = useTx();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<DialogHandle>(null);
  if (!open) return null;
  return (
    <Dialog
      ref={dialogRef}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
      labelledBy={titleId}
      initialFocusRef={titleRef}
      returnFocusTo={returnFocusTo}
    >
      <h2
        ref={titleRef}
        id={titleId}
        tabIndex={-1}
        className="sr-only outline-none"
      >
        {tx("Interne Notiz")}
      </h2>
      <InternalNote />
      <div className="a3-row mt-4">
        <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
          {t("common.close")}
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * OptionCard · Opportunity Option as a commercial object (AUD-03/EXP-04,
 * REDESIGN R2 §3 DESIGN-09). Built on the canonical `Card`
 * (title/status/meta/actions, `components-core.md` CARD-001) — no second
 * card primitive — with the option's building composition, subtotal,
 * KG mini-composition (`CompositionBar`, R1) and, at ≥2 options, a delta
 * against the same array-order baseline `S4Vergleich.tsx` already names
 * "Vergleichsbasis" (VARIANT-001). No new commercial semantics: every value
 * here already exists in `projectionForOption`/`configForOption`.
 *
 * Deliberately carries NO `MediaFrame` — options of one project have no
 * truthful differentiating imagery yet, and near-identical placeholder art
 * would violate the imagery-semantic rule (R2 §6). Identity comes from
 * name + building composition + commercial structure instead.
 */
export function OptionCard({
  option,
  justCreated,
  rowRef,
}: {
  option: { id: string; name: string };
  justCreated: boolean;
  rowRef?: RefObject<HTMLLIElement>;
}) {
  const s = useStore();
  const t = useT();
  const tx = useTx();
  const { fadeRise, reduced } = useSemanticMotion();
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(option.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameFieldId = useId();

  useEffect(() => {
    if (!renaming) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [renaming]);

  /**
   * QA-Rework (AUD-03): ohne Prüfung erzeugte Umbenennen genau die
   * Namenskollision, die dieses Ticket beseitigt — «Option 2» in «Option
   * 1» umbenannt, während «Option 1» schon existiert, ergab zwei Zeilen
   * mit demselben Namen und einen Toast, der das still bestätigte. Rule
   * 12 (kein Blockieren ohne Erklärung): eine Kollision wird nicht
   * stillschweigend verworfen — der Bearbeitungsmodus bleibt offen, mit
   * einer Ursache · Abhilfe-Zeile (FORM-003-Muster), bis der Name
   * eindeutig ist oder die Umbenennung abgebrochen wird (Escape).
   */
  function commitRename() {
    const next = draftName.trim();
    if (!next || next === option.name) {
      setRenaming(false);
      setRenameError(null);
      setDraftName(option.name);
      return;
    }
    if (s.options.some((o) => o.id !== option.id && o.name === next)) {
      setRenameError(
        tx(`Der Name «${next}» wird bereits verwendet · anderen Namen wählen`),
      );
      return;
    }
    setRenaming(false);
    setRenameError(null);
    s.renameOption(option.id, next);
  }

  // M-3: eine bereits versendete Option ist ein unveränderliches Snapshot —
  // dasselbe Feld (`snapshots[].optionId`), das den Snapshot selbst nennt,
  // beantwortet hier "wurde diese Option je verschickt?".
  const sent = s.snapshots.some((snap) => snap.optionId === option.id);
  const cfg = configForOption(s, option.id);
  const projection = projectionForOption(s, option.id);
  // AUD-03: die Erstellung selbst ist bewusst ein Opportunity-Ereignis
  // (`optionId: null`, siehe `JournalEvent` in store.ts — sie passiert VOR
  // dem Eintritt in die Pipeline) und zählt hier deshalb nicht als
  // "Aktivität dieser Option": eine frisch angelegte, nie geöffnete Option
  // hat ehrlich keine.
  const lastOwnEvent = s.journal.filter((e) => e.optionId === option.id).at(-1);
  const configured = Boolean(lastOwnEvent);
  const stateLabel = sent
    ? tx("Versendet")
    : configured
      ? tx("In Arbeit")
      : tx("Neu");
  const stateSign = sent ? "●" : configured ? "◐" : "○";

  // REDESIGN R2 §3 "BUILDING COMPOSITION": chips, not a joined string —
  // `buildingConfirmed` is the SAME function `canBeginConfiguration` gates
  // pricing on, fed this option's own reviews/confirmation plus the
  // opportunity-level `buildingConflicts` (conflicts predate Options —
  // resolved once at document-analysis time, shared by every Option of
  // this Opportunity, never per-Option state).
  const buildingChips = cfg
    ? Object.keys(cfg.buildings)
        .filter((id) => cfg.included[id])
        .map((id) => ({
          id,
          name: cfg.buildings[id]?.stableName ?? tx("Gebäude"),
          confirmed: buildingConfirmed(
            {
              buildingReviews: cfg.buildingReviews,
              buildingConfirmation: cfg.buildingConfirmation,
              buildingConflicts: s.buildingConflicts,
            },
            id,
          ),
        }))
    : [];

  const priceUnavailable =
    !projection || projection.result.total.exact.isZero();
  const totalLabelText = projection
    ? t(projection.result.totalLabel)
    : t("money.priceNotDetermined");
  const totalValueText =
    projection && !priceUnavailable
      ? optionRowMoney(projection.result.total.exact, s.uiLanguage)
      : t("money.priceNotDetermined");

  // REDESIGN R2 §8: the SAME `kgSplit` the KG tables elsewhere reconcile
  // against — no second sum, no second rounding.
  const segments = projection
    ? buildKgCompositionSegments(projection.kgSplit, (group) =>
        t(`costGroup.${group}`),
      )
    : [];

  // REDESIGN R2 §3 "COMPARISON SIGNAL": baseline = `s.options[0]`, the same
  // array-order baseline `S4Vergleich.tsx` names "Vergleichsbasis"
  // (VARIANT-001) — one comparison semantic, not a second one invented here.
  const baselineOption = s.options[0];
  const isBaseline = baselineOption?.id === option.id;
  const baselineProjection =
    !isBaseline && baselineOption
      ? projectionForOption(s, baselineOption.id)
      : null;
  const showDelta =
    s.options.length > 1 && !isBaseline && projection && baselineProjection;

  // VR2-09 — approved motion storyboard 2 "Option → Configurator"
  // (CONTINUITY): entering the Work shell from this Option card is the same
  // shared-identity edge the portfolio → Project step already uses
  // (`OpportunityList`), so the brand mark / shell cross-fade anchors the
  // entry to the commercial object instead of an instant page replacement.
  // `openOption` itself is untouched (internal active Option stays
  // authoritative); reduced motion applies the state change immediately.
  const openThisOption = () =>
    startContinuityTransition(reduced, () => s.openOption(option.id));

  return (
    <motion.li
      ref={rowRef}
      tabIndex={-1}
      variants={fadeRise}
      initial={justCreated ? "hidden" : false}
      animate="visible"
      exit="exit"
      className="outline-none"
    >
      <Card
        className={justCreated ? "a3-flash" : undefined}
        title={
          renaming ? (
            <FormField
              label={tx("Name der Option")}
              htmlFor={nameFieldId}
              error={renameError}
            >
              <input
                ref={nameInputRef}
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  setRenameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDraftName(option.name);
                    setRenameError(null);
                    setRenaming(false);
                  }
                }}
                onBlur={commitRename}
              />
            </FormField>
          ) : (
            option.name
          )
        }
        status={<Badge sign={stateSign}>{stateLabel}</Badge>}
        meta={
          buildingChips.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {buildingChips.map((b) => (
                <span
                  key={b.id}
                  // `py-1` (`--space-1`, 4px) — the project's spacing scale
                  // stops at 8 with no fractional keys (full theme.spacing
                  // replacement, not `extend`); `py-0.5` silently resolves to
                  // nothing rather than a smaller value.
                  className="inline-flex items-center gap-1 border border-border-default px-2 py-1 text-small text-text-secondary"
                >
                  {b.name}
                  {b.confirmed && <span aria-hidden="true">✓</span>}
                </span>
              ))}
            </span>
          ) : undefined
        }
        actions={
          <>
            {!sent && !renaming && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraftName(option.name);
                  setRenaming(true);
                }}
              >
                {tx("Umbenennen")}
              </Button>
            )}
            <Button onClick={openThisOption}>
              {tx("Öffnen")}
            </Button>
          </>
        }
        onOpen={renaming ? undefined : openThisOption}
      >
        <div>
          <span className="a3-cap block">{totalLabelText}</span>
          <span className="text-metric-section font-bold text-text-primary numeric block">
            {totalValueText}
          </span>
        </div>
        {segments.length > 0 && projection && (
          <div className="mt-3">
            <CompositionBar
              segments={segments}
              total={projection.result.total.exact}
              variant="compact"
              incompleteLabel={t("money.priceNotDetermined")}
            />
          </div>
        )}
        {showDelta && (
          <span className="a3-cap mt-2 block">
            {t("option.deltaVsBaseline", { baseline: baselineOption!.name })}
            {NNBSP}·{NNBSP}
            <span className="numeric">
              {optionDeltaMoney(
                projection!.result.total.exact.minus(
                  baselineProjection!.result.total.exact,
                ),
                s.uiLanguage,
              )}
            </span>
          </span>
        )}
        {lastOwnEvent && (
          <span className="a3-cap block mt-1">
            {tx("Zuletzt geändert")}
            {NNBSP}
            {optionEventTimestamp(lastOwnEvent.at, s.uiLanguage)}
          </span>
        )}
      </Card>
    </motion.li>
  );
}

/**
 * Der Options-Abschnitt selbst — die Galerie und nichts weiter.
 *
 * Das Anlegen einer Option gehört zum neuen Projekt-Bildschirm (andere
 * kanonische Fähigkeit), deshalb trägt dieser Abschnitt keine eigene
 * Primäraktion und kein eigenes Gate mehr. Der Aufrufer sagt nur, WELCHE
 * Option frisch angelegt wurde (`justCreatedOptionId`) — die Kontinuität
 * danach (Fokus und Scroll auf DIE eine Zeile, `focusSection`-Idiom, hier
 * auf die Zeile statt den ganzen Abschnitt gerichtet) bleibt hier, direkt
 * bei der Liste, die die Zeile rendert.
 */
export function ProjectOptionsSection({
  justCreatedOptionId,
  sectionRef,
}: {
  justCreatedOptionId: string | null;
  sectionRef?: React.RefObject<HTMLElement>;
}) {
  const s = useStore();
  const tx = useTx();
  const justCreatedRowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!justCreatedOptionId) return;
    justCreatedRowRef.current?.scrollIntoView?.({ block: "nearest" });
    justCreatedRowRef.current?.focus();
  }, [justCreatedOptionId]);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className="a3-sheet mt-6 outline-none"
      aria-label="Opportunity Options"
    >
      <h2 className="text-heading-3 font-bold text-text-primary">
        {tx("Opportunity Options")}
      </h2>

      {s.options.length > 0 && (
        // REDESIGN R2 §3 "OPTION GALLERY": at 1 option a single card at a
        // constrained measure (identity + completeness, no pretend
        // comparison); at ≥2, a comparison-ready 2-up grid so aligned
        // OptionCard rows can be scanned side by side (wraps to a further
        // row at 3+, never forced into horizontal scroll here).
        <ul
          className={
            s.options.length > 1
              ? "mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2"
              : // Single option: no grid needed, and a `max-w-content` cap
                // (the same content-column token every other single-column
                // section already uses) keeps one lonely card from stretching
                // edge to edge — no new width token invented for this.
                "mt-3 flex max-w-content flex-col gap-3"
          }
        >
          <AnimatePresence initial={false}>
            {s.options.map((o) => (
              <OptionCard
                key={o.id}
                option={o}
                justCreated={o.id === justCreatedOptionId}
                rowRef={
                  o.id === justCreatedOptionId
                    ? justCreatedRowRef
                    : undefined
                }
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
