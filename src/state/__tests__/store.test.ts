import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  activeBuilding, chapterDone, projectionForOption,
  __resetStoreForTests, useStore, wflConflict, scopeBoundariesStatus,
} from '../store'
import { KG400_GROUPS, choiceBlocked } from '../../engine/options'
import type { JournalEvent, OfferSnapshot } from '../store'

/**
 * Проекция обязана воспроизводить мокап S3 из `screen-map.md` до цента.
 *
 * Мокап — не иллюстрация, а спесимен: его числа взяты из фикстуры и
 * пересчитаны аудиторами. Расхождение экрана с мокапом означает, что либо
 * экран врёт, либо мокап устарел, — и то и другое дефект.
 */

beforeEach(() => __resetStoreForTests())

/**
 * Scope Boundaries: умолчание покрытия (Product Decision Brief, тикет
 * 627d3191, одобрено CPO, дословно): «no KG is pre-selected as included,
 * including 300/400/700» — все шесть решаемых групп (KG 200/300/400/500/
 * 600/700) начинаются `unknown` («noch offen»), ни одна не предрешена.
 * KG 100/800 вне перечня Scope Boundaries и остаются `notApplicable`.
 *
 * `ChapterUmfang` (`S3Konfigurator.tsx`, тикет d21f8d48) делает `decidable`
 * три из шести — KG 200/500/600 — через тот же трёхпозиционный
 * RadioCardGroup (D-18). KG 300/400/700 показаны канонической плиткой
 * CheckboxCard в состоянии `mandatory` (components-core.md §CheckboxCard,
 * OPTION-002/OPTION-005): зафиксированы, не `disabled`, снятие выбора
 * невозможно — Product Decision Brief этого тикета одобрил именно это
 * решение, а не разрешил их деактивацию. KG 100/800 вне шести карт этого
 * экрана вовсе и остаются `notApplicable`.
 */
describe('Scope Boundaries: покрытие по умолчанию (ticket 627d3191)', () => {
  it('все шесть решаемых групп начинаются `unknown`, ни одна не предрешена', () => {
    const coverage = useStore.getState().coverage
    expect(coverage.KG_200).toBe('unknown')
    expect(coverage.KG_300).toBe('unknown')
    expect(coverage.KG_400).toBe('unknown')
    expect(coverage.KG_500).toBe('unknown')
    expect(coverage.KG_600).toBe('unknown')
    expect(coverage.KG_700).toBe('unknown')
  })

  it('KG 100/800 вне перечня Scope Boundaries остаются `notApplicable`', () => {
    const coverage = useStore.getState().coverage
    expect(coverage.KG_100).toBe('notApplicable')
    expect(coverage.KG_800).toBe('notApplicable')
  })

  it('свежий проект держит промежуточный итог, пока не решена ни одна группа', () => {
    const p = useStore.getState().projection()
    expect(p.result.completeness).toBe('incomplete')
    expect(p.result.totalLabel).toBe('Zwischensumme der kalkulierten Positionen')
    const codes = p.result.incompleteReasons.map((r) => r.code)
    expect(codes).toContain('coverageUnknown')
  })
})

/**
 * Leistungsabgrenzung (Scope Boundaries, тикет d21f8d48): подтверждение и
 * его инвалидация. Требование #6 тикета — изменение после подтверждения
 * должно инвалидировать/направлять на повторную проверку, а не тихо
 * сохранять устаревшее решение.
 */
describe('Leistungsabgrenzung: подтверждение и инвалидация (ticket d21f8d48)', () => {
  it('начинается `open`, `confirmScopeBoundaries` переводит в `confirmed`', () => {
    const st = () => useStore.getState()
    expect(scopeBoundariesStatus(st())).toBe('open')
    st().confirmScopeBoundaries()
    expect(scopeBoundariesStatus(st())).toBe('confirmed')
  })

  it('изменение KG 200/500/600 после подтверждения переводит в `recheck`', () => {
    const st = () => useStore.getState()
    st().confirmScopeBoundaries()
    expect(scopeBoundariesStatus(st())).toBe('confirmed')
    st().setCoverage('KG_500', 'excluded')
    expect(scopeBoundariesStatus(st())).toBe('recheck')
  })

  it('изменение Energiestandard nach Bestätigung ist ebenfalls eine Änderung', () => {
    const st = () => useStore.getState()
    st().confirmScopeBoundaries()
    st().setEnergiestandard('EH_40')
    expect(scopeBoundariesStatus(st())).toBe('recheck')
  })

  it('erneutes Bestätigen nach `recheck` fixiert den neuen Stand wieder als `confirmed`', () => {
    const st = () => useStore.getState()
    st().confirmScopeBoundaries()
    st().setCoverage('KG_600', 'included')
    expect(scopeBoundariesStatus(st())).toBe('recheck')
    st().confirmScopeBoundaries()
    expect(scopeBoundariesStatus(st())).toBe('confirmed')
  })

  it('KG 300/400/700 sind nicht Teil des Fingerprints — sie sind nicht entscheidbar', () => {
    // Diese drei haben in ChapterUmfang keine interaktive Kontrolle
    // (CheckboxCard `mandatory`); ein Store-seitiger `setCoverage` auf sie
    // darf die Bestätigung trotzdem nicht unbemerkt entwerten, sonst würde
    // ein Pfad existieren, den die UI gar nicht anbietet.
    const st = () => useStore.getState()
    st().confirmScopeBoundaries()
    st().setCoverage('KG_300', 'included')
    expect(scopeBoundariesStatus(st())).toBe('confirmed')
  })

  /**
   * Tech Review P0 (ticket d21f8d48, commit 2871a63): `setEnergiestandard`
   * only ever wrote the active building, even in SHARED mode, while
   * Leistungsabgrenzung shows "gilt für den gesamten Komplex" with no
   * building tabs — a live demo would silently price a mixed-standard
   * complex under one displayed standard.
   */
  it('SHARED-Modus: Energiestandard gilt für ALLE einbezogenen Gebäude', () => {
    const st = () => useStore.getState()
    st().resolveWflConflict('customer')
    st().confirmBuilding('DEMO-B-A')
    st().toggleBuildingIncluded('DEMO-B-B')
    st().confirmBuilding('DEMO-B-B')
    st().confirmConfigurationMode('SHARED')
    st().setActiveBuilding('DEMO-B-A')

    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_55')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_55')
    const beforeTotal = st().projection().result.total.exact

    st().setEnergiestandard('EH_40')

    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_40')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_40')
    expect(st().projection().result.total.exact.equals(beforeTotal)).toBe(false)

    // Undo restores BOTH buildings, not just the one that was active.
    st().undo()
    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_55')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_55')
  })

  it('SHARED-Modus: unterschiedliche Vorwerte werden je Gebäude korrekt zurückgesetzt (undo)', () => {
    const st = () => useStore.getState()
    st().resolveWflConflict('customer')
    st().confirmBuilding('DEMO-B-A')
    st().toggleBuildingIncluded('DEMO-B-B')
    st().confirmBuilding('DEMO-B-B')
    // Per-building change BEFORE choosing SHARED mode — the two buildings
    // legitimately start from different values.
    st().setActiveBuilding('DEMO-B-B')
    st().setEnergiestandard('EH_40')
    st().confirmConfigurationMode('SHARED')

    st().setActiveBuilding('DEMO-B-A')
    st().setEnergiestandard('EH_40_NH')
    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_40_NH')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_40_NH')

    st().undo()
    // Each building's OWN prior value is restored, not a single shared one.
    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_55')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_40')
  })

  it('PER_BUILDING-Modus: setEnergiestandard bleibt auf das aktive Gebäude beschränkt', () => {
    const st = () => useStore.getState()
    st().resolveWflConflict('customer')
    st().confirmBuilding('DEMO-B-A')
    st().toggleBuildingIncluded('DEMO-B-B')
    st().confirmBuilding('DEMO-B-B')
    st().confirmConfigurationMode('PER_BUILDING')
    st().setActiveBuilding('DEMO-B-A')

    st().setEnergiestandard('EH_40')
    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_40')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_55')
  })

  /**
   * Tech Review P1 (ticket d21f8d48, commit 2871a63): the fingerprint used
   * to read `activeBuilding()`/`choicesFor(activeBuildingId)` — confirming
   * while looking at Haus A and then changing Haus B's requirement left the
   * confirmation reading "confirmed" again the moment the seller navigated
   * back to Haus A. Invalidation must not be evadable by switching tabs.
   */
  it('PER_BUILDING: Änderung an einem NICHT aktiven Gebäude entwertet die Bestätigung', () => {
    const st = () => useStore.getState()
    st().resolveWflConflict('customer')
    st().confirmBuilding('DEMO-B-A')
    st().toggleBuildingIncluded('DEMO-B-B')
    st().confirmBuilding('DEMO-B-B')
    st().confirmConfigurationMode('PER_BUILDING')

    st().setActiveBuilding('DEMO-B-A')
    st().confirmScopeBoundaries()
    expect(scopeBoundariesStatus(st())).toBe('confirmed')

    st().setActiveBuilding('DEMO-B-B')
    st().setEnergiestandard('EH_40')
    expect(scopeBoundariesStatus(st())).toBe('recheck')

    // The critical assertion: switching back to Haus A must NOT silently
    // read "confirmed" again.
    st().setActiveBuilding('DEMO-B-A')
    expect(scopeBoundariesStatus(st())).toBe('recheck')
  })
})

