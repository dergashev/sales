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
      vollausbauMitTiefgarage: D(catalogJson.costFactors.untergeschoss.vollausbauMitTiefgarage),
    },
  },
  regionalFactor: { active: false, value: D(catalogJson.regionalFactor.value) },
}
