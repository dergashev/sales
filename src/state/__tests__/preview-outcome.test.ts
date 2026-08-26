import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStoreForTests, useStore, translatedChangeLabel, type PriceChange,
} from '../store'
import { CONFIGURATOR_STEP } from '../chapters'
import { ALL_OPTION_GROUPS } from '../../engine/options'
import { translateText } from '../../i18n'

/**
 * Обещанное до клика равно случившемуся после — для КАЖДОГО денежного
 * решения.
 *
 * Прежде превью знало два вида решения, а остальные считали последствие
 * сами. Плитка охвата умножала ставку на площадь АКТИВНОГО здания, тогда
 * как включение применяется ко всем включённым: обещание `+230.000 €`
 * кончалось изменением на `+368.000 €` (сплошное ревью 26, находка 13).
 *
 * Тест перебирает виды решения, а не места на экране: место можно забыть,
 * вид — нет, потому что он объявлен типом `PriceChange`. Как только
 * появится шестой вид, список здесь перестанет быть полным, и это увидит
 * последняя проверка блока.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

/** Действие, которым решение принимается на самом деле. */
const COMMIT: Record<PriceChange['kind'], (c: never) => void> = {
  energiestandard: (c: Extract<PriceChange, { kind: 'energiestandard' }>) =>
    st().setEnergiestandard(c.value),
  untergeschoss: (c: Extract<PriceChange, { kind: 'untergeschoss' }>) =>
    st().setUntergeschoss(c.buildingId, c.value),
  coverage: (c: Extract<PriceChange, { kind: 'coverage' }>) =>
    st().setCoverage(c.group, c.value),
  risiko: (c: Extract<PriceChange, { kind: 'risiko' }>) => st().toggleRisiko(c.id),
  kg700: (c: Extract<PriceChange, { kind: 'kg700' }>) => st().setKg700Mode(c.value),
  kg300: (c: Extract<PriceChange, { kind: 'kg300' }>) =>
    st().setKg300(c.groupId, c.value),
} as never

const CASES: PriceChange[] = [
  { kind: 'energiestandard', value: 'EH_40' },
  { kind: 'untergeschoss', buildingId: 'DEMO-B-A', value: 'ab_decke' },
  { kind: 'coverage', group: 'KG_500', value: 'included' },
  { kind: 'risiko', id: 'RISK-STATIK', active: true },
  { kind: 'kg700', value: 'hoaiAho' },
  { kind: 'kg300', buildingId: 'DEMO-B-A', groupId: 'fassade', value: 'klinker' },
]

