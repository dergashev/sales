import { useMemo } from 'react'
import {
  useReducedMotion as useFramerReducedMotion,
  type Transition,
  type Variants,
} from 'framer-motion'

/**
 * One semantic motion mapping for the React design-system source.
 *
 * Durations are read from the canonical CSS tokens. The numeric fallbacks are
 * used only when CSS is unavailable (SSR/jsdom); consumers never carry local
 * timings or local keyframes.
 */
const FALLBACK_MS = {
  feedback: 120,
  reveal: 200,
  reorder: 240,
  wave: 80,
} as const

export type MotionPurpose = keyof typeof FALLBACK_MS

function tokenValue(token: string, seen = new Set<string>()): string {
  if (typeof document === 'undefined' || seen.has(token)) return ''
  seen.add(token)
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const reference = raw.match(/^var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\s*\)$/)?.[1]
  return reference ? tokenValue(reference, seen) : raw
}

function tokenMilliseconds(token: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const raw = tokenValue(token)
  if (!raw) return fallback
  if (raw.endsWith('ms')) {
    const value = Number.parseFloat(raw)
    return Number.isFinite(value) ? value : fallback
  }
  if (raw.endsWith('s')) {
    const value = Number.parseFloat(raw)
    return Number.isFinite(value) ? value * 1000 : fallback
  }
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

export type SemanticMotion = {
  reduced: boolean
  fadeOnly: Variants
  fadeRise: Variants
  transition: (purpose: MotionPurpose, wave?: number) => Transition
}

/**
 * Canonical fadeOnly/fadeRise presence behavior plus causal-wave timing.
 * Reduced motion keeps the same state/focus lifecycle and makes every visual
 * duration, delay, and transform zero.
 */
export function useSemanticMotion(): SemanticMotion {
  const reduced = Boolean(useFramerReducedMotion())

  return useMemo(() => {
    const durations = {
      feedback: tokenMilliseconds('--motion-feedback', FALLBACK_MS.feedback),
      reveal: tokenMilliseconds('--motion-reveal', FALLBACK_MS.reveal),
      reorder: tokenMilliseconds('--motion-reorder', FALLBACK_MS.reorder),
      wave: tokenMilliseconds('--stagger-wave', FALLBACK_MS.wave),
    }
    const transition = (purpose: MotionPurpose, wave = 0): Transition => ({
      duration: reduced ? 0 : durations[purpose] / 1000,
      delay: reduced ? 0 : wave * durations.wave / 1000,
      ease: [0.25, 0.6, 0.3, 1],
    })

    return {
      reduced,
      transition,
      fadeOnly: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: transition('reveal') },
        exit: { opacity: 0, transition: transition('feedback') },
      },
      fadeRise: {
        hidden: {
          opacity: 0,
          y: reduced ? 0 : 'var(--enter-shift)',
        },
        visible: {
          opacity: 1,
          y: 0,
          transition: transition('reveal'),
        },
        exit: {
          opacity: 0,
          y: 0,
          transition: transition('feedback'),
        },
      },
    }
  }, [reduced])
}
