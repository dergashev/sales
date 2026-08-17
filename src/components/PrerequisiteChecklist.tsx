import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSemanticMotion } from '../design-system/motion'
import { useT } from '../i18n'
import { Button } from './primitives'
import { ChecklistPresentation, LinkButton } from './designSystem'

export type Prerequisite = {
  id: string
  label: string
  resolved: boolean
  sourceLabel: string
  onOpenSource: () => void
}

/**
 * Local Opportunity prerequisite composition. This is intentionally not
 * DC-26 output-profile readiness: it names the two project prerequisites,
 * their source, and one next action without a ring or percentage.
 *
 * The only action button here is `onCreate` — the one real primary CTA.
 * `onOpenSource` per row is navigation (jump back to the section that
 * owns the decision), never a second button pretending to perform it:
 * an earlier "next action" shortcut used to duplicate this with a
 * primary-styled button whose label promised the real action while its
 * click only scrolled the page — removed, since a section's own button
 * is the sole place that transition actually happens.
 */
export function PrerequisiteChecklist({
  label,
  requirements,
  createLabel,
  canCreate,
  createDisabledReason,
  onCreate,
}: {
  label: string
  requirements: ReadonlyArray<Prerequisite>
  createLabel: string
  canCreate: boolean
  createDisabledReason?: string
  onCreate: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const previous = useRef<Record<string, boolean> | null>(null)
  const [visible, setVisible] = useState(false)
  const { reduced, transition } = useSemanticMotion()

  const status = Object.fromEntries(
    requirements.map((requirement) => [requirement.id, requirement.resolved]),
  )
  const signature = requirements
    .map((requirement) => `${requirement.id}:${requirement.resolved ? '1' : '0'}`)
    .join('|')
  const changedIds = previous.current
    ? requirements
      .filter((requirement) => previous.current?.[requirement.id] !== requirement.resolved)
      .map((requirement) => requirement.id)
    : []
  const changed = changedIds.length > 0
  const wave = changed && visible && !reduced

  useEffect(() => {
    previous.current = status
  }, [signature])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const done = requirements.filter((requirement) => requirement.resolved).length
  return (
    <div ref={rootRef} className="a3-prerequisites" role="group" aria-label={label}>
      <ChecklistPresentation
        summary={t('oppcard.prerequisitesSummary', { done, total: requirements.length })}
        summaryClassName="a3-prerequisite-summary"
        announceSummary
        summaryMotion={{
          initial: false,
          animate: wave ? { opacity: [0, 1] } : { opacity: 1 },
          transition: transition('feedback', wave ? 1 : 0),
        }}
        items={requirements.map((requirement) => {
          const rowChanged = wave && changedIds.includes(requirement.id)
          return {
            id: requirement.id,
            label: requirement.label,
            resolved: requirement.resolved,
            detail: requirement.resolved ? t('common.fulfilled') : t('common.open'),
            trailing: (
              <LinkButton onClick={requirement.onOpenSource}>
                {requirement.sourceLabel}
              </LinkButton>
            ),
            motion: {
              initial: false,
              animate: rowChanged ? { opacity: [0, 1] } : { opacity: 1 },
              transition: transition('feedback'),
            },
          }
        })}
      />

      <motion.div
        className="a3-prerequisite-actions"
        initial={false}
        animate={wave ? { opacity: [0, 1] } : { opacity: 1 }}
        transition={transition('feedback', wave ? 2 : 0)}
      >
        <Button
          variant={canCreate ? 'primary' : 'secondary'}
          disabled={!canCreate}
          disabledReason={createDisabledReason}
          onClick={onCreate}
        >
          {createLabel}
        </Button>
      </motion.div>
    </div>
  )
}
