import { Decimal } from "decimal.js";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import demo from "../fixtures/demo-0001.json";
import opportunities from "../fixtures/opportunities.json";
import {
  buildingConfirmed,
  configForOption,
  preparationProjection,
  preparationStatuses,
  projectBaselineChangesSinceConfirmation,
  projectionForOption,
  useStore,
  wflConflict,
} from "../state/store";
import { buildKgCompositionSegments } from "../components/costComposition";
import { CompositionBar } from "../design-system/CompositionBar";
import { effectiveFactValue } from "../state/buildingReview";
import {
  NNBSP,
  formatDE,
  label as moneyLabel,
  present,
  rateLabel,
} from "../engine/money";
import {
  Button,
  ProvenanceChip,
  useCountUp,
  type ProvenancePresentation,
} from "../components/primitives";
import { StaleState } from "../components/DataStates";
import { EstimateUncertaintyBadge } from "../components/EstimateUncertaintyBadge";
import { useT, useTx, localizeMoneyText } from "../i18n";
import { copyFor } from "../i18n/internal-refs";
import { DocumentAnalysis } from "../components/DocumentAnalysis";
import { InternalNote } from "../components/InternalNote";
import { Badge, Card, FormField, PageHeader } from "../components/designSystem";
import {
  WorkflowStepper,
  type WorkflowStep,
} from "../design-system/WorkflowStepper";
import { MediaFrame } from "../design-system/MediaFrame";
import { useSemanticMotion } from "../design-system/motion";
import { Dialog, type DialogHandle } from "../components/Dialog";
import { STAGE_TAG } from "../lib/opportunityStage";
import { factPresentation, stableName } from "./BuildingScope";
import { DELTA_CHIP_MS } from "../config/ui-policy";

/**
 * Карточка Opportunity — уровень между списком и рабочим конвейером.
 *
 * TASK 01 (deep-coherence audit, backlog dcb10e29) had consolidated the
 * former 4-stage Project Card readiness overview and the separate
 * "· Vorbereitung" workspace (P1–P5 tabs) into one ALWAYS-open six-stage
 * page with no real gating (STEP-003 read as "jumps never block"). "Rebuild
 * Project Card Workflow" (#16, backlog 9addfb3b) explicitly supersedes that
 * reading for this screen with its own newer, specific accepted authority:
 * back to FOUR stages, with a REAL per-stage lock (see `WorkflowStepper`'s
 * own doc comment) — 1 Document Analysis → 2 Conflicting Information →
 * 3 Project Baseline → 4 Opportunity Options. All section content from
 * Task 01 stays on this one page (no second document list, no second
 * conflict-resolution surface, no separate workspace reappears) — only the
 * STEPPER'S OWN stage count and lock semantics change; stages 3's three
 * former sub-stages (Offene Fragen & Annahmen / Projektübersicht / Projekt
 * bestätigen) keep their own separate `<section>`s, now reached through one
 * merged stepper entry.
 *
 * "· Vorbereitung" (`S2Vorbereitung.tsx`) stays retired per Task 01: P1's
 * document table and Grundrisse version resolution live in stage 1; P2's own
 * conflict copy and its Haus-A-only editable fields stay dropped (building-
 * fact editing belongs to Building & Scope); P3/P4 stay merged into stage 3;
 * P5 (Varianten) stays hidden.
 *
 * Internal Note (DC-43) is no longer part of this primary page (#16 Part 9)
 * — its data and component are untouched, but the entry point moves to a
 * header utility affordance behind the canonical `Dialog` (see
 * `InternalNoteDialog` below), so it never competes with the stepper/gate
 * flow for attention and is not silently deleted.
 *
 * Цены здесь нет и быть не может как ГЛАВНОГО числа: Gesamt-total принадлежит
 * Option, а Option ещё не существует. Show и Leitkennzahl (stage 4) —
 * ВТОРИЧНАЯ, явно T0-indicative метрика существующего движка
 * (`preparationProjection`), а не обещание готовой цены.
 */

const D = (s: string) => new Decimal(s);
const METRIC_EMPHASIS_CLASS = {
  primary: "a3-project-baseline-primary",
  supporting: "a3-project-baseline-supporting",
  total: "a3-project-baseline-total",
} as const;