describe('S3: проекция воспроизводит мокап', () => {
  it('три со-главных героя и вторичная строка', () => {
    const p = useStore.getState().projection()
    expect(p.result.total.prefix + p.result.total.display).toBe('≈3.818.000')
    expect(p.result.totalLabel).toBe('Zwischensumme der kalkulierten Positionen')
    expect(p.leadRate.prefix + p.leadRate.display).toBe('≈2.545')
    expect(p.leadRate.denominatorLabel).toBe('WFL nach WoFlV')
    expect(p.secondaryRateBgf.prefix + p.secondaryRateBgf.display).toBe('≈1.909')
    expect(p.duration.prefix + p.duration.display).toBe('≈7,5 Monate')
    expect(p.duration.completionDate).toBe('2027-11-19')
    expect(p.uncertaintyPp).toBe(22)
  })

  it('je Wohneinheit — точное 238.614,6875, показ ≈ 238.615', () => {
    const p = useStore.getState().projection()
    expect(p.perUnit!.exact.toFixed(4)).toBe('238614.6875')
    expect(p.perUnit!.prefix + p.perUnit!.display).toBe('≈238.615')
    expect(p.perUnit!.denominatorKind).toBe('unitCount')
  })

  it('разбиение по высоте сходится с итогом в точных значениях', () => {
    const p = useStore.getState().projection()
    const sum = p.aboveGround.exact.plus(p.belowGround.exact)
    expect(sum.toFixed(2)).toBe(p.result.total.exact.toFixed(2))
    // Подземная часть — ровно 400 × 1.190, показ равен точному: префикса нет.
    expect(p.belowGround.prefix).toBe('')
    expect(p.aboveGround.prefix).toBe('≈')
  })

  it('строки KG округляются независимо и в сумме дают НЕ итог — это норма', () => {
    const p = useStore.getState().projection()
    const exact = p.kgSplit.KG_300.plus(p.kgSplit.KG_400)
      .plus(p.kgSplit.KG_700 ?? 0)
    expect(exact.toFixed(2)).toBe(p.result.total.exact.toFixed(2))
  })
})

describe('S3: журнал событий как хребет (M-4)', () => {
  it('данные не меняются без события', () => {
    const s = useStore.getState()
    expect(s.journal).toHaveLength(0)
    s.setEnergiestandard('EH_40')
    const after = useStore.getState()
    expect(after.journal).toHaveLength(1)
    // Label format aligned with `setKg300`'s established SHARED-fan-out
    // convention (target value + `appliesTo`, no single "from" value —
    // buildings can have started from different priors) after Tech Review
    // P0 (ticket d21f8d48): the label must name which building(s) it
    // applies to, since it may now be more than one.
    expect(after.journal[0]!.label).toContain('EH 40')
    expect(after.journal[0]!.label).toContain(s.activeBuildingId)
    expect(after.journal[0]!.deltaExact!.toFixed(2)).toBe('97335.00')
  })

  it('дельта одного изменения совпадает с фикстурой', () => {
    useStore.getState().setEnergiestandard('EH_40')
    const p = useStore.getState().projection()
    expect(p.result.total.exact.toFixed(2)).toBe('3915170.00')
  })

  it('undo — обратное СОБЫТИЕ, а не откат состояния', () => {
    const s = useStore.getState()
    s.setEnergiestandard('EH_40')
    useStore.getState().undo()
    const after = useStore.getState()
    // Значение вернулось…
    expect(after.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    // …но история не потеряна: два события, а не ноль.
    expect(after.journal).toHaveLength(2)
    expect(after.journal[1]!.kind).toBe('undo')
    expect(after.journal[1]!.deltaExact!.toFixed(2)).toBe('-97335.00')
  })
})

describe('DC-44: сумма драйверов обязана давать итог — юнит-тест, не намерение', () => {
  it('фикстурная цепочка сходится в точных значениях', () => {
    const p = useStore.getState().projection()
    const labels = p.result.drivers.map((d) => [d.key, d.exact.toFixed(2)])
    expect(labels).toEqual([
      ['basis', '3090000.00'],
      ['gebaeudeklasse_GK_5', '154500.00'],
      ['energiestandard_EH_55', '97335.00'],
      // Подвал и паркинг — два вклада, а не один: слитая ставка 1.190
      // делала `ab_decke` нулём, а `hasParking` — нечитаемым (ревью 26,
      // находки 6 и 7). Сумма прежняя, потому что 1.100 + 90 = 1.190.
      ['untergeschoss_vollausbau', '440000.00'],
      ['tiefgarage_zuschlag', '36000.00'],
    ])
    const sum = p.result.drivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.toFixed(2)).toBe('3817835.00')
    expect(sum.equals(p.result.total.exact)).toBe(true)
  })

  it('с активным Regionalfaktor драйверов пять и сумма снова равна итогу', () => {
    useStore.getState().toggleRegionalfaktor()
    const p = useStore.getState().projection()
    expect(p.result.drivers.map((d) => d.key)).toContain('regionalfaktor')
    const sum = p.result.drivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.equals(p.result.total.exact)).toBe(true)
    expect(p.result.total.exact.toFixed(2)).toBe('4123261.80')
  })
})

