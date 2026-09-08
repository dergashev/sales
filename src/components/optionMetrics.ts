import { useT } from '../i18n'
import type { OptionMetricSummaryLabels } from '../design-system/OptionMetricSummary'

/**
 * The words `OptionMetricSummary` renders, resolved ONCE (B2).
 *
 * The component takes its copy as a prop so the gallery can render it (D-28),
 * which leaves exactly one risk: five product surfaces each assembling the
 * same label object and one of them naming a metric differently. This hook is
 * that object, in one place, so the Option card, the Offer panel, Validate
 * and the cost detail cannot disagree about what a segment is called.
 */
export function useOptionMetricLabels(): OptionMetricSummaryLabels {
  const t = useT()
  return {
    netTotal: t('b2.metric.netTotal'),
    energy: t('b2.metric.energy'),
    baselineSuffix: t('b2.metric.baseline'),
    segment: {
      wfl: t('b2.metric.segment.wfl'),
      nuf: t('b2.metric.segment.nuf'),
    },
    scale: t('b2.metric.scale'),
    notAdditive: t('b2.metric.notAdditive'),
    denominatorUnknown: t('b2.metric.denominatorUnknown'),
    // The canonical rule-16 phrase, from the released key every other
    // surface already prints — never a second wording of it.
    priceNotDetermined: t('money.priceNotDetermined'),
    useProfile: {
      residential: t('b2.metric.useProfile.residential'),
      nonResidential: t('b2.metric.useProfile.nonResidential'),
      mixed: t('b2.metric.useProfile.mixed'),
      unknown: t('b2.metric.useProfile.unknown'),
    },
  }
}
