import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSemanticMotion } from '../design-system/motion'
import { Button } from './primitives'
import { LinkButton } from './designSystem'

export type Prerequisite = {
  id: string
  label: string
  resolved: boolean
  sourceLabel: string
  onOpenSource: () => void
  nextActionLabel: string
}

/**
 * Local Opportunity prerequisite composition. This is intentionally not
 * DC-26 output-profile readiness: it names the two project prerequisites,
 * their source, and one next action without a ring or percentage.
 */
export function PrerequisiteChecklist({
  label,
  requirements,
  createLabel,
  createDisabledReason,
  onCreate,
}: {
  label: string
  requirements: ReadonlyArray<Prerequisite>
  createLabel: string
  createDisabledReason?: string
  onCreate: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
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
  const next = requirements.find((requirement) => !requirement.resolved)
  return (
    <div ref={rootRef} className="a3-prerequisites" role="group" aria-label={label}>
      <motion.p
        key={`summary-${signature}`}
        className="a3-prerequisite-summary"
        aria-live="polite"
        initial={wave ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={transition('feedback', wave ? 1 : 0)}
      >
        {done} von {requirements.length} Punkten erledigt
      </motion.p>

      <ul className="a3-prerequisite-list">
        {requirements.map((requirement) => {
          const rowChanged = wave && changedIds.includes(requirement.id)
          return (
            <motion.li
              key={`${requirement.id}-${requirement.resolved ? 'resolved' : 'open'}`}
              className="a3-prerequisite-row"
              data-state={requirement.resolved ? 'resolved' : 'open'}
              initial={rowChanged ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={transition('feedback')}
            >
              <span className="a3-prerequisite-sign" aria-hidden="true">
                {requirement.resolved ? '✓' : '▲'}
              </span>
              <span>
                <strong>{requirement.label}</strong>
                <span className="a3-prerequisite-state">
                  {requirement.resolved ? 'Erfüllt' : 'Offen'}
                </span>
              </span>
              <LinkButton onClick={requirement.onOpenSource}>
                {requirement.sourceLabel}
              </LinkButton>
            </motion.li>
          )
        })}
      </ul>

      <motion.div
        key={`action-${signature}`}
        className="a3-prerequisite-actions"
        initial={wave ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={transition('feedback', wave ? 2 : 0)}
      >
        {next ? (
          <>
            <Button variant="primary" onClick={next.onOpenSource}>
              {next.nextActionLabel}
            </Button>
            <Button disabled disabledReason={createDisabledReason} onClick={onCreate}>
              {createLabel}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onCreate}>{createLabel}</Button>
        )}
      </motion.div>
    </div>
  )
}