describe('Правило 11: вход в презентацию гейтуется блокером', () => {
  it('переключение в praesentation — no-op вне Option и до подтверждения', () => {
    useStore.getState().setMode('praesentation')
    expect(useStore.getState().mode).toBe('intern')

    useStore.getState().openOpportunity('DEMO-0001')
    useStore.getState().resolveWflConflict('customer')
    useStore.getState().confirmProjectParams()
    useStore.getState().createOption('Basis')
    useStore.getState().openOption('OPT-01')

    useStore.getState().setMode('praesentation')
    expect(useStore.getState().mode).toBe('intern')
    useStore.getState().confirmBuilding(useStore.getState().activeBuildingId)
    useStore.getState().setMode('praesentation')
    expect(useStore.getState().mode).toBe('praesentation')
    // Обратно в intern — всегда можно.
    useStore.getState().setMode('intern')
    expect(useStore.getState().mode).toBe('intern')
  })
})

describe('M-4/M-3: обход журнала невозможен по построению, не по соглашению', () => {
  it('ссылки из getState() заморожены: присваивание бросает, состояние цело', () => {
    const s = useStore.getState()
    // Типы не `readonly` намеренно: запрет обеспечен заморозкой в рантайме,
    // а не только системой типов — обойти `as any` можно, замороженный
    // объект обойти нельзя.
    expect(() => { activeBuilding(s).gebaeudeklasse.confirmed = true }).toThrow()
    expect(() => { s.coverage.KG_500 = 'included' }).toThrow()
    const after = useStore.getState()
    expect(activeBuilding(after).gebaeudeklasse.confirmed).toBe(false)
    expect(after.coverage.KG_500).toBe('unknown')
    expect(after.journal).toHaveLength(0)
  })

  it('журнал и undone не дописываются снаружи', () => {
    const s = useStore.getState()
    expect(() => (s.journal as JournalEvent[]).push({
      seq: 99, kind: 'value.edited', label: 'подделка', deltaExact: null,
      at: '2026-08-06T00:00:00.000Z', optionId: null,
    })).toThrow()
    expect(useStore.getState().journal).toHaveLength(0)
  })

  it('снапшот неприкосновенен: ни поле не меняется, ни список не чистится', () => {
    useStore.getState().confirmGebaeudeklasse()
    const snap = useStore.getState().sendOffer('email')
    expect(() => { snap.totalExact = '0.00' }).toThrow()
    expect(() => (useStore.getState().snapshots as OfferSnapshot[]).splice(0, 1)).toThrow()
    const stored = useStore.getState().snapshots[0]!
    expect(stored.totalExact).toBe('3817835.00')
    expect(useStore.getState().snapshots).toHaveLength(1)
  })

  it('сброс состояния недоступен вне тестовой среды по построению', () => {
    // Санкционированный путь работает; production-ветка закрыта проверкой MODE.
    expect(() => __resetStoreForTests()).not.toThrow()
  })
})

describe('Курсор отмены: композиции, которых не было в тестах', () => {
  it('undo → новое событие → undo → undo отменяет три разных события', () => {
    const st = () => useStore.getState()
    st().setEnergiestandard('EH_40')      // seq 1
    st().setUntergeschoss('kein_ug')      // seq 2
    st().undo()                            // seq 3 отменяет 2
    st().toggleRegionalfaktor()            // seq 4
    st().undo()                            // seq 5 отменяет 4
    st().undo()                            // seq 6 отменяет 1
    const s = st()
    const undoOf = s.journal.filter((e) => e.kind === 'undo').map((e) => e.undoOf)
    expect(undoOf).toEqual([2, 4, 1])
    expect(activeBuilding(s).energiestandard).toBe('EH_55')
    expect(activeBuilding(s).untergeschoss).toBe('vollausbau')
    expect(s.regionalfaktorActive).toBe(false)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })

  it('после отмены отмены курсор снова считает событие действующим', () => {
    const st = () => useStore.getState()
    st().setEnergiestandard('EH_40')   // seq 1
    st().undoEvent(1)                   // seq 2 — отмена
    st().undoEvent(2)                   // seq 3 — отмена отмены, EH 40 снова в силе
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3915170.00')
    expect(st().canUndo()).toBe(true)   // прежде здесь было false при живой кнопке
    st().undo()                          // seq 4 — снова отменяет seq 1
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    expect(st().journal[3]!.undoOf).toBe(1)
  })

  it('canUndo и undo() отвечают об одном и том же курсоре', () => {
    const st = () => useStore.getState()
    expect(st().canUndo()).toBe(false)
    st().setEnergiestandard('EH_40')
    expect(st().canUndo()).toBe(true)
    st().undo()
    // Журнал непуст, но отменять больше нечего — кнопка обязана это знать.
    expect(st().journal.length).toBe(2)
    expect(st().canUndo()).toBe(false)
  })
})

describe('DC-29: Undo-тост — производная журнала', () => {
  it('рискованное действие создаёт тост с дельтой и базой', () => {
    useStore.getState().setUntergeschoss('kein_ug')
    const toast = useStore.getState().undoToast!
    expect(toast.seq).toBe(1)
    expect(toast.statusText).toContain('Untergeschoss')
    expect(toast.deltaText).toContain('476.000')
    expect(toast.deltaText).toContain('gegenüber DEMO-VV-0003')
  })

  it('отправка (без inverse) гасит тост: новая голова — stale (CHANGE-006)', () => {
    useStore.getState().confirmGebaeudeklasse()
    useStore.getState().setCoverage('KG_500', 'excluded')
    expect(useStore.getState().undoToast).not.toBeNull()
    useStore.getState().sendOffer('email')
    expect(useStore.getState().undoToast).toBeNull()
  })

  it('отмена отмены — тоже событие: адресный undoEvent умеет редо', () => {
    useStore.getState().setEnergiestandard('EH_40')            // seq 1
    useStore.getState().undoEvent(1)                           // seq 2 (undo)
    let s = useStore.getState()
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    // Тост события отмены существует и снова несёт Rückgängig.
    expect(s.undoToast!.seq).toBe(2)
    useStore.getState().undoEvent(2)                           // seq 3 (redo)
    s = useStore.getState()
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3915170.00')
    expect(s.journal).toHaveLength(3)
    expect(s.journal[2]!.kind).toBe('undo')
    expect(s.journal[2]!.undoOf).toBe(2)
    expect(s.journal[2]!.deltaExact!.toFixed(2)).toBe('97335.00')
  })

  it('уже отменённый seq — no-op: один inverse не применяется дважды', () => {
    useStore.getState().setEnergiestandard('EH_40')
    useStore.getState().undoEvent(1)
    useStore.getState().undoEvent(1)
    const s = useStore.getState()
    expect(s.journal).toHaveLength(2)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })
})