describe('обещание до клика равно результату после', () => {
  for (const change of CASES) {
    it(`${change.kind}: итог, подпись и дельта совпадают`, () => {
      const before = st().projection().result.total.exact
      const promised = st().outcomeOf(change)
      // Обещание не пишет ни состояния, ни журнала: превью — не событие.
      expect(st().projection().result.total.exact.equals(before)).toBe(true)
      const journalBefore = st().journal.length

      // AUD-01 (EXP-01/AC-3): hover this exact change first — every
      // COMMIT below is a real fixation and must gate the ghost, not only
      // the `coverage` kind the previous "текущего выбора" test already
      // covered. This is the assertion that would have caught `setKg300`/
      // `toggleRisiko`/`setKg700Mode` never clearing `preview` before this
      // ticket — the live browser did, this loop should have.
      st().previewOption(change)
      expect(st().preview).not.toBeNull()

      ;(COMMIT[change.kind] as (c: PriceChange) => void)(change)

      const after = st().projection().result
      expect(after.total.exact.toFixed(2)).toBe(promised.futureTotal.exact.toFixed(2))
      expect(after.totalLabel).toBe(promised.futureLabel)
      expect(after.total.exact.minus(before).toFixed(2))
        .toBe(promised.delta.toFixed(2))
      expect(st().journal.length).toBeGreaterThan(journalBefore)
      expect(st().preview).toBeNull()
    })
  }

  it('KG 200/500/600/800 каталог считается ОДИН раз на проект, а не по зданию (тикет "MAKE ALL KG 200-800 SELECTABLE"; former per-building coverage-rate bug, находка 13, теперь структурно невозможен — эта модель project-scoped, не building-scoped)', () => {
    // Два здания в предложении — то же условие, что вскрыло находку 13 для
    // старого building-scoped `coverageDrivers`. Новая каталожная модель
    // (`scopeCatalog.ts`) не параметризована зданием вовсе, поэтому
    // добавление второго здания не может задвоить её вклад.
    st().toggleBuildingIncluded('DEMO-B-B')
    expect(Object.values(st().included).filter(Boolean).length).toBe(2)
    st().setCoverage('KG_500', 'included')
    st().setScopeCatalogQuantity('surface_parking_spaces', '20')
    const single = st().projection().result.drivers
      .filter((d) => d.key === 'scope_kg500-04_03')
    expect(single.length).toBe(1)
    expect(single[0]!.exact.toFixed(2)).toBe('150000.00')
  })

  it('превью текущего выбора гасит призрак, а не обещает нулевое событие', () => {
    // KG_500 starts `excluded` (binary contract) — previewing the current
    // value must gate the ghost, not `unknown` (no longer a reachable state).
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'excluded' })
    expect(st().preview).toBeNull()
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'included' })
    expect(st().preview).not.toBeNull()
    st().previewOption(null)
    expect(st().preview).toBeNull()
  })

  it('перечень видов решения полон — иначе шестой останется без проверки', () => {
    const kinds = new Set(CASES.map((c) => c.kind))
    expect([...kinds].sort()).toEqual(Object.keys(COMMIT).sort())
  })
})

/**
 * AUD-01 (EXP-01, AC-1/AC-2/AC-3): `s.preview` must clear on EVERY trigger
 * the audit named — fixation, blur, option switch, chapter/route change —
 * not only the two already covered before this ticket (fixation via each
 * commit action's own `set()`, and hovering the current selection via
 * `previewOption`'s `isCurrent` branch). Store-level, not DOM-level: the
 * defect was in the state machine itself (several transitions never
 * touched `preview` at all), so the state machine is what proves it fixed.
 */
describe('AUD-01: превью гасится на КАЖДОМ заявленном триггере, не только на фиксации', () => {
  const anyChange: PriceChange = { kind: 'coverage', group: 'KG_500', value: 'included' }

  // Option-scoped actions (`createOption`/`openConfiguratorStepAt`/
  // `setPipelineView`) need a real Opportunity → Option context — the raw
  // reset state sits at `level: 'liste'`, where `canCreateOptions()` is
  // false and these are no-ops. Same setup `store.test.ts` already uses.
  beforeEach(() => {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Basis')
    st().openOption('OPT-01')
  })

  it('смена главы конфигуратора (openConfiguratorStepAt) гасит превью', () => {
    st().previewOption(anyChange)
    expect(st().preview).not.toBeNull()
    st().openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
    expect(st().preview).toBeNull()
  })

  it('смена pipelineView / маршрута (setPipelineView) гасит превью', () => {
    st().previewOption(anyChange)
    expect(st().preview).not.toBeNull()
    st().setPipelineView('vergleich')
    expect(st().preview).toBeNull()
  })

  it('переключение на другую Option (openOption) гасит превью прежней Option', () => {
    st().createOption('Zweite Option') // activeOptionId now OPT-02
    st().previewOption(anyChange)
    expect(st().preview).not.toBeNull()
    st().openOption('OPT-01')
    expect(st().preview).toBeNull()
  })

  it('undo СОЗДАНИЯ Option гасит превью (не только сам первичный свитч)', () => {
    st().createOption('Zweite Option')
    const createdSeq = st().journal.at(-1)!.seq
    st().previewOption(anyChange)
    expect(st().preview).not.toBeNull()
    st().undoEvent(createdSeq)
    expect(st().preview).toBeNull()
  })

  it('redo (отмена отмены) СОЗДАНИЯ Option ТОЖЕ гасит превью — прежде этот путь не проходил через NO_TRANSIENT вовсе', () => {
    st().createOption('Zweite Option')
    const createdSeq = st().journal.at(-1)!.seq
    st().undoEvent(createdSeq)
    const undoSeq = st().journal.at(-1)!.seq
    st().previewOption(anyChange)
    expect(st().preview).not.toBeNull()
    st().undoEvent(undoSeq) // inverse of the 'undo' event === original forward() === redo
    expect(st().preview).toBeNull()
  })

  it('hover текущего выбранного значения не оставляет ПРЕДЫДУЩИЙ (чужой) призрак стоять (AC-2)', () => {
    // Сначала реальное превью — hover ЧУЖОГО (не текущего) значения.
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'included' })
    expect(st().preview).not.toBeNull()
    // KG_500 стартует excluded (двоичный контракт) — hover ТЕКУЩЕГО
    // значения обязан погасить только что показанный чужой призрак, а не
    // оставить его висеть.
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'excluded' })
    expect(st().preview).toBeNull()
  })
})