/** A label/value/unit/provenance group inside a semantic definition list. */
function Metric({
  label,
  value,
  unit,
  provenance,
  emphasis = "supporting",
  operator,
}: {
  label: string;
  value: string | null;
  unit?: string;
  provenance?: ProvenancePresentation;
  emphasis?: "primary" | "supporting" | "total";
  operator?: "+" | "=" | "→";
}) {
  const tx = useTx();
  return (
    <div
      className={`a3-project-baseline-metric ${METRIC_EMPHASIS_CLASS[emphasis]}`}
    >
      <dt className="a3-cap">{label}</dt>
      <dd>
        <span className="numeric block text-text-primary">
          {operator && (
            <span aria-hidden="true" className="a3-project-baseline-operator">
              {operator}
            </span>
          )}
          {value === null ? (
            <span className="text-text-secondary">{tx("nicht erfasst")}</span>
          ) : (
            <>
              {value}
              {unit ? `${NNBSP}${unit}` : ""}
            </>
          )}
        </span>
        {provenance && (
          <span className="mt-2 block">
            <ProvenanceChip provenance={provenance} />
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * WFL is the reviewed value that can change while this card is open. The
 * number therefore uses the canonical 400 ms count-up and the existing
 * reserved Delta-Chip anatomy; static fixture-backed metrics stay on the
 * simpler `Metric` path above.
 */
function ReviewedWflMetric({
  value,
  provenance,
}: {
  value: Decimal;
  provenance: ProvenancePresentation;
}) {
  const tx = useTx();
  const counted = useCountUp(value, 2);
  const previous = useRef(value);
  const shownDelta = useRef<Decimal | null>(null);
  const [delta, setDelta] = useState<Decimal | null>(null);

  useEffect(() => {
    const change = value.minus(previous.current);
    previous.current = value;
    if (change.isZero()) return;
    shownDelta.current = change;
    setDelta(change);
    const timer = window.setTimeout(() => setDelta(null), DELTA_CHIP_MS);
    return () => window.clearTimeout(timer);
  }, [value.toString()]);

  const visibleDelta = shownDelta.current;
  const deltaText = visibleDelta
    ? `${visibleDelta.isNegative() ? "−" : "+"}${NNBSP}${formatDE(visibleDelta.abs(), 2)}${NNBSP}m²`
    : "";

  return (
    <div className="a3-project-baseline-metric a3-project-baseline-primary">
      <dt className="a3-cap">Total WFL nach WoFlV</dt>
      <dd>
        <span className="numeric block text-text-primary">
          {counted}
          {NNBSP}m²
        </span>
        <span className="mt-2 block">
          <ProvenanceChip provenance={provenance} />
        </span>
        <div className="a3-delta-slot mt-2">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-hidden={delta ? undefined : true}
            className={
              "a3-delta numeric" +
              (delta ? " a3-show" : "") +
              (visibleDelta?.isNegative() ? " a3-saving" : " a3-cost")
            }
          >
            {visibleDelta && (
              <>
                <span>{tx("Total WFL nach WoFlV geändert")}</span>
                <span className="font-medium">{deltaText}</span>
              </>
            )}
          </p>
        </div>
      </dd>
    </div>
  );
}

/**
 * Обзор готовности проекта — теперь канонический DC-13 `WorkflowStepper`
 * (`src/components/designSystem.tsx`), горизонтальный вариант; собственной
 * рукописной копии анатомии здесь больше нет (governance `DS-GOV-EX-07`
 * закрывает половину «нет канонического React-источника» для этого
 * потребителя — `Sidebar.tsx` now consumes the same canonical chapter
 * family, so this migration leaves no handwritten sibling anatomy).
 *
 * "Rebuild Project Card Workflow" (#16) заменяет прежние шесть
 * ВСЕГДА-открытых информационных стадий (Task 01) на ЧЕТЫРЕ стадии с
 * настоящим поэтапным гейтингом (STEP-003/правило 12: заблокированная
 * стадия остаётся доступной клавиатурой и называет причину текстом, но
 * активация её не переносит фокус — тот же паттерн, что `CheckboxCard`'s
 * `mandatory` уже использует для тумблера, здесь применённый к навигации).
 * Прежние стадии 3 (Offene Fragen & Annahmen) + 4 (Projektübersicht) + 5
 * (Projekt bestätigen) объединены в ОДНУ стадию «Project Baseline» с одним
 * подтверждающим действием — секции самой разметки остаются раздельными
 * (минимальное изменение, без риска для их собственных тестов), стадия
 * степпера прыгает на первую из них.
 */

/** Фокус и прокрутка к уже существующему разделу (общая логика прыжка). */
function focusSection(ref: RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView?.({ block: "start" });
  ref.current?.focus();
}

/**
 * Защита «Opportunity Option anlegen» от срабатывания дважды на один жест
 * (AUD-03/EXP-04): два быстрых клика раньше читали один и тот же устаревший
 * снимок `options.length` и обе Option получали одинаковое «Option 2».
 * Атомарное вычисление имени внутри `createOption` (store.ts) устраняет
 * саму коллизию независимо от этой защиты — она дополнительно превращает
 * повторный клик в ОДНО действие, а не два: клик уже открывает пользователя
 * прямо в новой Option (`pipelineView: 'buildingScope'`), и второй быстрый
 * клик почти всегда значит «первый как будто не сработал», а не «создай
 * ещё одну». Это инженерное решение, а не процитированная продуктовая
 * политика — в отличие от `config/ui-policy.ts`, где у каждой величины
 * обязан быть назван документ-источник.
 */
const OPTION_CREATE_GUARD_MS = 500;

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

function customerEvidenceDate(
  capturedAt: string,
  language: "de" | "en",
): string {
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${capturedAt}T00:00:00Z`));
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
 * the header utility button below is the ONLY entry point now — the note no
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
function InternalNoteDialog({
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
function OptionCard({
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
  const { fadeRise } = useSemanticMotion();
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
            <Button onClick={() => s.openOption(option.id)}>
              {tx("Öffnen")}
            </Button>
          </>
        }
        onOpen={renaming ? undefined : () => s.openOption(option.id)}
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

export function OpportunityCard() {
  const s = useStore();
  const t = useT();
  const tx = useTx();
  const meta = opportunities.items.find((o) => o.id === s.opportunityId);
  const documentSectionRef = useRef<HTMLElement>(null);
  const conflictSectionRef = useRef<HTMLElement>(null);
  const questionsSectionRef = useRef<HTMLElement>(null);
  // Stufen 4 (Projektübersicht) und 5 (Projekt bestätigen) zeigen im
  // Stufen-Überblick auf denselben physischen Abschnitt — siehe dessen
  // eigener Kommentar weiter unten.
  const parameterSectionRef = useRef<HTMLElement>(null);
  const optionsSectionRef = useRef<HTMLElement>(null);
  const confirmationStatusRef = useRef<HTMLDivElement>(null);
  const focusConfirmationAfterAction = useRef(false);
  const noteButtonRef = useRef<HTMLButtonElement>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const baselineChanges = projectBaselineChangesSinceConfirmation(s);
  const baselineStale = baselineChanges.length > 0;
  // AUD-03/EXP-04: Kontinuität nach dem Anlegen — welche Option ist neu, und
  // ihre Zeile, um Fokus/Scroll dorthin zu lenken (`focusSection`-Idiom,
  // hier auf DIE eine Zeile statt den ganzen Abschnitt gerichtet).
  const lastOptionCreateRequestAtRef = useRef(0);
  const [justCreatedOptionId, setJustCreatedOptionId] = useState<string | null>(
    null,
  );
  const justCreatedRowRef = useRef<HTMLLIElement>(null);

  function handleCreateOption() {
    const now = Date.now();
    if (now - lastOptionCreateRequestAtRef.current < OPTION_CREATE_GUARD_MS)
      return;
    lastOptionCreateRequestAtRef.current = now;
    const id = s.createOption();
    if (id) setJustCreatedOptionId(id);
  }

  useEffect(() => {
    if (!justCreatedOptionId) return;
    justCreatedRowRef.current?.scrollIntoView?.({ block: "nearest" });
    justCreatedRowRef.current?.focus();
  }, [justCreatedOptionId]);

  useEffect(() => {
    if (!focusConfirmationAfterAction.current) return;
    focusConfirmationAfterAction.current = false;
    confirmationStatusRef.current?.focus();
  }, [s.projectParamsConfirmed, baselineStale, s.journal.length]);

  if (!meta) return null;

  // Кейс проработан только один: остальные честно говорят об этом здесь,
  // а не изображают анализ, которого в прототипе нет.
  if (!meta.worked) {
    return (
      <div className="a3-page px-7 py-6">
        <header className="border-b border-border-strong pb-4">
          <p className="a3-cap">
            {meta.city} · {meta.country} · {meta.owner}
          </p>
          <h1 className="mt-1 text-heading-2 font-bold text-text-primary">
            {meta.name}
          </h1>
        </header>
        <p className="mt-5 border border-border-default p-4 text-body text-text-secondary">
          <span aria-hidden="true">○ </span>
          Diese Opportunity ist im Prototyp nicht ausgearbeitet. Vollständig
          durchgerechnet ist «{opportunities.items[0]!.name}» — dort läuft die
          Dokumentanalyse, die Konfliktlösung und die Kalkulation mit echter
          Arithmetik.
        </p>
        <div className="mt-4">
          <Button onClick={() => s.backToList()}>
            {tx("Zurück zu den Opportunities")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Параметры уровня проекта: суммы от сумм, никогда среднее из средних
  //    (правило 39), и из ОДНОГО источника истины — buildingReviews, никогда
  //    из фикстуры/derived напрямую (F-09: прежняя "Total BGF (S)" читала
  //    derived-Balkonanteil, тогда как принятый факт buildingReviews (D-26)
  //    держит BGF S = 0 — «производная площадь балкона намеренно не
  //    переиспользуется как DIN 277 BGF S»). ──
  const bs = demo.buildings;
  const buildingFactSum = (
    key:
      | "bgfRAbove"
      | "bgfSAbove"
      | "bgfRSBelow"
      | "bgfRSTotal"
      | "wfl"
      | "nuf"
      | "units",
  ) =>
    bs.reduce((total, b) => {
      const review = s.buildingReviews[b.id];
      const value = review ? effectiveFactValue(review.facts[key]) : null;
      return value ? total.plus(value) : total;
    }, new Decimal(0));
  const totalBgfR = buildingFactSum("bgfRAbove");
  const totalBgfS = buildingFactSum("bgfSAbove");
  // Underground BGF is its OWN independently extracted aggregate
  // (`bgfRSBelow`, buildingReview.ts) — never folded into "S, nicht
  // umschlossen" (D-26: that row is the genuine DIN 277 balcony/loggia
  // area and stays 0,00 here; underground floor area is a different
  // classification entirely).
  const totalBgfUG = buildingFactSum("bgfRSBelow");
  // AUD-02: this used to sum `bgfRSAbove` (above-ground only) while every
  // OTHER surface that says "R+S" — the Option's building cards
  // (BuildingScope.tsx), the fixture's own per-building `bgfRS`, and the
  // fixture's `sumBgfRS` — means the grand total (above + below ground).
  // That made this row silently disagree with its own label everywhere
  // else the same words appear. `bgfRSTotal` is the already-existing,
  // independently extracted, cross-checked grand-total aggregate
  // (buildingReview.ts) — not a client-side recomputation of the rows
  // above it, and now the same one every other surface already uses.
  const totalBgfRS = buildingFactSum("bgfRSTotal");
  const totalWfl = buildingFactSum("wfl");
  const totalNuf = buildingFactSum("nuf");
  const totalUnits = buildingFactSum("units");
  const conflict = wflConflict(s);
  const preparation = preparationStatuses(s);
  const documentProvenance: ProvenancePresentation = {
    kind: "document",
    label: t("provenance.document"),
  };
  const wflProvenance: ProvenancePresentation = {
    kind:
      s.fields.wfl.provenance === "vom Kunden bestätigt"
        ? "customerConfirmed"
        : s.fields.wfl.provenance === "manuell erfasst"
          ? "manual"
          : s.fields.wfl.provenance === "abgeleitet"
            ? "derived"
            : "document",
    label:
      s.fields.wfl.provenance === "vom Kunden bestätigt"
        ? t("provenance.customerConfirmed")
        : s.fields.wfl.provenance === "manuell erfasst"
          ? t("provenance.manual")
          : s.fields.wfl.provenance === "abgeleitet"
            ? t("provenance.derived")
            : t("provenance.document"),
  };
  // Rule 39 / F-05: a project's building count for the complex lead-metric
  // branch is how many buildings the PROJECT has, not how many happen to be
  // `included` in an Option's pricing scope that does not exist yet at this
  // level (Building & Scope, Task 02, runs later and may narrow that set).
  const prep = preparationProjection(s);

  const konfliktOffen = conflict.state === "open";
  const canCreateOptions = s.canCreateOptions();
  const createOptionDisabledReason =
    konfliktOffen && !s.projectParamsConfirmed
      ? tx("Erst Konflikte entscheiden und Projektparameter bestätigen")
      : konfliktOffen
        ? tx("Erst Konflikte entscheiden")
        : !s.projectParamsConfirmed
          ? tx("Erst Projektparameter bestätigen")
          : undefined;

  // ── Обзор готовности: 4 канонические стадии (#16 Part 1) вместо прежних
  //    шести — abgeleitet von den bereits existierenden Feldern, keine neue
  //    Fachlogik (D-13-Vertрак, siehe `WorkflowStepper` oben). Stufe 1 bleibt
  //    rein informativ (D-19, Regel 12 gilt für клиентские валидации, nicht
  //    für dieses Sequenz-Gate — #16's eigene, jüngere Autorität) und wird
  //    nie zur aktuellen Stufe; genau EINE der drei gate-tragenden Stufen
  //    (2 Konflikte / 3 Baseline / 4 Options) ist es immer — echte Sperren
  //    (STEP-003/Regel 12: gesperrt ≠ unsichtbar, der Grund steht dabei). ──
  const docsNeedAttention = demo.documents.some(
    (d) => d.parseStatus === "failed",
  );
  const currentStage: "conflict" | "confirm" | "options" = konfliktOffen
    ? "conflict"
    : !s.projectParamsConfirmed || baselineStale
      ? "confirm"
      : "options";
  const optionsState: WorkflowStep["state"] =
    s.options.length > 0 ? "done" : canCreateOptions ? "attention" : "blocked";
  const stages: WorkflowStep[] = [
    {
      id: "documents",
      label: tx("Dokumentanalyse"),
      state: docsNeedAttention ? "attention" : "done",
      rationale: docsNeedAttention
        ? tx(
            "Ein Dokument ist nicht lesbar · blockiert das Anlegen einer Opportunity Option nicht",
          )
        : tx("Analyse abgeschlossen"),
      onSelect: () => focusSection(documentSectionRef),
    },
    {
      id: "conflict",
      label: tx("Strittige Angaben"),
      state: currentStage === "conflict" ? "current" : "done",
      rationale: konfliktOffen
        ? tx("Entscheidung erforderlich · blockiert die Projektgrundlage")
        : tx("Entschieden"),
      onSelect: () => focusSection(conflictSectionRef),
    },
    {
      // Vereint die früheren Stufen 3 (Offene Fragen & Annahmen) + 4
      // (Projektübersicht) + 5 (Projekt bestätigen) zu EINER Stufe mit einer
      // Bestätigungsaktion (#16 Part 4/6) — der Sprung führt zum ersten der
      // drei zusammengehörigen Abschnitte, `questionsSectionRef`.
      id: "baseline",
      label: t("oppcard.baseline.title"),
      // Ein echtes Gate (#16 Part 3/AC-05): solange ein Konflikt offen ist,
      // bleibt die Projektgrundlage gesperrt statt nur „vorläufig“.
      state:
        currentStage === "confirm"
          ? "current"
          : konfliktOffen
            ? "blocked"
            : s.projectParamsConfirmed && !baselineStale
              ? "done"
              : "attention",
      previouslyDone: currentStage === "confirm" && baselineStale,
      rationale: konfliktOffen
        ? undefined
        : baselineStale
          ? t("oppcard.baseline.stepStale")
          : s.projectParamsConfirmed
            ? tx("Bestätigt")
            : tx(
                "Bestätigung erforderlich · blockiert das Anlegen einer Opportunity Option",
              ),
      blockedReason: konfliktOffen
        ? tx("Erst Konflikte entscheiden")
        : undefined,
      onSelect: () => focusSection(questionsSectionRef),
    },
    {
      id: "options",
      label: tx("Opportunity Options"),
      state: currentStage === "options" ? "current" : optionsState,
      // Der genaue Grund steht bereits an der echten Aktion (aria-describedby
      // des Create-Buttons unten) — hier absichtlich ein anderer Wortlaut,
      // damit dieselbe Erklärung nicht doppelt und mehrdeutig im Baum steht.
      rationale:
        optionsState === "blocked"
          ? undefined
          : optionsState === "done"
            ? tx("Angelegt")
            : tx("Bereit zum Anlegen"),
      blockedReason:
        optionsState === "blocked"
          ? (createOptionDisabledReason ??
            tx("Wartet auf die Voraussetzungen oben"))
          : undefined,
      onSelect: () => focusSection(optionsSectionRef),
    },
  ];

  // ── Stage 3 content: merged former P3 (Offene Fragen) + P4 (Annahmen),
  //    explicitly distinguishing OPEN QUESTION / SALES RECOMMENDATION / RISK
  //    (AC7). Resolution of the WFL conflict itself stays exclusively in
  //    stage 2 (AC3) — this stage only ever links back to it. ──
  const p = prep;
  const openQuestions = [
    {
      text: "Liegt eine Wohnflächenberechnung nach WoFlV vor?",
      deltaPp: 5,
      done: !preparation.questions.wfl,
      action: null as (() => void) | null,
    },
    {
      text: "Welcher Effizienzhaus-Standard ist vorgesehen?",
      deltaPp: 4,
      done: !preparation.questions.energyStandard,
      action: () => s.confirmEnergiestandardAnswer(),
    },
  ];
  const openOfThose = openQuestions.filter((q) => !q.done);
  const uncertaintyTarget =
    p.uncertaintyPp - openOfThose.reduce((a, q) => a + q.deltaPp, 0);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");

  // Task 03 (deep-coherence audit, F-26): names the chapter, not a derived
  // position — a cross-reference that survives KG toggling everywhere else
  // in the product should not have made an exception here.
  const scopeBoundariesChapterName = t("chapter.scopeBoundaries");
  // Активное допущение = каскад дошёл до подстановки (M-4). Список выводится
  // из состояния, а не поддерживается руками — поэтому он всегда точен.
  const recommendations: Array<{
    id: string;
    text: string;
    resolve?: () => void;
    resolveLabel?: string;
  }> = [];
  if (preparation.assumptions.buildingClass) {
    recommendations.push({
      id: "gk",
      // Дословно t0-fallback-rules.md:106; в слот значения подставлен
      // проектный GK 5 (в тексте правила стоит пример GK 4).
      text:
        "Die Gebäudeklasse ist noch nicht bestätigt. Die Geschossanzahl ist " +
        "lediglich Prüfauslöser und kein Nachweis; die Einstufung nach MBO §2 " +
        "erfolgt über das Brandschutzkonzept und die zugehörigen Nachweise. " +
        "Für die Kalkulation ist vorläufig GK 5 hinterlegt, Stand " +
        "«Prüfung erforderlich». Die endgültige Einstufung kann die " +
        "Anforderungen an Tragwerk und Kapselung und damit den Preis " +
        "verändern; mit Vorlage des Brandschutzkonzepts bestätigen wir sie.",
      resolve: () => s.confirmGebaeudeklasse(),
      resolveLabel: "Klassifikation bestätigen",
    });
  }

  return (
    <div className="a3-page px-7 py-6 lg:grid lg:grid-cols-[1.55fr_0.85fr] lg:gap-8 lg:items-start">
      <div className="a3-workspace min-w-0">
        <InternalNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          returnFocusTo={noteButtonRef}
        />

        <WorkflowStepper ariaLabel={tx("Projektstatus")} steps={stages} />

        {/* 1 · Анализ документации + разрешение версий планов (перенесено из
          "· Vorbereitung" P1 — единственный рендер списка документов, AC8). */}
        <section
          ref={documentSectionRef}
          tabIndex={-1}
          className="a3-sheet mt-6 outline-none"
          aria-label="Dokumentanalyse"
        >
          <DocumentAnalysis
            docs={demo.documents.map((d) => ({
              file: d.file,
              pages: typeof d.pages === "number" ? d.pages : null,
              parseStatus: d.parseStatus,
            }))}
            // Ручной ввод отсутствующего значения — это ровно то, что решает
            // Stage 3 (Offene Fragen & Annahmen): переход туда, а не открытие
            // отдельного экрана, которого больше нет.
            onManualCapture={() => focusSection(questionsSectionRef)}
          />

          <div className="mt-5 border border-border-default p-4">
            <h3 className="text-heading-3 font-bold text-text-primary">
              {tx("Versionsauflösung · Grundrisse")}
            </h3>
            <p className="a3-cap mt-2">
              {tx(
                "Zwei Versionen gefunden. Vorschlag des Systems: V2 — Datum im Plankopf ist neuer. Das Datum ist ein Beleg, keine Entscheidung (VERSION-002): die Auswahl trifft der Vertrieb, der Wechsel wird protokolliert, die ausgeschlossene Version bleibt nachvollziehbar.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["V2", "V1"] as const).map((v) => (
                <Button
                  key={v}
                  variant={s.activeGrundrisse === v ? "primary" : "secondary"}
                  onClick={() => s.activateGrundrisse(v)}
                  aria-pressed={s.activeGrundrisse === v}
                >
                  {s.activeGrundrisse === v && (
                    <span aria-hidden="true">✓ </span>
                  )}
                  Grundrisse_Muster_{v}.pdf
                </Button>
              ))}
            </div>
            <p className="mt-3 text-small text-text-muted">
              {tx(
                "Wiederholte Analyse überschreibt niemals Werte mit «manuell erfasst» oder «vom Kunden bestätigt» — bei Konflikt entscheidet der Vertrieb über den Diff (D-08).",
              )}
            </p>
          </div>
        </section>

        {/* 2 · Спорное из документации — ЕДИНСТВЕННОЕ место разрешения (AC3):
          прежний дубликат в "· Vorbereitung" P2 удалён вместе с ним. */}
        <section
          ref={conflictSectionRef}
          tabIndex={-1}
          className="a3-sheet mt-6 outline-none"
          aria-label="Strittige Angaben"
        >
          <h2 className="text-heading-3 font-bold text-text-primary">
            {tx("Strittige Angaben aus der Dokumentation")}
          </h2>
          {konfliktOffen ? (
            <div className="a3-konflikt mt-3">
              <p className="text-body text-text-primary">
                <span aria-hidden="true">▲ </span>
                {tx("Wohnfläche WFL nach WoFlV: zwei Kandidaten.")}
              </p>
              <div className="a3-kv">
                {conflict.candidates.map((c) => (
                  <span key={c.origin}>
                    <span className="a3-cap block">
                      {tx(c.origin === "customer" ? "Kunde" : "Dokument")}
                    </span>
                    <span className="numeric">
                      {formatDE(D(c.value), 2)}
                      {NNBSP}m²
                    </span>
                    <span className="a3-cap block">
                      {c.origin === "customer" && c.capturedAt
                        ? t("oppcard.customerEvidence", {
                            date: customerEvidenceDate(
                              c.capturedAt,
                              s.uiLanguage,
                            ),
                          })
                        : c.source}
                    </span>
                  </span>
                ))}
              </div>
              <p className="a3-cap mt-2">
                {tx(
                  "Folge der Wahl: nur der Nenner der Leitkennzahl ändert sich, die Zwischensumme der kalkulierten Positionen bleibt gleich. Der nicht gewählte Kandidat bleibt als Alternative nachvollziehbar.",
                )}
              </p>
              <div className="a3-row mt-3">
                <Button
                  variant="primary"
                  onClick={() => s.resolveWflConflict("customer")}
                >
                  {tx("Kundenwert übernehmen")}
                </Button>
                <Button onClick={() => s.resolveWflConflict("document")}>
                  {tx("Dokumentwert beibehalten")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    s.resolveBuildingConflict(conflict.id, {
                      decision: "defer",
                    })
                  }
                >
                  {tx("Später entscheiden")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="a3-cap mt-2">
              <span aria-hidden="true">✓ </span>
              {tx(
                "Alle Konflikte entschieden. Die nicht gewählte Alternative bleibt im Journal nachvollziehbar.",
              )}
            </p>
          )}
        </section>

        {/* 3 · Offene Fragen & Annahmen — Zusammenführung der früheren
          "· Vorbereitung" P3/P4 (AC7): OPEN QUESTION / SALES RECOMMENDATION /
          RISK explizit unterschieden. Nicht blockierend (D-19, Regel 12) —
          eine Option zu wählen verengt nichts, nur die Bestätigung des
          Kunden. */}
        <section
          ref={questionsSectionRef}
          tabIndex={-1}
          className="a3-sheet mt-6 outline-none"
          aria-label="Offene Fragen & Annahmen"
        >
          <h2 className="text-heading-3 font-bold text-text-primary">
            {openOfThose.length === 1 ? (
              <>
                Diese 1 Frage reduziert die Schätzunsicherheit von ±{NNBSP}
                {p.uncertaintyPp}
                {NNBSP}% auf ±{NNBSP}
                {uncertaintyTarget}
                {NNBSP}%
              </>
            ) : openOfThose.length > 1 ? (
              <>
                Diese {openOfThose.length} Fragen reduzieren die
                Schätzunsicherheit von ±{NNBSP}
                {p.uncertaintyPp}
                {NNBSP}% auf ±{NNBSP}
                {uncertaintyTarget}
                {NNBSP}%
              </>
            ) : (
              <>
                {tx("Alle Fragen beantwortet ·")}
                <EstimateUncertaintyBadge
                  presentation="compact"
                  pp={p.uncertaintyPp}
                />
              </>
            )}
          </h2>
          <p className="a3-cap mt-1">
            {tx(
              "Nach Wirkung sortiert; Verengung in Prozentpunkten. Eine Option zu wählen verengt nichts — nur die Bestätigung des Kunden (D-19).",
            )}
          </p>

          <h3 className="mt-4 text-small font-medium text-text-primary">
            {tx("Offene Fragen")}
          </h3>
          {/* F-36: this list previously mapped over the UNFILTERED `openQuestions`
            (done + open together), while the heading above counted only
            `openOfThose` (undone) — an audited screenshot showed the heading
            naming 2 while 3 rows rendered. The heading, the "Offene Fragen"
            (open questions) label, and the copy-to-clipboard text below all
            already agree on the filtered set; only this render diverged. */}
          <ol className="mt-2">
            {openOfThose.map((q, i) => (
              <li
                key={q.text}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3"
              >
                <span
                  className={
                    "text-body " +
                    (q.done ? "text-text-muted" : "text-text-primary")
                  }
                >
                  {q.done && <span aria-hidden="true">✓ </span>}
                  {i + 1}. {q.text}
                </span>
                <span className="numeric text-body text-text-secondary">
                  −{NNBSP}
                  {q.deltaPp}
                  {NNBSP}Prozentpunkte
                </span>
                {!q.done && q.action && (
                  <Button onClick={q.action}>{tx("Antwort erfassen")}</Button>
                )}
                {!q.done && !q.action && (
                  <Button
                    variant="ghost"
                    onClick={() => focusSection(conflictSectionRef)}
                  >
                    {tx("→ Strittige Angaben")}
                  </Button>
                )}
              </li>
            ))}
          </ol>

          <h3 className="mt-4 text-small font-medium text-text-primary">
            {tx("Risiko")}
          </h3>
          <p className="flex flex-wrap items-center justify-between gap-3 py-3 text-body text-text-primary">
            <span>{tx("Ist ein Baugrundgutachten vorhanden?")}</span>
            <span className="text-body text-text-secondary">
              → Risiko: Baugrund · Wahrscheinlichkeit mittel · Kostenwirkung +
              {NNBSP}4{NNBSP}% auf KG{NNBSP}320
            </span>
          </p>

          <div className="mt-4">
            <Button
              onClick={() => {
                const text = openOfThose
                  .map((q, i) => `${i + 1}. ${q.text}`)
                  .join("\n");
                if (!navigator.clipboard) {
                  setCopyState("error");
                  return;
                }
                navigator.clipboard
                  .writeText(text || "Alle Fragen beantwortet.")
                  .then(
                    () => setCopyState("ok"),
                    () => setCopyState("error"),
                  );
              }}
            >
              {tx("Fragenliste kopieren")}
            </Button>
            <p role="status" aria-live="polite" className="a3-cap mt-2">
              {copyState === "ok" && (
                <>{tx("✓ Fragenliste in die Zwischenablage kopiert")}</>
              )}
              {copyState === "error" && (
                <>
                  {tx(
                    "✗ Kopieren nicht möglich — Zwischenablage in dieser Umgebung nicht verfügbar; Fragen unten manuell markieren",
                  )}
                </>
              )}
            </p>
          </div>

          <h3 className="mt-5 text-small font-medium text-text-primary">
            {tx("Empfehlungen")} · {recommendations.length}
          </h3>
          <p className="a3-cap mt-1">
            {tx(
              "Texte stammen aus den Fallback-Regeln; das Wertfeld (z. B. die Gebäudeklasse) wird mit dem Projektwert belegt — der Regeltext nennt einen Beispielwert. Eine Empfehlung verschwindet, sobald der Wert erfasst ist — die Liste wird abgeleitet, nicht gepflegt.",
            )}
          </p>
          {recommendations.length === 0 && (
            <p className="mt-3 border border-border-default p-4 text-body text-text-secondary">
              {tx(
                "Keine aktiven Empfehlungen. Alle T0-Werte sind erfasst oder bestätigt.",
              )}
            </p>
          )}
          <ul className="mt-3">
            {recommendations.map((a) => (
              <li key={a.id} className="mt-3 border border-border-default p-4">
                <p className="text-body text-text-primary">
                  <span className="font-medium">{tx("Empfehlung:")}</span>{" "}
                  {copyFor(a.text, s.mode)}
                </p>
                <div className="mt-3">
                  {a.resolve ? (
                    <Button onClick={a.resolve}>{a.resolveLabel}</Button>
                  ) : (
                    <Button onClick={() => focusSection(parameterSectionRef)}>
                      {t("configurator.scopeBoundaries.assumptionAction", {
                        chapterName: scopeBoundariesChapterName,
                      })}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 4 Projektübersicht + 5 Projekt bestätigen — EIN physischer Abschnitt
          (zwei Einträge im Stufen-Überblick oben zeigen auf denselben
          Anker): konsolidierte Projektwahrheit für BEIDE Gebäude, aus den
          Building Reviews summiert (AC4), niemals aus der rohen
          Fixture/derived-JSON (F-09), plus die eine Stelle, an der die
          Projekt-Baseline bestätigt wird (M-4). Nur Lesen bei den
          Gebäudefakten — Bearbeitung einzelner Fakten gehört zu Building &
          Scope (Task 02). */}
        <section
          ref={parameterSectionRef}
          tabIndex={-1}
          className="a3-sheet a3-project-baseline mt-6 outline-none"
          aria-label="Projektparameter"
        >
          <h2 className="text-heading-3 font-bold text-text-primary">
            {t("oppcard.baseline.title")}
          </h2>
          <p className="a3-sub">{t("oppcard.baseline.intro")}</p>

          <dl
            className="a3-project-baseline-primary-grid"
            aria-label={t("oppcard.baseline.primaryFacts")}
          >
            <Metric
              emphasis="primary"
              label="Gebäude im Projekt"
              value={String(bs.length)}
            />
            <ReviewedWflMetric value={totalWfl} provenance={wflProvenance} />
            <Metric
              emphasis="primary"
              label="Total NUF nach DIN 277"
              value={formatDE(totalNuf, 2)}
              unit="m²"
              provenance={documentProvenance}
            />
            <Metric
              emphasis="primary"
              label="Wohneinheiten"
              value={formatDE(totalUnits)}
              provenance={documentProvenance}
            />
          </dl>

          <div className="a3-project-baseline-breakdown mt-5">
            <h3>{t("oppcard.baseline.bgfBreakdown")}</h3>
            {/* F-09 fix: every row sums an independently reviewed
              buildingReviews fact (D-26: BGF S is documented `Decimal(0)` —
              the derived balcony-share proxy is deliberately not reused as
              DIN 277 BGF S). The old "+160 m² abgeleitet" row read a
              fixture proxy that contradicted the building reviews
              (documented S = 0) instead of this single source of truth.
              AUD-02: the equation now has its underground term (previously
              missing, so "R + S" never actually summed to the total shown
              here) and the total is relabeled "gesamt" to match the same
              wording BuildingScope.tsx already uses for the identical
              cross-checked above+below aggregate — one number, one label,
              on every surface that shows it. */}
            <dl className="a3-project-baseline-equation">
              <Metric
                label="Total BGF (R, oberirdisch)"
                value={formatDE(totalBgfR, 2)}
                unit="m²"
                provenance={documentProvenance}
              />
              <Metric
                operator="+"
                label="Total BGF (S, nicht umschlossen)"
                value={formatDE(totalBgfS, 2)}
                unit="m²"
                provenance={documentProvenance}
              />
              <Metric
                operator="+"
                label="Total BGF (unterirdisch)"
                value={formatDE(totalBgfUG, 2)}
                unit="m²"
                provenance={documentProvenance}
              />
              <Metric
                emphasis="total"
                operator="="
                label="Total BGF (R+S, gesamt)"
                value={formatDE(totalBgfRS, 2)}
                unit="m²"
                provenance={documentProvenance}
              />
            </dl>
          </div>

          <div className="mt-5">
            {/* Rule 39: complex lead metric = €/m² BGF oberirdisch for 2+
              buildings, using ALL buildings the project has (F-05) — not
              only whichever happen to be `included` in an Option's pricing
              scope that does not exist yet at this level. */}
            <p className="text-small text-text-muted">
              {tx("Aktuelle Leitkennzahl")}: {rateLabel(p.leadRate)} ·{" "}
              {tx(
                "Δ-Werte erscheinen nur hier und nie in der Kundenansicht (Regel 11)",
              )}
              .
            </p>
          </div>

          {/* Gebäude einzeln (AC4: BEIDE Gebäude sichtbar, nicht nur die
            Summe) — reine Anzeige, dieselbe Herkunftsdarstellung wie
            Building & Scope (`factPresentation`), keine zweite Kopie davon. */}
          <div className="mt-5 overflow-x-auto">
            <table className="a3-data-table">
              <caption className="sr-only">{tx("Gebäude im Projekt")}</caption>
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <th className="py-2 pr-4 font-medium">{tx("Gebäude")}</th>
                  <th className="numeric py-2 pr-4 text-right font-medium">
                    Total BGF (R)
                  </th>
                  <th className="numeric py-2 pr-4 text-right font-medium">
                    WFL nach WoFlV
                  </th>
                  <th className="numeric py-2 pr-4 text-right font-medium">
                    NUF nach DIN 277
                  </th>
                  <th className="numeric py-2 text-right font-medium">
                    {tx("Wohneinheiten")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bs.map((b) => {
                  const review = s.buildingReviews[b.id];
                  const name = review
                    ? stableName(review, b.stableName)
                    : b.stableName;
                  const cell = (key: "bgfRAbove" | "wfl" | "nuf" | "units") => {
                    const value = review
                      ? effectiveFactValue(review.facts[key])
                      : null;
                    const provenance = review
                      ? factPresentation(review.facts[key], t)
                      : null;
                    return (
                      <td
                        key={key}
                        className="numeric py-2 pr-4 text-right text-text-primary"
                      >
                        {value === null ? (
                          <span className="text-text-secondary">
                            {tx("nicht erfasst")}
                          </span>
                        ) : (
                          <>
                            {formatDE(value, key === "units" ? 0 : 2)}
                            {key !== "units" ? `${NNBSP}m²` : ""}
                          </>
                        )}
                        {provenance && (
                          <span className="mt-1 block">
                            <ProvenanceChip provenance={provenance} />
                          </span>
                        )}
                      </td>
                    );
                  };
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-border-subtle align-top"
                    >
                      <td className="py-2 pr-4 text-text-primary">{name}</td>
                      {cell("bgfRAbove")}
                      {cell("wfl")}
                      {cell("nuf")}
                      {cell("units")}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!s.projectParamsConfirmed && (
            <div className="mt-3">
              <Button
                variant={currentStage === "confirm" ? "primary" : "secondary"}
                onClick={() => {
                  focusConfirmationAfterAction.current = true;
                  s.confirmProjectParams();
                }}
              >
                {tx("Projektparameter bestätigen")}
              </Button>
            </div>
          )}
          {s.projectParamsConfirmed && (
            <div className="mt-3">
              <div
                ref={confirmationStatusRef}
                tabIndex={-1}
                className="a3-project-baseline-confirmed"
              >
                <span aria-hidden="true">✓ </span>
                {t(
                  baselineStale
                    ? "oppcard.baseline.confirmedStale"
                    : "oppcard.baseline.confirmed",
                )}
              </div>
              {baselineStale && (
                <div
                  className="mt-3"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <StaleState
                    action={
                      <Button
                        variant="primary"
                        onClick={() => {
                          focusConfirmationAfterAction.current = true;
                          s.confirmProjectParams();
                        }}
                      >
                        {t("oppcard.baseline.reconfirm")}
                      </Button>
                    }
                  >
                    {t("oppcard.baseline.stale", {
                      changes: baselineChanges
                        .map((change) => tx(change))
                        .join(", "),
                    })}
                  </StaleState>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 6 · Гейт и Options — единственная модель готовности (обзор выше);
          дублирующий двухстрочный чек-лист удалён, остаётся только кнопка +
          её объяснение (AC2). */}
        <section
          ref={optionsSectionRef}
          tabIndex={-1}
          className="a3-sheet mt-6 outline-none"
          aria-label="Opportunity Options"
        >
          <h2 className="text-heading-3 font-bold text-text-primary">
            {tx("Opportunity Options")}
          </h2>
          <div className="mt-3">
            <Button
              variant="primary"
              disabled={!canCreateOptions}
              disabledReason={createOptionDisabledReason}
              onClick={handleCreateOption}
            >
              {tx("Opportunity Option anlegen")}
            </Button>
          </div>

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
      </div>

      {/* Secondary identity/metadata column */}
      <div className="a3-identity sticky top-6 flex flex-col gap-4 mt-8 lg:mt-0">
        {/* REDESIGN R2 (DESIGN-01): the project identity moment. No sourced
            photography exists yet for the fixture projects (same deferred
            follow-up as the landing's card faces, slice 1/9) — the `pano`
            fallback state is the honest, designed identity face today; a real
            panoramic photo for DEMO-0001 slots into the same `state="loaded"`
            prop later without any layout change. No text is overlaid on the
            frame (canonical MediaFrame rule). */}
        {/* REDESIGN R2 "SALES MOMENT 1": pairs with the landing card's face
            via `startContinuityTransition` (motion.ts, View Transition API) —
            the SAME `project-media-${id}` name OpportunityList.tsx sets on
            its card, so the browser morphs one into the other on arrival. */}
        <div style={{ viewTransitionName: `project-media-${meta.id}` }}>
          <MediaFrame ratio="pano" state="fallback" seed={meta.name} alt="" />
        </div>
        <PageHeader
          className="mt-4"
          title={meta.name}
          meta={
            <span className="flex flex-col gap-2">
              <span className="block">
                {meta.city} · {meta.country} · {meta.owner}
              </span>
              <span className="flex items-center gap-2">
                <span className={"a3-tag " + (STAGE_TAG[meta.stage] ?? "")}>
                  {tx(meta.stage)}
                </span>
                {/* Header utility affordance (#16 Part 5/AC-07): the ONLY entry
                    point to Internal Note now. Never rendered client-side — the
                    affordance itself must not exist in presentation mode, not
                    merely open an empty dialog (NOTE-006). */}
                {s.mode !== "praesentation" && (
                  <Button
                    ref={noteButtonRef}
                    variant="ghost"
                    onClick={() => setNoteDialogOpen(true)}
                  >
                    {tx("Interne Notiz")}
                  </Button>
                )}
              </span>
            </span>
          }
        />
        {/* REDESIGN R2 (DESIGN-01/DESIGN-12): identity metrics strip — key
            project-scale numbers get metric-section rank (32px) instead of
            living only inside the Projektgrundlage table below. `totalBgfRS`
            is the SAME AUD-02 single-aggregation-truth value the
            Projektgrundlage equation renders further down this page (not a
            second sum); a value the product does not have is omitted, never
            shown as an invented zero (rule 16). */}
        <dl className="mt-4 flex flex-col gap-y-4">
          <div>
            <dt className="text-caption text-text-secondary">
              {tx("Gebäude")}
            </dt>
            <dd className="numeric text-metric-section font-bold text-text-primary">
              {bs.length}
            </dd>
          </div>
          {totalBgfRS.greaterThan(0) && (
            <div>
              <dt className="text-caption text-text-secondary">
                {tx("BGF (R+S)")}
              </dt>
              <dd className="numeric text-metric-section font-bold text-text-primary">
                {formatDE(totalBgfRS, 0)}
                {NNBSP}m²
              </dd>
            </div>
          )}
          {totalUnits.greaterThan(0) && (
            <div>
              <dt className="text-caption text-text-secondary">
                {tx("Wohneinheiten")}
              </dt>
              <dd className="numeric text-metric-section font-bold text-text-primary">
                {formatDE(totalUnits, 0)}
              </dd>
            </div>
          )}
          {meta.meetingAt && (
            <div>
              <dt className="text-caption text-text-secondary">
                {tx("Termin")}
              </dt>
              <dd className="numeric text-metric-section font-bold text-text-primary">
                {tx(meta.meetingAt)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
