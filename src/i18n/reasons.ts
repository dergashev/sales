import type { IncompleteReason } from '../engine/calculate'
import { NNBSP } from '../engine/money'

/**
 * Человеческий текст причины неполноты (дефект 13 ревью № 13): язык
 * следствий, не кодов. Нормативная ссылка (CALC-004) — только во
 * внутреннем режиме: клиентская поверхность не цитирует реестр (MODE-001).
 */
export function incompleteReasonText(
  r: IncompleteReason,
  mode: 'intern' | 'praesentation',
): string {
  const kg = (groups: string[]) =>
    groups.map((g) => g.replace('_', NNBSP)).join(', ')
  switch (r.code) {
    case 'coverageUnknown':
      return `${kg(r.groups)} — Deckungsentscheidung noch offen`
    case 'includedUnpriced':
      return `${kg(r.groups)} — enthalten, Preis nicht ermittelt`
    case 'openMaterialIssues':
      return r.count === 1
        ? 'Eine wesentliche Frage ist noch offen'
        : `${r.count} wesentliche Fragen sind noch offen`
    case 'gebaeudeklasseUnconfirmed':
      return mode === 'intern'
        ? 'Gebäudeklasse: Prüfung erforderlich (CALC-004)'
        : 'Gebäudeklasse: Prüfung erforderlich'
  }
}