describe('S3: Geist-Vorschau — последствие до клика (DC-28)', () => {
  it('превью считает дельту тем же движком и не пишет в журнал', () => {
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_40' })
    const s = useStore.getState()
    // Та же дельта, что у будущей фиксации: у превью нет своей арифметики.
    expect(s.preview!.deltaExact.toFixed(2)).toBe('97335.00')
    expect(s.journal).toHaveLength(0)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })

  it('уход с опции гасит превью; текущая опция превью не даёт', () => {
    useStore.getState().previewOption({ kind: 'untergeschoss', value: 'kein_ug' })
    expect(useStore.getState().preview!.deltaExact.toFixed(2)).toBe('-476000.00')
    useStore.getState().previewOption(null)
    expect(useStore.getState().preview).toBeNull()
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_55' })
    expect(useStore.getState().preview).toBeNull()
  })

  it('клик гасит превью и начинает волну дельты', () => {
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_40' })
    useStore.getState().setEnergiestandard('EH_40')
    const s = useStore.getState()
    expect(s.preview).toBeNull()
    expect(s.activeDelta!.deltaExact.toFixed(2)).toBe('97335.00')
    expect(s.journal).toHaveLength(1)
  })
})

describe('DC-28: призрак несёт будущее значение, а не только разницу', () => {
  it('превью содержит будущий тотал, дельту, подпись полноты и прогон', () => {
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_40' })
    const pv = useStore.getState().preview!
    expect(pv.futureTotal.exact.toFixed(2)).toBe('3915170.00')
    expect(pv.futureTotal.display).toBe('3.915.000')
    expect(pv.deltaExact.toFixed(2)).toBe('97335.00')
    // Полнота будущего прогона называется: KG 500 остаётся unknown.
    expect(pv.futureLabel).toBe('Zwischensumme der kalkulierten Positionen')
    expect(pv.contextRef).toContain('DEMO-RUN-0009')
    // И по-прежнему ничего не фиксирует.
    expect(useStore.getState().journal).toHaveLength(0)
    expect(useStore.getState().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })
})

describe('DC-44: направление, отнесение и ID вклада', () => {
  it('каждый драйвер несёт уникальный ID и позиции Scope', () => {
    const ds = useStore.getState().projection().result.drivers
    expect(new Set(ds.map((d) => d.key)).size).toBe(ds.length)
    expect(ds.find((d) => d.key === 'basis')!.scopeRefs).toEqual(['KG 300', 'KG 400'])
    expect(ds.find((d) => d.key === 'untergeschoss_vollausbau')!.scopeRefs)
      .toEqual(['UG'])
  })

  it('множитель несёт базу применения и сам множитель — их показывает DC-21', () => {
    const gk = useStore.getState().projection().result
      .drivers.find((d) => d.key === 'gebaeudeklasse_GK_5')!
    expect(gk.basis?.kind).toBe('factor')
    const b = gk.basis as { kind: 'factor'; appliedTo: Decimal; factor: Decimal }
    expect(b.appliedTo.toFixed(2)).toBe('3090000.00')
    expect(b.factor.toFixed(2)).toBe('1.05')
    // База × (множитель − 1) = вклад: у поповера нет своей арифметики.
    expect(b.appliedTo.mul(b.factor.minus(1)).toFixed(2)).toBe(gk.exact.toFixed(2))
  })

  it('экономящий драйвер поддержан симметрично: знак отрицателен, сумма сходится', () => {
    useStore.getState().setUntergeschoss('kein_ug')
    const r = useStore.getState().projection().result
    expect(r.drivers.some((d) => d.key.startsWith('untergeschoss_'))).toBe(false)
    expect(r.drivers.some((d) => d.key === 'tiefgarage_zuschlag')).toBe(false)
    const sum = r.drivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.equals(r.total.exact)).toBe(true)
  })

  it('язык следствий у класса здания, нормативное имя у энергостандарта', () => {
    const ds = useStore.getState().projection().result.drivers
    expect(ds.find((d) => d.key === 'gebaeudeklasse_GK_5')!.label)
      .toContain('Feuerwiderstand und Kapselung')
    expect(ds.find((d) => d.key === 'energiestandard_EH_55')!.label)
      .toBe('Energiestandard EH 55')
  })
})

describe('S3: интервал сужается подтверждением, не выбором опции (D-19)', () => {
  it('выбор энергостандарта интервал не меняет', () => {
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
    useStore.getState().setEnergiestandard('EH_40')
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
  })

  it('подтверждение WFL сужает на 5 Pp, ответ об энергостандарте — ещё на 4', () => {
    useStore.getState().editField('wfl', new Decimal('1560.00'), true)
    expect(useStore.getState().projection().uncertaintyPp).toBe(17)
    useStore.getState().confirmEnergiestandardAnswer()
    expect(useStore.getState().projection().uncertaintyPp).toBe(13)
  })

  it('подтверждение bgfOber интервал НЕ сужает: фикстура Δ не объявляет', () => {
    // Δ для bgfOber фикстурой не задана, и выдумывать её нельзя (R-25).
    useStore.getState().editField('bgfOber', new Decimal('2100.00'), true)
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
  })

  it('правка без подтверждения интервал не сужает', () => {
    useStore.getState().editField('wfl', new Decimal('1560.00'), false)
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
    expect(useStore.getState().fields.wfl.provenance).toBe('manuell erfasst')
  })
})

