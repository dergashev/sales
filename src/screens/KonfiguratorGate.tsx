import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useStore, canBeginConfiguration } from '../state/store'
import {
  scopeBuilding,
  scopeSelectedIds,
  scopeUnconfirmedBuildings,
  selectedBgfRSTotal,
} from '../state/optionBuildingScope'
import { useT } from '../i18n'
import { useLocalNumber } from '../lib/localNumber'
import { Button } from '../components/primitives'
import { projectAsset } from '../assets/project-media'
import { MediaFrame } from '../design-system/MediaFrame'
import { ActionGate, type GatePrerequisite } from '../design-system/ActionGate'
import { MetricReadout } from '../design-system/AuthorityTrace'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { useSemanticMotion } from '../design-system/motion'

/**
 * The Konfigurator's own gate surface (targets T-016 and T-017).
 *
 * A LOCKED STAGE IS A PLACE, NOT AN ABSENCE.
 *
 * Before this surface the Konfigurator was simply unreachable: the router
 * bounced the user back to Gebäude & Umfang and the navigation item went
 * grey. Grey is not an explanation. The target's own words for the defect
 * are exact — "the system knows what is missing and provides a direct
 * recovery path; disabled navigation is not the explanation" — so the stage
 * the user asked for renders, states the prerequisite by name, and offers
 * the route that resolves it.
 *
 * It is still FAIL-CLOSED. The configurator itself is NOT MOUNTED behind a
 * closed gate: there is no empty pricing surface, no zero total and no
 * half-configured chapter to be read as a fact about this Option.
 *
 * The same surface carries the SAVE RECEIPT. Availability is the receipt —
 * the scope that was saved, the buildings it covers, the area it commits to
 * and the one next step — because a receipt that lives somewhere else is a
 * receipt the user has to go and find.
 */
export function KonfiguratorGate() {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const motionSpec = useSemanticMotion()
  const open = canBeginConfiguration(s)
  const selectedIds = scopeSelectedIds(s)
  const unconfirmed = scopeUnconfirmedBuildings(s)
  const saved = s.scopeSaved
  const heading = useRef<HTMLHeadingElement>(null)

  /**
   * M-05: focus goes to the CONFIRMATION HEADING, not to the newly available
   * navigation. The user's attention belongs on what just became true; a
   * nav item that silently took focus would move them somewhere they did
   * not ask to go, and the announcement would arrive after the fact.
   */
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current) heading.current?.focus()
    wasOpen.current = open
  }, [open])

  const asset = projectAsset(
    scopeBuilding(s, selectedIds[0] ?? null)?.identityAssetId ?? '',
  )

  const prerequisites: GatePrerequisite[] = [
    {
      id: 'scope',
      label: t('vr3.konfigurator.prereq.scope'),
      met: open,
      detail: open ? undefined : unconfirmed[0]
        ? t('vr3.konfigurator.prereq.buildingDetail', { building: unconfirmed[0].name })
        : selectedIds.length === 0
          ? t('vr3.scope.prereq.selectionDetail')
          : t('vr3.konfigurator.prereq.saveDetail'),
    },
  ]

  return (
    <div className="px-7 py-6">
      <div className="a3-gatestage">
        <motion.div
          className="a3-gatestage-copy"
          variants={motionSpec.fadeRise}
          initial="hidden"
          animate="visible"
          transition={motionSpec.transition('reveal')}
        >
          <p className="a3-gatestage-eyebrow">{t('vr3.konfigurator.eyebrow')}</p>
          <h1
            className="a3-gatestage-heading"
            tabIndex={-1}
            ref={heading}
            data-page-heading
          >
            {t(open ? 'vr3.konfigurator.heading.available' : 'vr3.konfigurator.heading.locked')}
          </h1>
          <p className="a3-gatestage-lead">
            {t(open ? 'vr3.konfigurator.lead.available' : 'vr3.konfigurator.lead.locked')}
          </p>
          {open && saved ? (
            <div className="a3-gatestage-receipt">
              {/* The receipt says what became TRUE, in words, before it says
                  it in numbers: a row of figures states the scope but not
                  the outcome, and the outcome is what the user just earned. */}
              <p className="a3-gatestage-receipt-title">
                <SemanticStatus
                  tone="ok"
                  label={t(
                    saved.selectedIds.length === 1
                      ? 'vr3.konfigurator.receipt.title.one'
                      : 'vr3.konfigurator.receipt.title.many',
                    { count: saved.selectedIds.length },
                  )}
                />
              </p>
              <p className="a3-gatestage-receipt-next">
                {t('vr3.konfigurator.receipt.next')}
              </p>
              <dl className="a3-gatestage-receipt-figures">
              <MetricReadout
                label={t('vr3.konfigurator.receipt.buildings')}
                value={num(saved.selectedIds.length)}
                variant="compact"
              />
              <MetricReadout
                label={t('vr3.konfigurator.receipt.bgf')}
                value={num(selectedBgfRSTotal(s), 0)}
                unit={t('vr3.scope.unit.area')}
                variant="compact"
                authority="confirmed"
              />
              <MetricReadout
                label={t('vr3.konfigurator.receipt.savedAt')}
                value={saved.at.slice(0, 10)}
                variant="compact"
              />
              </dl>
            </div>
          ) : null}
          <ActionGate
            status={open ? 'available' : 'locked'}
            prerequisites={prerequisites}
            route={open ? undefined : {
              label: unconfirmed[0]
                ? t('vr3.konfigurator.route.building', { building: unconfirmed[0].name })
                : t('vr3.konfigurator.route.scope'),
              onSelect: () => {
                if (unconfirmed[0]) s.setScopeActiveBuilding(unconfirmed[0].id)
                s.setPipelineView('buildingScope')
              },
            }}
          >
            <Button
              variant="primary"
              disabled={!open}
              /* The gate beneath already NAMES the prerequisite; the button
                 says what happens when it is met. Printing the same
                 sentence in both places is the duplicated label this
                 system exists to avoid. */
              disabledReason={open ? undefined : t('vr3.konfigurator.blockedReason')}
              onClick={() => s.confirmConfigurationMode(s.configurationMode)}
            >
              {t('vr3.konfigurator.start')}
            </Button>
          </ActionGate>
        </motion.div>
        <div className="a3-gatestage-media">
          <MediaFrame
            ratio="pano"
            state={asset ? 'loaded' : 'fallback'}
            src={asset?.url}
            alt={asset ? t(asset.altKey) : undefined}
            fallbackLabel={t('nav.konfigurator')}
            seed={selectedIds[0] ?? 'konfigurator'}
            sourceId={asset?.assetId}
          />
        </div>
      </div>
    </div>
  )
}
