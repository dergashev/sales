import { createStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import { withRegionalFactor } from './catalog'
import {
  calculateBuilding, kgSplitVereinfacht,
  type BuildingInput, type Coverage, type CoverageState,
  type CostGroup, type BuildingResult,
} from '../engine/calculate'
import { present, rate, type Rate } from '../engine/money'
import { modelDuration, presentDuration, type DurationDisplay } from '../engine/schedule'

/**
 * Состояние = журнал событий + проекция (M-4).
 *
 * Данные не могут измениться без события — и это обеспечено КОНСТРУКЦИЕЙ,
 * а не соглашением. Первая редакция экспортировала zustand-hook целиком,
 * и его публичный `setState` менял расчётное состояние при пустом журнале;
 * независимый аудит показал это одним вызовом. Теперь сырой store живёт в
 * замыкании модуля: наружу выходят только хук чтения, `getState` и
 * санкционированные действия. Тестовый сброс — именованная функция, а не
 * общий сеттер.
 *
 * Undo — обратное СОБЫТИЕ с курсором. Прежняя реализация всегда брала
 * последнее не-undo событие, поэтому повторная отмена дважды применяла один
 * inverse. Курсор — список уже отменённых seq: каждое событие отменяется
 * не более одного раза, история не теряется.
 */

const D = (s: string) => new Decimal(s)

export type EventKind =
  | 'value.edited' | 'value.confirmed'
  | 'option.selected' | 'coverage.changed'
  | 'document.activated' | 'conflict.resolved'
  | 'offer.emailed' | 'offer.printed'
  | 'undo'

export type JournalEvent = {
  seq: number
  kind: EventKind
  /** Человекочитаемая подпись — она же строка журнала сессии. */
  label: string
  /** Точная денежная дельта события. Null, если событие не меняет цену. */
  deltaExact: Decimal | null
  at: string
  /** Какое событие отменено (только у kind='undo'). */
  undoOf?: number
  /** Обратное применение. Обязано восстанавливать ВСЁ, что событие меняло. */
  inverse?: () => void
}

export type Provenance =
  | 'aus Dokument' | 'vom Kunden bestätigt' | 'abgeleitet' | 'manuell erfasst'

export type FieldState = { value: Decimal; provenance: Provenance }

/**
 * Конфликт значения одного слота — по фикстуре DEMO-CONF-0001.
 * Непринятый кандидат остаётся альтернативой, не исчезает (SOURCE-001).
 */
export type ConflictCandidate = {
  origin: 'document' | 'customer'
  value: string
  selectionStatus: 'authoritative' | 'alternative'
  source: string
}

export type WflConflict = {
  id: string
  state: 'open' | 'resolved'
  candidates: ConflictCandidate[]
}

/**
 * Снапшот отправленного оффера (M-3, минимум прототипа): состояние,
 * от которого клиент получил числа, воспроизводимо из самого снапшота,
 * а не из памяти. Флаг Regionalfaktor входит сюда по D-15.
 */
export type OfferSnapshot = {
  id: string
  at: string
  kind: 'email' | 'print'
  totalExact: string
  totalLabel: string
  uncertaintyPp: number
  regionalfaktorActive: boolean
  coverage: Coverage
  discountPercent: string | null
  journalSeqAt: number
}

/** Покрытие фикстуры: KG 500 неизвестно — именно поэтому итог промежуточный. */
const INITIAL_COVERAGE: Coverage = {
  KG_100: 'notApplicable', KG_200: 'excluded',
  KG_300: 'included', KG_400: 'included', KG_500: 'unknown',
  KG_600: 'notApplicable', KG_700: 'included', KG_800: 'notApplicable',
}

const fx = demo.buildings[0]!
const fxConflict = demo.conflicts[0]!

const INITIAL_BUILDING: BuildingInput = {
  id: fx.id, gebaeudeform: 'MFH',
  gebaeudeklasse: { value: 'GK_5', confirmed: false },
  energiestandard: 'EH_55',
  bgfAboveGround: D(fx.areas.bgfAboveGround!),
  bgfBelowGround: D(fx.areas.bgfBelowGround!),
  untergeschoss: 'vollausbau', hasParking: true,
}

export type Projection = {
  result: BuildingResult
  kgSplit: ReturnType<typeof kgSplitVereinfacht>
  /** Ведущая ставка сегмента (D-11 v2): у Haus A единственный сегмент Wohnen. */
  leadRate: Rate
  secondaryRateBgf: Rate
  perUnit: Rate
  duration: DurationDisplay
  aboveGround: ReturnType<typeof present>
  belowGround: ReturnType<typeof present>
  /** Интервал точности. Сужается ПОДТВЕРЖДЕНИЕМ, не выбором опции (D-19). */
  uncertaintyPp: number
}

type Store = {
  building: BuildingInput
  coverage: Coverage
  fields: { wfl: FieldState; bgfOber: FieldState; we: FieldState }
  journal: JournalEvent[]
  /** seq событий, уже отменённых: каждое отменяется не более одного раза. */
  undone: number[]
  esConfirmed: boolean
  wflConflict: WflConflict
  activeGrundrisse: 'V2' | 'V1'
  /** Regionalfaktor: выключен по умолчанию (D-15); состояние входит в снапшот. */
  regionalfaktorActive: boolean
  snapshots: OfferSnapshot[]
  /** Дельта-чип живёт 4 секунды, потом уезжает в журнал (DC-2). */
  activeDelta: { label: string; deltaExact: Decimal; percent: Decimal } | null
  /**
   * Geist-Vorschau (DC-28): последствие опции у цены ДО клика. Эфемерное
   * UI-состояние вроде `openChapter` — данные не меняются, события нет.
   * Клик фиксирует выбор обычным событием, превью гаснет.
   */
  preview: { label: string; deltaExact: Decimal } | null
  openChapter: number

  projection: () => Projection
  editField: (key: 'wfl' | 'bgfOber' | 'we', value: Decimal, confirmed: boolean) => void
  setEnergiestandard: (v: BuildingInput['energiestandard']) => void
  setUntergeschoss: (v: BuildingInput['untergeschoss']) => void
  setCoverage: (g: CostGroup, s: CoverageState) => void
  confirmGebaeudeklasse: () => void
  confirmEnergiestandardAnswer: () => void
  resolveWflConflict: (candidate: 'document' | 'customer') => void
  activateGrundrisse: (v: 'V2' | 'V1') => void
  toggleRegionalfaktor: () => void
  sendOffer: (kind: 'email' | 'print', discountPercent: string | null) => OfferSnapshot
  clearDelta: () => void
  openChapterAt: (n: number) => void
  /** DC-28: показать последствие опции до клика; null — погасить. */
  previewOption: (
    change:
      | { kind: 'energiestandard'; value: BuildingInput['energiestandard'] }
      | { kind: 'untergeschoss'; value: BuildingInput['untergeschoss'] }
      | null,
  ) => void
  undo: () => void
}

function computeProjection(
  s: Pick<Store, 'building' | 'coverage' | 'fields' | 'esConfirmed' | 'regionalfaktorActive'>,
): Projection {
  const CATALOG = withRegionalFactor(s.regionalfaktorActive)
  const result = calculateBuilding(s.building, CATALOG, s.coverage)
  const total = result.total.exact
  const noUg = calculateBuilding(
    { ...s.building, untergeschoss: 'kein_ug' }, CATALOG, s.coverage,
  )
  const ug = total.minus(noUg.total.exact)

  const duration = presentDuration(
    {
      metricKey: `building:${s.building.id}.execution`,
      kind: 'buildingExecution',
      startDate: '2027-04-04', endDate: '2027-11-19', durationBasis: 'calendarDay',
    },
    modelDuration(s.building.bgfAboveGround, D('1.00'), D('1.15')),
  )

  // Интервал: базовые 22 пункта минус объявленные фикстурой сужения.
  // Фикстура задаёт Δ ровно для двух подтверждений: WFL −5 Pp и
  // Energiestandard −4 Pp (DEMO-SC-02). Δ остальных параметров фикстурой
  // не объявлены, и выдумывать их нельзя (R-25) — подтверждение bgfOber
  // поэтому интервал не сужает, и это честно, а не забыто. Выбор опции
  // не сужает ничего: он не подтверждение (D-19).
  const narrowing =
    (s.fields.wfl.provenance === 'vom Kunden bestätigt' ? 5 : 0) +
    (s.esConfirmed ? 4 : 0)

  return {
    result,
    kgSplit: kgSplitVereinfacht(total),
    leadRate: rate(total, s.fields.wfl.value, 'WFL_WOFLV'),
    secondaryRateBgf: rate(total, s.fields.bgfOber.value, 'BGF_ABOVE_GROUND'),
    perUnit: rate(total, s.fields.we.value, 'WOHNEINHEITEN'),
    duration,
    aboveGround: present(noUg.total.exact),
    belowGround: present(ug),
    uncertaintyPp: 22 - narrowing,
  }
}

// Сырой store — приватный. Наружу не выходит ни он, ни его setState.
const store = createStore<Store>((set, get) => {
  /** Единственная дверь для изменения данных: событие + журнал. */
  const apply = (e: Omit<JournalEvent, 'seq' | 'at'>) => {
    const { journal } = get()
    set({
      journal: [
        ...journal,
        { ...e, seq: journal.length + 1, at: new Date().toISOString() },
      ],
    })
  }

  return {
    building: INITIAL_BUILDING,
    coverage: INITIAL_COVERAGE,
    fields: {
      wfl: { value: D(fx.areas.wflWoFlV!), provenance: 'aus Dokument' },
      bgfOber: { value: D(fx.areas.bgfAboveGround!), provenance: 'aus Dokument' },
      we: { value: D(fx.areas.wohneinheiten!), provenance: 'aus Dokument' },
    },
    journal: [],
    undone: [],
    esConfirmed: false,
    wflConflict: {
      id: fxConflict.id,
      state: 'open',
      candidates: fxConflict.candidates.map((c) => ({
        origin: c.origin as 'document' | 'customer',
        value: c.value,
        selectionStatus: c.selectionStatus as 'authoritative' | 'alternative',
        source: 'source' in c && typeof (c as { source?: unknown }).source === 'string'
          ? (c as { source: string }).source
          : 'VerificationEvent DEMO-VE-0002',
      })),
    },
    activeGrundrisse: 'V2',
    regionalfaktorActive: false,
    snapshots: [],
    activeDelta: null,
    preview: null,
    openChapter: 3,

    projection: () => computeProjection(get()),

    editField: (key, value, confirmed) => {
      const before = get().projection().result.total.exact
      const prev = get().fields[key]
      set((s) => ({
        fields: {
          ...s.fields,
          [key]: {
            value,
            provenance: confirmed ? 'vom Kunden bestätigt' : 'manuell erfasst',
          },
        },
        building: key === 'bgfOber' ? { ...s.building, bgfAboveGround: value } : s.building,
      }))
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: confirmed ? 'value.confirmed' : 'value.edited',
        label: `${LABELS[key]} ${prev.value.toFixed(2)} → ${value.toFixed(2)}`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set((s) => ({
          fields: { ...s.fields, [key]: prev },
          building: key === 'bgfOber'
            ? { ...s.building, bgfAboveGround: prev.value } : s.building,
        })),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: `${LABELS[key]} geändert`,
            deltaExact: delta,
            percent: delta.div(before).mul(100),
          },
        })
      }
    },

    setEnergiestandard: (v) => {
      const s = get()
      if (s.building.energiestandard === v) return
      const before = s.projection().result.total.exact
      const prev = s.building.energiestandard
      set({ building: { ...s.building, energiestandard: v } })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `Energiestandard ${prev.replace('_', ' ')} → ${v.replace('_', ' ')}`,
        deltaExact: delta,
        inverse: () => set((st) => ({ building: { ...st.building, energiestandard: prev } })),
      })
      // Клик — фиксация: превью гаснет, начинается волна дельты (DC-28).
      set({
        preview: null,
        activeDelta: {
          label: `Energiestandard ${prev.replace('_', ' ')} → ${v.replace('_', ' ')}`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    },

    setUntergeschoss: (v) => {
      const s = get()
      if (s.building.untergeschoss === v) return
      const before = s.projection().result.total.exact
      const prev = s.building.untergeschoss
      set({ building: { ...s.building, untergeschoss: v } })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `Untergeschoss ${LABEL_UG[prev]} → ${LABEL_UG[v]}`,
        deltaExact: delta,
        inverse: () => set((st) => ({ building: { ...st.building, untergeschoss: prev } })),
      })
      set({
        preview: null,
        activeDelta: {
          label: `Untergeschoss ${LABEL_UG[v]}`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    },

    setCoverage: (g, st) => {
      const s = get()
      const prev = s.coverage[g]
      if (prev === st) return
      set({ coverage: { ...s.coverage, [g]: st } })
      apply({
        kind: 'coverage.changed',
        label: `${g} ${COVERAGE_LABEL[prev]} → ${COVERAGE_LABEL[st]}`,
        deltaExact: null,
        inverse: () => set((x) => ({ coverage: { ...x.coverage, [g]: prev } })),
      })
    },

    confirmGebaeudeklasse: () => {
      const s = get()
      if (s.building.gebaeudeklasse.confirmed) return
      set({
        building: {
          ...s.building,
          gebaeudeklasse: { ...s.building.gebaeudeklasse, confirmed: true },
        },
      })
      apply({
        kind: 'value.confirmed',
        label: 'Gebäudeklasse nach MBO §2 bestätigt',
        deltaExact: null,
        inverse: () => set((x) => ({
          building: {
            ...x.building,
            gebaeudeklasse: { ...x.building.gebaeudeklasse, confirmed: false },
          },
        })),
      })
    },

    confirmEnergiestandardAnswer: () => {
      if (get().esConfirmed) return
      set({ esConfirmed: true })
      apply({
        kind: 'value.confirmed',
        label: 'Energiestandard vom Kunden bestätigt',
        deltaExact: null,
        inverse: () => set({ esConfirmed: false }),
      })
    },

    /**
     * Разрешение конфликта — ОДНО событие, атомарно обратимое.
     *
     * Первая редакция делала два шага (правка поля + закрытие флага) с двумя
     * событиями, и inverse второго возвращал только флаг: после отмены
     * конфликт снова стоял открытым, а значение оставалось клиентским —
     * состояние, которого никогда не существовало. Отмена обязана
     * восстанавливать ВСЁ, что событие меняло.
     */
    resolveWflConflict: (candidate) => {
      const s = get()
      if (s.wflConflict.state !== 'open') return
      const prevField = s.fields.wfl
      const prevConflict = s.wflConflict

      const nextCandidates: ConflictCandidate[] = s.wflConflict.candidates.map((c) => ({
        ...c,
        selectionStatus:
          (candidate === 'customer') === (c.origin === 'customer')
            ? 'authoritative' : 'alternative',
      }))
      const chosen = nextCandidates.find((c) => c.selectionStatus === 'authoritative')!

      set((x) => ({
        fields: {
          ...x.fields,
          wfl: { value: D(chosen.value), provenance: 'vom Kunden bestätigt' },
        },
        wflConflict: { ...x.wflConflict, state: 'resolved', candidates: nextCandidates },
      }))
      apply({
        kind: 'conflict.resolved',
        label: candidate === 'customer'
          ? 'WFL-Konflikt: Kundenwert 1.560,00 m² übernommen'
          : 'WFL-Konflikt: Dokumentwert 1.500,00 m² beibehalten',
        deltaExact: null,
        inverse: () => set((x) => ({
          fields: { ...x.fields, wfl: prevField },
          wflConflict: prevConflict,
        })),
      })
    },

    activateGrundrisse: (v) => {
      const s = get()
      if (s.activeGrundrisse === v) return
      const prev = s.activeGrundrisse
      set({ activeGrundrisse: v })
      apply({
        kind: 'document.activated',
        label: `Grundrisse: Version ${v} aktiviert (vorher ${prev})`,
        deltaExact: null,
        inverse: () => set({ activeGrundrisse: prev }),
      })
    },

    toggleRegionalfaktor: () => {
      const s = get()
      const before = s.projection().result.total.exact
      const next = !s.regionalfaktorActive
      set({ regionalfaktorActive: next })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `Regionalfaktor Musterland 1,08 ${next ? 'aktiviert' : 'deaktiviert'}`,
        deltaExact: delta,
        inverse: () => set({ regionalfaktorActive: !next }),
      })
      set({
        activeDelta: {
          label: `Regionalfaktor ${next ? 'aktiviert' : 'deaktiviert'}`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    },

    /**
     * Отправка = снапшот + событие (M-3). Снапшот создаётся ДО события,
     * событие ссылается на него; inverse отсутствует намеренно —
     * отправленное неприкосновенно, отменить отправку нельзя.
     */
    sendOffer: (kind, discountPercent) => {
      const s = get()
      const p = s.projection()
      const snap: OfferSnapshot = {
        id: `SNAP-${s.snapshots.length + 1}`,
        at: new Date().toISOString(),
        kind,
        totalExact: p.result.total.exact.toFixed(2),
        totalLabel: p.result.totalLabel,
        uncertaintyPp: p.uncertaintyPp,
        regionalfaktorActive: s.regionalfaktorActive,
        coverage: { ...s.coverage },
        discountPercent,
        journalSeqAt: s.journal.length,
      }
      set({ snapshots: [...s.snapshots, snap] })
      apply({
        kind: kind === 'email' ? 'offer.emailed' : 'offer.printed',
        label: kind === 'email'
          ? `Angebot per E-Mail gesendet · Snapshot ${snap.id}`
          : `Angebot gedruckt · Snapshot ${snap.id}`,
        deltaExact: null,
      })
      return snap
    },

    clearDelta: () => set({ activeDelta: null }),
    openChapterAt: (n) => set({ openChapter: n }),

    previewOption: (change) => {
      if (change === null) {
        if (get().preview !== null) set({ preview: null })
        return
      }
      const s = get()
      const current = s.building[change.kind]
      if (current === change.value) {
        if (s.preview !== null) set({ preview: null })
        return
      }
      // Последствие считается тем же движком от ТОЧНЫХ значений — превью
      // не имеет собственной арифметики, поэтому не может разойтись с кликом.
      const before = computeProjection(s).result.total.exact
      const after = computeProjection({
        ...s,
        building: { ...s.building, [change.kind]: change.value },
      }).result.total.exact
      const label = change.kind === 'energiestandard'
        ? `Energiestandard ${change.value.replace('_', ' ')}`
        : `Untergeschoss ${LABEL_UG[change.value as BuildingInput['untergeschoss']]}`
      set({ preview: { label, deltaExact: after.minus(before) } })
    },

    /**
     * Отмена с курсором: берётся последнее ещё не отменённое событие с
     * inverse; его seq попадает в `undone`, поэтому второй вызов отменяет
     * ПРЕДЫДУЩЕЕ событие, а не то же самое ещё раз.
     */
    undo: () => {
      const { journal, undone } = get()
      const target = [...journal]
        .reverse()
        .find((e) => e.kind !== 'undo' && e.inverse && !undone.includes(e.seq))
      if (!target) return
      target.inverse!()
      set((s) => ({ undone: [...s.undone, target.seq] }))
      apply({
        kind: 'undo',
        label: `Rückgängig: ${target.label}`,
        deltaExact: target.deltaExact ? target.deltaExact.negated() : null,
        undoOf: target.seq,
      })
    },
  }
})

// Снимок начального состояния — для тестового сброса.
const INITIAL_SNAPSHOT = store.getState()

type UseStore = (() => Store) & { getState: () => Store }

/**
 * Наружу — только чтение и действия. `setState` не экспортируется:
 * данные меняются событиями, и другого пути нет по построению.
 */
const hook = (() => useZustandStore(store)) as UseStore
hook.getState = store.getState
export const useStore = hook

/** Тестовый сброс — единственная санкционированная замена состояния целиком. */
export function __resetStoreForTests(): void {
  store.setState(INITIAL_SNAPSHOT, true)
}

const LABELS: Record<'wfl' | 'bgfOber' | 'we', string> = {
  wfl: 'Wohnfläche WFL nach WoFlV',
  bgfOber: 'BGF oberirdisch',
  we: 'Wohneinheiten',
}

const LABEL_UG: Record<BuildingInput['untergeschoss'], string> = {
  kein_ug: 'nicht Bestandteil',
  ab_decke: 'Leistungsbeginn ab OK Decke über UG',
  vollausbau: 'vollständig inkl. Gründung',
}

const COVERAGE_LABEL: Record<CoverageState, string> = {
  included: 'enthalten',
  excluded: 'nicht enthalten',
  onRequest: 'auf Anfrage',
  unknown: 'noch offen',
  notApplicable: 'nicht anwendbar',
}

export { LABEL_UG, COVERAGE_LABEL, LABELS }