describe('S3: ворота клиентского вида', () => {
  it('неподтверждённый класс держит итог неполным', () => {
    const p = useStore.getState().projection()
    expect(p.result.completeness).toBe('incomplete')
    expect(p.result.incompleteReasons).toContainEqual({ code: 'gebaeudeklasseUnconfirmed' })
  })

  it('подтверждение снимает свою причину, но KG 500 держит промежуточный итог', () => {
    useStore.getState().confirmGebaeudeklasse()
    const p = useStore.getState().projection()
    expect(p.result.incompleteReasons.map((r) => r.code))
      .not.toContain('gebaeudeklasseUnconfirmed')
    // Покрытие KG 500 неизвестно — итог остаётся промежуточным.
    expect(p.result.completeness).toBe('incomplete')
    expect(p.result.totalLabel).toBe('Zwischensumme der kalkulierten Positionen')
  })

  it('решённые покрытия делают итог полным и названным', () => {
    const st = useStore.getState()
    st.confirmGebaeudeklasse()
    // Scope Boundaries: все шесть решаемых групп начинаются `unknown`
    // (ticket 627d3191, Product Decision Brief) — полнота требует решения по
    // каждой из них, не только по KG 500. `ChapterUmfang` не делает KG
    // 300/400/700 `decidable` сегодня (известное ограничение интерфейса, см.
    // `INITIAL_COVERAGE`), поэтому здесь они решаются напрямую через стор —
    // тем же способом, каким тест уже решает KG 200/500/600.
    st.setCoverage('KG_200', 'excluded')
    st.setCoverage('KG_300', 'included')
    st.setCoverage('KG_400', 'included')
    st.setCoverage('KG_500', 'excluded')
    st.setCoverage('KG_600', 'excluded')
    st.setCoverage('KG_700', 'included')
    const p = useStore.getState().projection()
    expect(p.result.completeness).toBe('complete')
    expect(p.result.totalLabel).toBe('Gesamt netto · Grundleistung All3')
  })
})

describe('S2: конфликт значения и версии документов', () => {
  it('решение конфликта в пользу клиента меняет только знаменатель', () => {
    const before = useStore.getState().projection()
    useStore.getState().resolveWflConflict('customer')
    const after = useStore.getState().projection()
    expect(after.result.total.exact.toFixed(2)).toBe(before.result.total.exact.toFixed(2))
    expect(after.leadRate.prefix + after.leadRate.display).toBe('≈2.447')
    expect(wflConflict(useStore.getState()).state).toBe('resolved')
    // Конфликт закрыт событием, а не молча.
    expect(useStore.getState().journal.some((e) => e.kind === 'conflict.resolved')).toBe(true)
  })

  it('сохранение документного значения — событие; кандидат клиента остаётся альтернативой', () => {
    useStore.getState().resolveWflConflict('document')
    const s = useStore.getState()
    expect(s.fields.wfl.value.toFixed(2)).toBe('1500.00')
    expect(s.fields.wfl.provenance).toBe('vom Kunden bestätigt')
    expect(s.journal.at(-1)!.label).toContain('beibehalten')
    // SOURCE-001: непринятый кандидат хранится, не исчезает.
    const alt = wflConflict(s).candidates.find((c) => c.origin === 'customer')!
    expect(alt.selectionStatus).toBe('alternative')
    expect(alt.value).toBe('1560.00')
  })

  it('отмена разрешения конфликта атомарна: значение, provenance и статус', () => {
    useStore.getState().resolveWflConflict('customer')
    useStore.getState().undo()
    const s = useStore.getState()
    // Восстановлено ВСЁ, что событие меняло, — не только флаг.
    expect(wflConflict(s).state).toBe('open')
    expect(s.fields.wfl.value.toFixed(2)).toBe('1500.00')
    expect(s.fields.wfl.provenance).toBe('aus Dokument')
  })

  it('смена активной версии планов — событие журнала с обеими версиями', () => {
    useStore.getState().activateGrundrisse('V1')
    const e = useStore.getState().journal.at(-1)!
    expect(e.kind).toBe('document.activated')
    expect(e.label).toContain('V1')
    expect(e.label).toContain('V2')
    useStore.getState().undo()
    expect(useStore.getState().activeGrundrisse).toBe('V2')
  })
})


describe('M-4: недостаточно happy-path — курсор отмены и снапшот', () => {
  it('двойной undo отменяет ДВА разных события, третий — no-op', () => {
    useStore.getState().setEnergiestandard('EH_40')
    useStore.getState().setUntergeschoss('kein_ug')
    useStore.getState().undo() // отменяет UG
    useStore.getState().undo() // отменяет EH — не UG второй раз
    const s = useStore.getState()
    expect(activeBuilding(s).untergeschoss).toBe('vollausbau')
    expect(activeBuilding(s).energiestandard).toBe('EH_55')
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    const undos = s.journal.filter((e) => e.kind === 'undo')
    expect(undos).toHaveLength(2)
    expect(undos[0]!.undoOf).not.toBe(undos[1]!.undoOf)
    // Третий undo: отменять нечего — журнал не растёт.
    const len = s.journal.length
    useStore.getState().undo()
    expect(useStore.getState().journal).toHaveLength(len)
  })

  it('setState не экспортируется: данные не меняются мимо журнала', () => {
    // Публичный API хранилища не содержит setState — это проверка
    // конструкции, а не поведения: обходной двери не существует.
    expect((useStore as unknown as { setState?: unknown }).setState).toBeUndefined()
  })

  it('отправка создаёт снапшот с флагом Regionalfaktor и точным итогом', () => {
    useStore.getState().toggleRegionalfaktor()
    // Скидка больше не передаётся аргументом отправки: она часть
    // конфигурации, и снапшот берёт её оттуда же, откуда берёт расчёт.
    // Аргумент позволял отправить одно, а показать другое (находка 14).
    useStore.getState().setDiscount(new Decimal('3'))
    const snap = useStore.getState().sendOffer('email')
    expect(snap.regionalfaktorActive).toBe(true)
    // Итог снапшота — СО скидкой: прежде контрол показывал 3.703.300 €,
    // а снапшот хранил 3.817.835 €.
    expect(snap.totalExact).toBe('3999563.95')
    expect(snap.discountPercent).toBe('3.0')
    const s = useStore.getState()
    expect(s.snapshots).toHaveLength(1)
    expect(s.journal.at(-1)!.kind).toBe('offer.emailed')
    expect(s.journal.at(-1)!.label).toContain(snap.id)
  })
})

