import { localizeMoneyText, type UiLanguage } from '../i18n'
import type { KgServiceAnswer } from '../engine/kgConfiguration'

/**
 * The ONE sentence of a KG decision's current answer, in the reader's
 * language.
 *
 * `kgServiceAnswer` decides WHAT is chosen and hands back the fixture's own
 * copy where the fixture words it; this resolves the two answers it does not
 * word (`Noch nicht entschieden`, the generic included/not-included pair)
 * against the dictionary, and re-typesets a quantity's numerals for `en`
 * through the product's one money formatter (rule 7/36).
 *
 * It lives beside the screens rather than inside either of them because two
 * surfaces read it — the KG chapter's collapsed decision row and Final
 * Validation's expanded `Leistungen` row — and a second copy would be a
 * second answer the day a phrase changes.
 */
export function kgAnswerText(
  answer: KgServiceAnswer,
  language: UiLanguage,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (answer.kind) {
    case 'undecided': return t('vr3.tga.decision.undecided')
    case 'included': return t('vr3.tga.decision.included')
    case 'notIncluded': return t('vr3.tga.decision.notIncluded')
    case 'stated': return answer.text
    case 'quantity':
      // Grouped, and joined to its unit by rule 7's narrow no-break space.
      return t('vr3.tga.decision.quantityOf', {
        quantity: localizeMoneyText(answer.text, language),
      })
  }
}