/**
 * AUD-01 (EXP-02, AC-4): `changeLabel`/`translatedChangeLabel` — единственный
 * общий источник подписи для слота превью, дельта-чипа и SB-17-анонсера —
 * никогда не отдаёт сырой `groupId`/`value`. Раньше `kind: 'kg300'` делал
 * это безусловно (`${groupId} · ${value}`); теперь он читает тот же
 * каталог (`ALL_OPTION_GROUPS`), что и сама карточка опции для своего
 * собственного заголовка.
 */
describe('AUD-01: подпись превью/чипа — человеческая, не сырой id (EXP-02, AC-4)', () => {
  const identityT = (key: string) => key
  const identityTx = (deText: string) => deText

  it('пример из аудита ("fassade · mixedTimber") теперь — тот же человеческий текст, что на карточке', () => {
    const change: PriceChange = {
      kind: 'kg300', buildingId: 'DEMO-B-A', groupId: 'fassade', value: 'mixedTimber',
    }
    expect(translatedChangeLabel(change, identityT, identityTx))
      .toBe('Fassade · Putz im EG, Holz ab 1.OG')
    // EN: тот же tx()-мост, что уже применяет `OptionChapter.tsx` к
    // `c.label` для самой карточки — не новый словарь, тот же самый.
    const enTx = (deText: string) => translateText(deText, 'en')
    expect(translatedChangeLabel(change, identityT, enTx))
      .toBe('Façade · Render on the ground floor, timber above')
  })

  it('AC-4: ни один выбор ЛЮБОЙ KG300/KG400/Zertifikate-группы не отдаёт "groupId · value" (полный обход каталога)', () => {
    expect(ALL_OPTION_GROUPS.length).toBeGreaterThan(0)
    for (const group of ALL_OPTION_GROUPS) {
      for (const choice of group.choices) {
        const change: PriceChange = {
          kind: 'kg300', buildingId: 'DEMO-B-A', groupId: group.id, value: choice.value,
        }
        const label = translatedChangeLabel(change, identityT, identityTx)
        expect(label).not.toBe(`${group.id} · ${choice.value}`)
        expect(label).toBe(`${group.label} · ${choice.label}`)
      }
    }
  })

  it('неизвестный groupId/value (каталог не нашёл записи) остаётся защитным raw-фолбэком, не падает', () => {
    const change: PriceChange = {
      kind: 'kg300', buildingId: 'DEMO-B-A', groupId: 'no-such-group', value: 'no-such-value',
    }
    expect(translatedChangeLabel(change, identityT, identityTx)).toBe('no-such-group · no-such-value')
  })
})