describe('Уровень зданий: охват предложения (сценарий п. 6)', () => {
  it('по умолчанию включено одно здание — фикстурный итог не меняется', () => {
    const s = useStore.getState()
    expect(Object.keys(s.buildings)).toHaveLength(2)
    expect(s.included['DEMO-B-A']).toBe(true)
    expect(s.included['DEMO-B-B']).toBe(false)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })

  it('включение второго здания журналируется до запуска калькуляции без дельты', () => {
    useStore.getState().toggleBuildingIncluded('DEMO-B-B')
    const s = useStore.getState()
    // Haus B: 1.200 × 1.545 × 1,05 (Büro) × 1,00 (GK 4) × 1,03 (EH 55), UG нет.
    const expected = new Decimal('1200').mul('1545').mul('1.05').mul('1.03')
    expect(s.projection().result.total.exact.toFixed(2))
      .toBe(new Decimal('3817835').plus(expected).toFixed(2))
    const ev = s.journal.at(-1)!
    expect(ev.label).toContain('DEMO-B-B')
    expect(ev.deltaExact).toBeNull()
  })

  it('последнее включённое здание можно выключить до запуска калькуляции', () => {
    useStore.getState().toggleBuildingIncluded('DEMO-B-A')
    expect(useStore.getState().included['DEMO-B-A']).toBe(false)
    expect(useStore.getState().journal).toHaveLength(1)
    expect(useStore.getState().canBeginConfiguration()).toBe(false)
  })

  it('драйверы двух зданий не смешиваются: ID остаются уникальными', () => {
    useStore.getState().toggleBuildingIncluded('DEMO-B-B')
    const ds = useStore.getState().projection().result.drivers
    expect(new Set(ds.map((d) => d.key)).size).toBe(ds.length)
    expect(ds.some((d) => d.key.startsWith('DEMO-B-A:'))).toBe(true)
    expect(ds.some((d) => d.key.startsWith('DEMO-B-B:'))).toBe(true)
    // Сумма вкладов по-прежнему равна итогу — инвариант не зависит от числа зданий.
    const sum = ds.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.equals(useStore.getState().projection().result.total.exact)).toBe(true)
  })

  it('шаг вниз открыт, только когда подтверждены ВСЕ включённые здания', () => {
    const st = () => useStore.getState()
    expect(st().allBuildingsConfirmed()).toBe(false)
    st().resolveWflConflict('document')
    st().confirmBuilding('DEMO-B-A')
    expect(st().allBuildingsConfirmed()).toBe(true)
    st().toggleBuildingIncluded('DEMO-B-B')
    // Новое здание в предложении — снова не всё подтверждено.
    expect(st().allBuildingsConfirmed()).toBe(false)
    st().confirmBuilding('DEMO-B-B')
    expect(st().allBuildingsConfirmed()).toBe(true)
  })

  it('оси классификации принадлежат зданию, а не проекту (D-11 v2)', () => {
    const st = () => useStore.getState()
    st().setActiveBuilding('DEMO-B-B')
    st().setEnergiestandard('EH_40')
    expect(st().buildings['DEMO-B-B']!.energiestandard).toBe('EH_40')
    // У первого здания стандарт не изменился: правка адресна.
    expect(st().buildings['DEMO-B-A']!.energiestandard).toBe('EH_55')
  })
})


describe('Опции KG 300 (сценарий п. 7 и 8)', () => {
  it('умолчания не меняют фикстурный итог: стандарт стоит ноль', () => {
    // Если бы умолчание несло абсолютную ставку, итог менялся бы самим
    // фактом открытия экрана — и фикстура перестала бы воспроизводиться.
    expect(useStore.getState().projection().result.total.exact.toFixed(2))
      .toBe('3817835.00')
  })

  it('найденное в документации предвыбрано и несёт ссылку на файл (п. 8)', () => {
    const s = useStore.getState()
    expect(s.kg300Provenance['DEMO-B-A']!.egBauweise).toBe('aus Dokument')
    expect(s.kg300Provenance['DEMO-B-A']!.fassade).toBe('Standard')
    expect(s.kg300['DEMO-B-A']!.egBauweise).toBe('holz')
  })

  it('ручное переключение меняет провенанс и пишет дельту', () => {
    useStore.getState().setKg300('egBauweise', 'massiv')
    const s = useStore.getState()
    expect(s.kg300Provenance['DEMO-B-A']!.egBauweise).toBe('manuell erfasst')
    // 2.000 m² BGF R × 65 €/m²
    expect(s.journal.at(-1)!.deltaExact!.toFixed(2)).toBe('130000.00')
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3947835.00')
  })

  it('вклад опции — отдельный драйвер с уникальным ID и scope KG 300', () => {
    useStore.getState().setKg300('fassade', 'klinker')
    const ds = useStore.getState().projection().result.drivers
    const d = ds.find((x) => x.key === 'opt_fassade_klinker')!
    expect(d.exact.toFixed(2)).toBe('220000.00')   // 2.000 × 110
    expect(d.scopeRefs).toEqual(['KG 300'])
    const sum = ds.reduce((a, x) => a.plus(x.exact), new Decimal(0))
    expect(sum.equals(useStore.getState().projection().result.total.exact)).toBe(true)
  })

  it('скрытая группа не участвует в цене: цвет клинкера без клинкера', () => {
    const st = () => useStore.getState()
    st().setKg300('klinkerFarbe', 'weissgrau')
    // Фасад ещё деревянный — цвет клинкера в цену не входит.
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    st().setKg300('fassade', 'klinker')
    // Теперь входит: 2.000 × (110 + 14).
    expect(st().projection().result.total.exact.toFixed(2)).toBe('4065835.00')
  })

  it('отмена возвращает и выбор, и его провенанс', () => {
    const st = () => useStore.getState()
    st().setKg300('garage', 'nein')
    expect(st().kg300Provenance['DEMO-B-A']!.garage).toBe('manuell erfasst')
    st().undo()
    expect(st().kg300['DEMO-B-A']!.garage).toBe('ja')
    expect(st().kg300Provenance['DEMO-B-A']!.garage).toBe('aus Dokument')
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })
})

describe('KG 400, сертификаты и режим KG 700 (сценарий п. 9, 10, 12)', () => {
  it('раздел KG 400 даёт вклад со scope KG 400, а не KG 300', () => {
    useStore.getState().setKg300('kg440', 'erhoeht')
    const d = useStore.getState().projection().result.drivers
      .find((x) => x.key === 'opt_kg440_erhoeht')!
    expect(d.exact.toFixed(2)).toBe('68000.00')   // 2.000 × 34
    expect(d.scopeRefs).toEqual(['KG 400'])
  })

  it('нормативное ограничение сильнее выбора: при GK 5 лифт обязателен', () => {
    const lift = KG400_GROUPS.find((g) => g.id === 'kg460')!
    const nein = lift.choices.find((c) => c.value === 'nein')!
    expect(choiceBlocked(nein, 'GK_5').blocked).toBe(true)
    expect(choiceBlocked(nein, 'GK_5').reason).toMatch(/GK 5/)
    // При меньшем классе тот же выбор доступен.
    expect(choiceBlocked(nein, 'GK_4').blocked).toBe(false)
  })

  it('сертификат — отдельная ось: QNG не следует из энергостандарта', () => {
    const st = () => useStore.getState()
    st().setEnergiestandard('EH_40')
    expect(st().kg300['DEMO-B-A']!.qng).toBe('keins')
    st().setKg300('qng', 'plus')
    const d = st().projection().result.drivers.find((x) => x.key === 'opt_qng_plus')!
    expect(d.exact.toFixed(2)).toBe('92000.00')   // 2.000 × 46
  })

  it('All3-режим KG 700 не меняет итог, HOAI+AHO добавляет позицию', () => {
    const st = () => useStore.getState()
    const base = st().projection().result.total.exact
    expect(st().kg700Mode).toBe('vereinfacht')
    // 70/22/8 перераспределяет уже посчитанное — тотал прежний.
    st().setKg700Mode('hoaiAho')
    const after = st().projection().result.total.exact
    expect(after.gt(base)).toBe(true)
    // 12 % от БЛОКА Bauwerk, а не 8,7 % от итога (спецификация §1, D-27).
    // В базовой конфигурации блок и есть итог: групп затрат вне блока нет.
    expect(after.minus(base).toFixed(2)).toBe(base.mul('0.12').toFixed(2))
    const d = st().projection().result.drivers.find((x) => x.key === 'kg700_hoai_aho')!
    expect(d.scopeRefs).toEqual(['KG 700'])
    // Своя позиция — значит НЕ доля блока: иначе она проведена дважды.
    expect(d.block).toBe('separatePosition')
    expect(st().projection().kgSplit.KG_700).toBeUndefined()
    // Сумма драйверов по-прежнему равна итогу.
    const sum = st().projection().result.drivers
      .reduce((a, x) => a.plus(x.exact), new Decimal(0))
    expect(sum.equals(after)).toBe(true)
  })
})

