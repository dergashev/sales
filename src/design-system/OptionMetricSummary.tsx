import { localizeMoneyText, type UiLanguage } from '../i18n'
import { NNBSP, rateUnit } from '../engine/money'
import { CommercialNumber } from './CommercialNumber'
import { SemanticStatus } from './SemanticStatus'
import type {
  OptionAreaMetric,
  OptionCommercialProjection,
} from '../state/optionCommercialProjection'

/**
 * OptionMetricSummary — what one Option is worth, and per WHICH area
 * (B2, Product Owner requirement 9; navigation-and-blocker-patterns.md
 * "Option metric summary").
 *
 * IT TAKES A PROJECTION, NOT NUMERIC PROPS. That is the whole contract and
 * the reason this component exists rather than a set of fields on five
 * surfaces. The audit's finding was not that a number was wrong: it was that
 * the Option card, the Offer panel, Validate, the cost detail and the client
 * projection each assembled their own commercial summary from whatever they
 * could reach, so four of them could not show WFL or NUF at all and none of
 * them could prove it agreed with the others. A component that accepted
 * `netTotal`, `wflRate`, `nufRate` as separate props would have preserved
 * exactly that: five callers, five chances to pass a rate under the wrong
 * label.
 *
 * `OptionCommercialProjection` carries the result's own `version`, so this
 * component renders the proof of agreement (`data-result-version`) rather
 * than a claim of it.
 *
 * WHAT IT REFUSES TO RENDER.
 *
 * - An unlabeled `€/m²`. Impossible by construction: every figure comes from
 *   a `Rate` whose denominator is TYPED, and the words come from the type.
 * - A blended denominator. Also impossible: the projection has no field that
 *   could hold one (rule 39, R-11, DATA-001).
 * - A zero for an unknown denominator. A segment that applies but has no
 *   area is a NAMED ABSENCE with its norm still spelled out (rule 16).
 * - Two segment metrics presented as parts of one whole. When the Option is
 *   mixed-use the non-additivity is STATED, from the projection's own
 *   `metricsAreAdditive`, not left to each surface to remember.
 */

export type OptionMetricSummaryVariant =
  /** A saved Option's card: the summary is the card's content. */
  | 'card'
  /** The commercial rail and Validate: the summary sits beside its stage. */
  | 'rail'

export type OptionMetricSummaryProps = {
  projection: OptionCommercialProjection
  language: UiLanguage
  variant?: OptionMetricSummaryVariant
  /**
   * The words, from the caller's dictionary. Passed in rather than looked up
   * here for the reason every canonical component in this system takes its
   * copy: a Design System component that reaches into the product's i18n
   * cannot be rendered by the gallery, and a specimen nobody can render is
   * how a contract and a product drift apart (D-28).
   */
  labels: OptionMetricSummaryLabels
  className?: string
}

export type OptionMetricSummaryLabels = {
  /** `Netto` — names the total's own meaning beside the derived scope label. */
  netTotal: string
  energy: string
  /** The word for an axis still standing at its catalogue baseline. */
  baselineSuffix?: string
  /** One entry per metric id the projection can produce. */
  segment: Readonly<Record<string, string>>
  /** `Baumaßstab` — what a scale metric is FOR. */
  scale: string
  /** Stated whenever more than one segment metric is shown. */
  notAdditive: string
  /** `nicht ermittelt` — a denominator that does not exist yet. */
  denominatorUnknown: string
  /**
   * `Preis nicht ermittelt` — no calculated position exists at all, so
   * there is no amount and no rate. The canonical rule-16 phrase, passed in
   * from the product's own dictionary rather than reworded here.
   */
  priceNotDetermined: string
  useProfile: Readonly<Record<string, string>>
}

