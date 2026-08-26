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
  // R1 (ADR-R1-05): CONTINUITY verb fallback. DIRECTION/REVEAL/STATE reuse
  // reorder/reveal/wave above — see design-system/tokens.css `--motion-continuity`.
  continuity: 260,
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

/** DIRECTION verb (R1 ADR-R1-05): ordered forward/backward progression —
 * chapter navigation, workflow steps. Reserved for genuinely ORDERED
 * sequences; lateral switches (tabs, buildings) use `fadeOnly`/`fadeRise`
 * instead — a directional slide there would falsely imply depth. */
export type DirectionVariants = { forward: Variants; backward: Variants }

export type SemanticMotion = {
  reduced: boolean
  fadeOnly: Variants
  fadeRise: Variants
  /** Canonical staggered-list assembly (design-system/README.md §5's
   * documented-but-unimplemented third variant, alongside fadeRise/fadeOnly).
   * REVEAL verb: structural frame first, then rows in `--stagger-row` steps —
   * "work produced this result" (analysis protocol, hero wave, offer summary). */
  staggerList: { container: Variants; item: Variants }
  /** DIRECTION verb: `forward`/`backward` translate ±`--enter-shift`×3
   * horizontally + fade. Use ONLY for ordered sequences (chapters, steps). */
  direction: DirectionVariants
  /** CONTINUITY verb: shared-identity morph (list card → detail header).
   * Pair two elements with the SAME framer-motion `layoutId`; this transition
   * governs the layout animation's timing/easing character. */
  continuityTransition: Transition
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
      continuity: tokenMilliseconds('--motion-continuity', FALLBACK_MS.continuity),
    }
    const rowStagger = tokenMilliseconds('--stagger-row', 30)
    const transition = (purpose: MotionPurpose, wave = 0): Transition => {
      const key = purpose === 'continuity' ? 'continuity' : purpose
      return {
        duration: reduced ? 0 : durations[key] / 1000,
        delay: reduced ? 0 : wave * durations.wave / 1000,
        ease: [0.25, 0.6, 0.3, 1],
      }
    }
    // Emphasized character (ADR-R1-05 DIRECTION/CONTINUITY): decisive start,
    // soft landing — distinct from the standard ease used by reveal/feedback.
    const emphasized: [number, number, number, number] = [0.2, 0.8, 0.2, 1]
    const shift = reduced ? 0 : 24 // px — ±24px horizontal per the direction spec

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
      staggerList: {
        container: {
          hidden: {},
          visible: {
            transition: reduced ? {} : { staggerChildren: rowStagger / 1000 },
          },
        },
        item: {
          hidden: { opacity: 0, y: reduced ? 0 : 'var(--enter-shift)' },
          visible: { opacity: 1, y: 0, transition: transition('reveal') },
          exit: { opacity: 0, transition: transition('feedback') },
        },
      },
      direction: {
        // `reduced` zeroes duration here too (not only `shift`) — without
        // this, prefers-reduced-motion still left a same-position opacity
        // fade running at the full 240ms reorder duration, contradicting
        // rule 21 ("prefers-reduced-motion гасит всё"). Caught while
        // building the R1 Workflow specimen's reduced-motion equivalent.
        forward: {
          initial: { opacity: 0, x: shift },
          animate: { opacity: 1, x: 0, transition: { duration: reduced ? 0 : durations.reorder / 1000, ease: emphasized } },
          exit: { opacity: 0, x: -shift, transition: { duration: reduced ? 0 : durations.reorder / 1000, ease: emphasized } },
        },
        backward: {
          initial: { opacity: 0, x: -shift },
          animate: { opacity: 1, x: 0, transition: { duration: reduced ? 0 : durations.reorder / 1000, ease: emphasized } },
          exit: { opacity: 0, x: shift, transition: { duration: reduced ? 0 : durations.reorder / 1000, ease: emphasized } },
        },
      },
      continuityTransition: {
        duration: reduced ? 0 : durations.continuity / 1000,
        ease: emphasized,
      },
    }
  }, [reduced])
}