describe('Покрытие групп затрат (сценарий п. 11)', () => {
  it('включение группы ДОБАВЛЯЕТ стоимость: она не входит в базовую ставку', () => {
    const st = () => useStore.getState()
    const before = st().projection().result.total.exact
    st().setCoverage('KG_500', 'included')
    const d = st().projection().result.drivers.find((x) => x.key === 'cov_KG_500')!
    // 8 % от блока Bauwerk (спецификация §1, решение D-27). Прежде здесь
    // стояла производная ставка 115 €/m², дававшая 230.000 € и подменявшая
    // объявленную формулу.
    expect(d.exact.toFixed(2)).toBe('305426.80')
    expect(d.exact.toFixed(2)).toBe(before.mul('0.08').toFixed(2))
    expect(st().projection().result.total.exact.minus(before).toFixed(2))
      .toBe('305426.80')
    // Группа вне блока: она добавляет к итогу, но базой для долей и
    // надбавок не становится.
    expect(d.block).toBe('separatePosition')
  })

  it('исключение группы ничего не отнимает — её и не было в базе', () => {
    const st = () => useStore.getState()
    const before = st().projection().result.total.exact
    st().setCoverage('KG_500', 'excluded')
    expect(st().projection().result.total.exact.equals(before)).toBe(true)
  })

  it('подпись итога становится полной, когда решены ВСЕ пробелы', () => {
    const st = () => useStore.getState()
    // Пока хотя бы одна из шести групп Scope Boundaries «ещё открыта», итог
    // промежуточный — это пробел, не решение (SCOPE-001). KG 300/400/700 не
    // decidable через `ChapterUmfang` сегодня (известное ограничение
    // интерфейса), поэтому решаются напрямую через стор, как и KG 200/500/600.
    expect(st().projection().result.totalLabel)
      .toBe('Zwischensumme der kalkulierten Positionen')
    st().setCoverage('KG_200', 'excluded')
    st().setCoverage('KG_300', 'included')
    st().setCoverage('KG_400', 'included')
    st().setCoverage('KG_500', 'excluded')
    // KG 600 и KG 700 остаются «ещё открыто» — итог всё ещё промежуточный.
    expect(st().projection().result.totalLabel)
      .toBe('Zwischensumme der kalkulierten Positionen')
    st().setCoverage('KG_600', 'excluded')
    st().setCoverage('KG_700', 'included')
    // Класс здания всё ещё не подтверждён — вторая причина неполноты.
    expect(st().projection().result.totalLabel)
      .toBe('Zwischensumme der kalkulierten Positionen')
    st().confirmGebaeudeklasse()
    expect(st().projection().result.totalLabel).toBe('Gesamt netto · Grundleistung All3')
    expect(st().projection().result.completeness).toBe('complete')
  })
})
describe('Настоящая модель Option (ревью № 13, дефект 1)', () => {
  const st = () => useStore.getState()

  /** Путь подготовки: конфликт решён, параметры подтверждены. */
  function prepare() {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
  }

  it('конфигурации Options независимы и переживают переключение', () => {
    prepare()
    st().createOption('Basis')
    st().openOption('OPT-01')
    const totalDefault = st().projection().result.total.exact
    st().setKg300('balkone', 'nein')
    const totalA = st().projection().result.total.exact
    expect(totalA.equals(totalDefault)).toBe(false)

    // Вторая Option создаётся с карточки — уровень Opportunity.
    st().openOpportunity('DEMO-0001')
    st().createOption('Ohne Balkone… nein, mit')
    st().openOption('OPT-02')
    // Свежая конфигурация: выбор по умолчанию, не выбор OPT-01.
    expect(st().kg300[st().activeBuildingId]!['balkone']).not.toBe('nein')
    expect(st().projection().result.total.exact.equals(totalDefault)).toBe(true)

    // Возврат в OPT-01: её выбор жив.
    st().openOption('OPT-01')
    expect(st().kg300[st().activeBuildingId]!['balkone']).toBe('nein')
    expect(st().projection().result.total.exact.equals(totalA)).toBe(true)
  })

  it('projectionForOption считает НЕАКТИВНУЮ Option из её конфигурации', () => {
    prepare()
    st().createOption('Basis')
    st().openOption('OPT-01')
    st().setKg300('balkone', 'nein')
    const totalA = st().projection().result.total.exact
    st().openOpportunity('DEMO-0001')
    st().createOption('Variante B')
    st().openOption('OPT-02')
    // Активна OPT-02, но проекция OPT-01 доступна и равна её живому итогу.
    const pA = projectionForOption(st(), 'OPT-01')!
    expect(pA.result.total.exact.equals(totalA)).toBe(true)
    // Несуществующая Option — null, а не выдуманная проекция.
    expect(projectionForOption(st(), 'OPT-99')).toBeNull()
  })

  it('курсор Undo не пересекает границу Option', () => {
    prepare()
    st().createOption('Basis')
    st().openOption('OPT-01')
    st().setKg300('balkone', 'nein')
    expect(st().canUndo()).toBe(true)

    st().openOpportunity('DEMO-0001')
    st().createOption('B')
    st().openOption('OPT-02')
    // В OPT-02 своих событий нет — отменять нечего, и undo() — no-op.
    expect(st().canUndo()).toBe(false)
    const journalLen = st().journal.length
    st().undo()
    expect(st().journal.length).toBe(journalLen)

    // Вернувшись в OPT-01 — отмена доступна и действует на её данные.
    st().openOption('OPT-01')
    expect(st().canUndo()).toBe(true)
    st().undo()
    expect(st().kg300[st().activeBuildingId]!['balkone']).not.toBe('nein')
  })

  it('новая Option наследует подтверждённый на подготовке WFL', () => {
    prepare()
    st().createOption('Basis')
    st().openOption('OPT-01')
    expect(st().fields.wfl.provenance).toBe('vom Kunden bestätigt')
    // Наследование — из состояния конфликта: интервал уже сужен на 5 Pp.
    expect(st().projection().uncertaintyPp).toBe(17)
  })

  it('новая Option начинается перед конфигуратором и без ложного chapter done', () => {
    prepare()
    st().createOption('Basis')
    st().openOption('OPT-01')
    expect(st().openChapter).toBe(1)
    expect(st().besuchteKapitel).toEqual([])
    expect(st().pipelineView).toBe('buildingScope')
    // Der Konfigurator wurde noch nicht geöffnet.
    expect(chapterDone(st(), 1)).toBe(false)
    expect(chapterDone(st(), 2)).toBe(false)
    st().confirmBuilding(st().activeBuildingId)
    expect(st().canBeginConfiguration()).toBe(true)
    expect(chapterDone(st(), 1)).toBe(false)
    st().setPipelineView('konfigurator')
    expect(st().configurationModeChosen).toBe(false)
    expect(chapterDone(st(), 1)).toBe(false)
    st().confirmConfigurationMode('PER_BUILDING')
    expect(chapterDone(st(), 1)).toBe(true)
    // Глава 7 — глава данных (партия 3): посещение проходит её,
    // непосещённая — не пройдена.
    expect(chapterDone(st(), 7)).toBe(false)
    st().openChapterAt(7)
    expect(chapterDone(st(), 7)).toBe(true)
  })

  it('снапшот называет отправленную Option (M-3)', () => {
    prepare()
    st().createOption('Basis')
    st().openOption('OPT-01')
    const snap = st().sendOffer('email')
    expect(snap.optionId).toBe('OPT-01')
    expect(snap.optionName).toBe('Basis')
  })

  it('инвариант хранилища: ключа активной Option в optionConfigs нет', () => {
    prepare()
    st().createOption('A')
    st().openOption('OPT-01')
    st().openOpportunity('DEMO-0001')
    st().createOption('B')
    st().openOption('OPT-02')
    expect(Object.keys(st().optionConfigs)).toEqual(['OPT-01'])
    st().openOption('OPT-01')
    expect(Object.keys(st().optionConfigs)).toEqual(['OPT-02'])
  })
})