export function OptionMetricSummary({
  projection, language, variant = 'card', labels, className,
}: OptionMetricSummaryProps) {
  const segments = projection.metrics.filter((m) => m.role === 'segment')
  const scale = projection.metrics.find((m) => m.role === 'scale') ?? null
  const classes = [
    'a3-oms',
    variant === 'rail' ? 'a3-oms-rail' : 'a3-oms-card',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      data-result-version={projection.resultVersion}
      /* So a surface — and a test — can tell "no price yet" from "a price"
         without parsing the words. */
      data-price={projection.priceDetermined ? 'determined' : 'notDetermined'}
    >
      <div className="a3-oms-total">
        {/* An Option with no calculated position has no amount. Rendering
            `netTotal` here would print `0 €` for every fresh Option, which
            rule 16 forbids outright — the zero is the ABSENCE of a price,
            not a price of nothing. `priceDetermined` carries the released
            convention so this component does not re-derive it. */}
        <CommercialNumber
          exact={projection.priceDetermined ? projection.netTotal.exact : null}
          displayed={projection.priceDetermined ? projection.netTotal : undefined}
          absentLabel={labels.priceNotDetermined}
          language={language}
          emphasis="default"
          className="a3-oms-total-value"
        />
        {/* The label is DERIVED from coverage by the result (R-18): a partial
            offer says `Zwischensumme der kalkulierten Positionen` and never
            the word `Gesamt`. This component prints what it is given. */}
        <span className="a3-oms-total-label">
          {labels.netTotal}
          {NNBSP}
          ·
          {NNBSP}
          {projection.totalLabel}
        </span>
      </div>

      <dl className="a3-oms-facts">
        {projection.energy ? (
          <div className="a3-oms-fact">
            <dt className="a3-oms-fact-k">{labels.energy}</dt>
            <dd className="a3-oms-fact-v">
              {language === 'en'
                ? projection.energy.variantLabelEn
                : projection.energy.variantLabelDe}
              {projection.energy.isBaseline && labels.baselineSuffix ? (
                <span className="a3-oms-fact-note">
                  {NNBSP}
                  ·
                  {NNBSP}
                  {labels.baselineSuffix}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}

        {segments.map((metric) => (
          <MetricFact
            key={metric.id}
            metric={metric}
            language={language}
            label={labels.segment[metric.id] ?? ''}
          />
        ))}

        {projection.gaps.map((gap) => (
          <div className="a3-oms-fact" key={`gap-${gap.id}`}>
            <dt className="a3-oms-fact-k">{labels.segment[gap.id] ?? ''}</dt>
            <dd className="a3-oms-fact-v">
              {/* The norm stays spelled out even though the number does not
                  exist: `NUF nach DIN 277 · nicht ermittelt` tells the reader
                  which measurement is missing, and `—` does not. */}
              <SemanticStatus
                tone="unknown"
                label={`${gap.denominatorLabel}${NNBSP}·${NNBSP}${labels.denominatorUnknown}`}
              />
            </dd>
          </div>
        ))}

        {scale ? (
          <MetricFact
            metric={scale}
            language={language}
            label={labels.scale}
          />
        ) : null}
      </dl>

      {/* Two segment metrics of one Option are two scale references, not two
          parts of a sum. Said once, from the projection, so no surface has to
          remember to say it. */}
      {segments.length > 1 && !projection.metricsAreAdditive ? (
        <p className="a3-oms-note">{labels.notAdditive}</p>
      ) : null}
    </div>
  )
}

function MetricFact({
  metric, language, label,
}: {
  metric: OptionAreaMetric
  language: UiLanguage
  label: string
}) {
  return (
    <div className="a3-oms-fact" data-metric={metric.id}>
      <dt className="a3-oms-fact-k">
        {label}
        <span className="a3-oms-fact-denominator">
          {NNBSP}
          ·
          {NNBSP}
          {metric.rate.denominatorLabel}
        </span>
      </dt>
      <dd className="a3-oms-fact-v numeric">
        {localizeMoneyText(rateUnit(metric.rate), language)}
      </dd>
    </div>
  )
}
