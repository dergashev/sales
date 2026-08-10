import { Decimal } from 'decimal.js'
import catalogJson from '../fixtures/catalog.json'
import type { Catalog } from '../engine/calculate'

/**
 * ЕДИНСТВЕННОЕ место, где каталог ставок превращается из JSON в Decimal.
 *
 * Первая редакция S4 захардкодила те же величины внутри экрана — второй
 * источник правды о ставках, который разошёлся бы с первым при первой же
 * калибровке. Тот же класс дефекта, за который аудит отклонял партии:
 * значение живёт в двух местах, сверяет их только удача.
 */
const D = (s: string) => new Decimal(s)

export const CATALOG: Catalog = {
  kBase: D(catalogJson.kBase.value),
  fS: D(catalogJson.fS),
  costFactors: {
    gebaeudeklasse: Object.fromEntries(
      Object.entries(catalogJson.costFactors.gebaeudeklasse).map(([k, v]) => [k, D(v)]),
    ),
    energiestandard: Object.fromEntries(
      Object.entries(catalogJson.costFactors.energiestandard).map(([k, v]) => [k, D(v)]),
    ),
    gebaeudeform: Object.fromEntries(
      Object.entries(catalogJson.costFactors.gebaeudeform).map(([k, v]) => [k, D(v)]),
    ),
    untergeschoss: {
      vollausbau: D(catalogJson.costFactors.untergeschoss.vollausbau),
      abDecke: D(catalogJson.costFactors.untergeschoss.abDecke),
      tiefgarageZuschlag: D(catalogJson.costFactors.untergeschoss.tiefgarageZuschlag),
      vollausbauMitTiefgarage:
        D(catalogJson.costFactors.untergeschoss.vollausbauMitTiefgarage),
    },
  },
  kgShares: {
    kg500PercentOfBauwerk: D(catalogJson.kgShares.kg500PercentOfBauwerk),
    kg700EchtPercentOfBauwerk: D(catalogJson.kgShares.kg700EchtPercentOfBauwerk),
    vereinfacht: {
      KG_300: D(catalogJson.kgShares.vereinfacht.KG_300),
      KG_400: D(catalogJson.kgShares.vereinfacht.KG_400),
      KG_700: D(catalogJson.kgShares.vereinfacht.KG_700),
    },
    echt: {
      KG_300: D(catalogJson.kgShares.echt.KG_300),
      KG_400: D(catalogJson.kgShares.echt.KG_400),
    },
  },
  regionalFactor: { active: false, value: D(catalogJson.regionalFactor.value) },
}

/**
 * Каталог с состоянием регионального фактора. Сам флаг живёт в хранилище и
 * входит в снапшот оффера (D-15): «почему у прошлого оффера другая цифра»
 * отвечается снапшотом, а не памятью.
 */
export function withRegionalFactor(active: boolean): Catalog {
  return { ...CATALOG, regionalFactor: { ...CATALOG.regionalFactor, active } }
}