describe('Происхождение вкладов: корзина показывает решения (приёмка № 17)', () => {
  const st = () => useStore.getState()

  it('база и подтверждаемые факты решениями не считаются', () => {
    const byKey = Object.fromEntries(
      st().projection().result.drivers.map((d) => [d.key, d.origin]))
    expect(byKey['basis']).toBe('base')
    // Класс здания СЛЕДУЕТ из этажности и пожарной концепции: его
    // подтверждают, а не выбирают, — в «выбранном» ему не место.
    expect(byKey['gebaeudeklasse_GK_5']).toBe('fact')
    expect(byKey['energiestandard_EH_55']).toBe('decision')
    expect(byKey['untergeschoss_vollausbau']).toBe('decision')
  })

  it('выбор подвала попадает в решения — префиксный фильтр его терял', () => {
    const decisions = () => st().projection().result.drivers
      .filter((d) => d.origin === 'decision').map((d) => d.key)
    expect(decisions()).toContain('untergeschoss_vollausbau')
    st().setUntergeschoss('kein_ug')
    // Решение снято — вклад исчез вместе с ним, сумма изменилась.
    expect(decisions()).not.toContain('untergeschoss_vollausbau')
  })

  it('каждый вклад объявляет происхождение — новый драйвер не проскочит', () => {
    st().toggleRegionalfaktor()
    for (const d of st().projection().result.drivers) {
      expect(['base', 'fact', 'decision'], d.key).toContain(d.origin)
    }
  })
})

describe('Отправленный снапшот устаревает относительно конфигурации (правило 30)', () => {
  const st = () => useStore.getState()

  it('журнал позволяет посчитать ценовые изменения ПОСЛЕ отправки', () => {
    st().confirmGebaeudeklasse()
    const snap = st().sendOffer('email')
    const after = () => st().journal.filter(
      (e) => e.seq > snap.journalSeqAt && e.deltaExact !== null).length
    // Сразу после отправки расхождения нет: снимок равен состоянию.
    expect(after()).toBe(0)
    st().setEnergiestandard('EH_40')
    // Теперь клиент видит снимок, а продавец — другое число: это stale,
    // и он обязан быть видимым, а не подразумеваемым.
    expect(after()).toBe(1)
    expect(snap.totalExact).toBe('3817835.00')
    expect(st().projection().result.total.exact.toFixed(2)).not.toBe(snap.totalExact)
  })
})

describe('Охват показа DC-46: сужает показ, но не состав оффера (правило 38)', () => {
  const st = () => useStore.getState()

  it('переключение охвата меняет числа, но не включённость зданий', () => {
    st().toggleBuildingIncluded('DEMO-B-B')
    const komplex = st().projection().result.total.exact
    const included = { ...st().included }

    st().setConfigurationScope('DEMO-B-A')
    const hausA = st().projection().result.total.exact
    // Показ сузился: комплекс дороже одного здания.
    expect(hausA.lt(komplex)).toBe(true)
    // Состав предложения НЕ тронут: охват — не коммерческое решение.
    expect(st().included).toEqual(included)

    st().setConfigurationScope(null)
    expect(st().projection().result.total.exact.equals(komplex)).toBe(true)
  })

  it('исключённое здание нельзя сделать видимым охватом', () => {
    st().setConfigurationScope('DEMO-B-B')
    expect(st().scopeBuildingId).toBeNull()
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })

  it('охват принадлежит Option: у соседней он свой', () => {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('A')
    st().openOption('OPT-01')
    st().setConfigurationScope('DEMO-B-A')
    st().openOpportunity('DEMO-0001')
    st().createOption('B')
    st().openOption('OPT-02')
    expect(st().scopeBuildingId).toBeNull()
    st().openOption('OPT-01')
    expect(st().scopeBuildingId).toBe('DEMO-B-A')
  })

  it('сравнение считает сохранённую Option по всему предложению', () => {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('A')
    st().openOption('OPT-01')
    st().toggleBuildingIncluded('DEMO-B-B')
    const complex = st().projection().result.total.exact
    st().setConfigurationScope('DEMO-B-A')
    expect(st().projection().result.total.exact.lt(complex)).toBe(true)

    st().createOption('B')
    expect(projectionForOption(st(), 'OPT-01')!.result.total.exact.eq(complex)).toBe(true)
  })
})
