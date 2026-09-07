import { CONFIGURATOR_STEP } from '../state/chapters'
import { KG_CHAPTER_STEP, responsibilityFor, useStore } from '../state/store'
import { useT } from '../i18n'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { KGConfigurationPage } from '../design-system/KGConfiguration'
import { DataTable } from '../design-system/DataTable'
import { SemanticStatus } from '../design-system/SemanticStatus'

/**
 * Schnittstellen & Verantwortung — the dedicated Configurator step
 * (VR3-TGA-UX-00, target T-12).
 *
 * INTERIM / STRUCTURAL TARGET — NOT THE FINAL RESPONSIBILITY MATRIX DESIGN.
 *
 * This screen proves two things and deliberately nothing more: that the
 * interface/responsibility truth has ONE owner outside KG 400, and that the
 * step exists in the canonical order (KG 700 → here → Terminplan) with a
 * route, a spine entry, Previous/Next and a review section. What it shows is
 * exactly what the retired eighth "system" of KG 400 showed — the scope
 * boundary, the handover point, the four utility media with their status,
 * the source and the offer condition — recomposed only enough to be coherent
 * on its own page. The final matrix interaction model is a future, user-led
 * target and is not designed here.
 *
 * READ-ONLY BY INHERITANCE, not by omission. The retired services were
 * `readOnlyRequired`; nothing here was editable before and nothing becomes
 * editable by moving. The Option-owned record (`responsibility`) is the
 * owner a future editor writes to; this surface reads it through the ONE
 * selector (`responsibilityFor`) every other consumer reads.
 *
 * NO EURO. `Hausanschlüsse` is the Bauherr's; the boundary carries no cost
 * authority. An unresolved medium is a CONDITION the offer names — the
 * review lists it as a permitted warning — never an amount, never a gap.
 */
export function ResponsibilityStage() {
  const s = useStore()
  const t = useT()
  const en = s.uiLanguage === 'en'
  const label = (de: string, enText: string) => (en ? enText : de)
  const responsibility = responsibilityFor(s)
  const unresolved = responsibility?.unresolved.length ?? 0

  const previous = (
    <Button onClick={() => s.openConfiguratorStepAt(KG_CHAPTER_STEP.KG_700)}>
      {t('vr3.kg.page.previous', { group: `KG${NNBSP}700` })}
    </Button>
  )
  const next = (
    <Button
      variant="primary"
      onClick={() => s.openConfiguratorStepAt(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)}
    >
      {t('vr3.kg.page.toSchedule')}
    </Button>
  )

  return (
    <KGConfigurationPage
      identity={t('vr3.responsibility.eyebrow')}
      title={t('vr3.responsibility.heading')}
      lead={t('vr3.responsibility.lead')}
      progress={unresolved > 0
        ? {
          tone: 'attention',
          label: t(unresolved === 1
            ? 'vr3.responsibility.state.open'
            : 'vr3.responsibility.state.openPlural', { count: unresolved }),
        }
        : { tone: 'ok', label: t('vr3.responsibility.state.derived') }}
      previousAction={previous}
      nextAction={next}
    >
      <div className="a3-resp" data-responsibility-stage data-origin={responsibility?.origin}>
        {/* The interim label is PART OF THE IMPLEMENTATION EVIDENCE the
            ticket requires, visible on the surface and not only in prose. */}
        <aside className="a3-resp-interim" aria-label={t('vr3.responsibility.interim.title')}>
          <p className="a3-resp-interim-k">{t('vr3.responsibility.interim.title')}</p>
          <p className="a3-resp-interim-b">{t('vr3.responsibility.interim.body')}</p>
        </aside>

        {!responsibility && (
          <p className="a3-resp-empty">{t('vr3.responsibility.empty')}</p>
        )}

        {responsibility && (
          <>
            <section
              className="a3-resp-boundary"
              aria-label={label(
                responsibility.scopeBoundary.labelDe, responsibility.scopeBoundary.labelEn,
              )}
            >
              <h2 className="a3-resp-boundary-h">
                <span className="a3-resp-boundary-k">
                  {label(responsibility.scopeBoundary.labelDe, responsibility.scopeBoundary.labelEn)}
                </span>
                <span className="a3-resp-boundary-v">
                  {t('vr3.responsibility.boundary.all3From', {
                    handover: label(
                      responsibility.scopeBoundary.handoverDe,
                      responsibility.scopeBoundary.handoverEn,
                    ),
                  })}
                </span>
              </h2>
              <p className="a3-resp-boundary-b">
                {label(responsibility.scopeBoundary.summaryDe, responsibility.scopeBoundary.summaryEn)}
              </p>
              <p className="a3-resp-origin">
                <span className="a3-resp-origin-k">{t('vr3.responsibility.origin')}</span>
                <span>
                  {label(
                    responsibility.scopeBoundary.source.originDe,
                    responsibility.scopeBoundary.source.originEn,
                  )}
                </span>
              </p>
            </section>

            <DataTable
              caption={t('vr3.responsibility.table.caption')}
              className="a3-resp-table"
              columns={[
                { key: 'medium', header: t('vr3.responsibility.table.medium') },
                { key: 'client', header: t('vr3.responsibility.table.client') },
                { key: 'all3', header: t('vr3.responsibility.table.all3') },
                { key: 'status', header: t('vr3.responsibility.table.status') },
              ]}
              rows={responsibility.media.map((medium) => ({
                key: medium.id,
                header: label(medium.labelDe, medium.labelEn),
                cells: [
                  { content: label(medium.clientDe, medium.clientEn) },
                  { content: label(medium.all3FromDe, medium.all3FromEn) },
                  {
                    // A WORD beside a glyph, never a colour alone (rule 8).
                    content: (
                      <SemanticStatus
                        tone={medium.status === 'ok' ? 'ok' : 'attention'}
                        label={t(`vr3.responsibility.status.${medium.status}`)}
                        size="compact"
                      />
                    ),
                  },
                ],
              }))}
            />

            <p className="a3-resp-origin">
              <span className="a3-resp-origin-k">{t('vr3.responsibility.origin')}</span>
              <span>
                {label(
                  responsibility.connections.source.originDe,
                  responsibility.connections.source.originEn,
                )}
                {' · '}
                {t('vr3.tga.price.bauherr')}
              </span>
            </p>
            <p className="a3-resp-note">
              {label(responsibility.connections.offerNoteDe, responsibility.connections.offerNoteEn)}
            </p>
            {responsibility.origin === 'legacy' && (
              <p className="a3-resp-note">{t('vr3.responsibility.legacy')}</p>
            )}
            <p className="a3-resp-owner">{t('vr3.responsibility.owner.note')}</p>
          </>
        )}
      </div>
    </KGConfigurationPage>
  )
}
