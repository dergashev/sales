import { AnimatePresence, motion, useIsPresent, type Variants } from 'framer-motion'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useTx } from '../i18n'
import { useSemanticMotion } from '../design-system/motion'
import { Skeleton } from './primitives'

export type DataStateKind =
  | 'loading'
  | 'empty'
  | 'partial'
  | 'ready'
  | 'error'
  | 'stale'
  | 'permission'

export type DataStateBlockState = Exclude<DataStateKind, 'loading' | 'ready'>

type DataStateContent = {
  sentence: string
  detail?: string
  impact?: string
  remedy?: string
  retryPolicy?: string
  action?: ReactNode
}

type DataStateBlockProps =
  | ({ state: 'error' } & DataStateContent & Required<Pick<
    DataStateContent,
    'impact' | 'remedy' | 'retryPolicy'
  >>)
  | ({ state: Exclude<DataStateBlockState, 'error'> } & DataStateContent)

const STATE_SIGN: Record<DataStateBlockState, string> = {
  empty: '○',
  partial: '◐',
  error: '✗',
  stale: '▲',
  permission: '○',
}

const STATE_CLASS: Record<DataStateBlockState, string> = {
  empty: 'a3-data-state-empty',
  partial: 'a3-data-state-partial',
  error: 'a3-data-state-error',
  stale: 'a3-data-state-stale',
  permission: 'a3-data-state-permission',
}

/**
 * Canonical non-ready state surface. It is static by default: the owning
 * component decides whether a newly completed transition warrants one polite
 * announcement. The root never becomes an interactive control.
 */
export function DataStateBlock({
  state,
  sentence,
  detail,
  impact,
  remedy,
  retryPolicy,
  action,
}: DataStateBlockProps) {
  const tx = useTx()
  return (
    <div className={`a3-data-state ${STATE_CLASS[state]}`}>
      <p>
        <span aria-hidden="true">{STATE_SIGN[state]} </span>
        {tx(sentence)}
      </p>
      {detail && <p>{tx(detail)}</p>}
      {impact && <p>{tx(impact)}</p>}
      {remedy && <p>{tx(remedy)}</p>}
      {retryPolicy && <p>{tx(retryPolicy)}</p>}
      {action && <div className="a3-data-state-action">{action}</div>}
    </div>
  )
}

export type OwnerDataState<T> =
  | { status: 'loading'; label?: string }
  | { status: 'ready'; data: T }
  | ({ status: 'error' } & Omit<Extract<DataStateBlockProps, { state: 'error' }>, 'state'>)
  | ({ status: Exclude<DataStateBlockState, 'error'> } & Omit<
    Extract<DataStateBlockProps, { state: Exclude<DataStateBlockState, 'error'> }>,
    'state'
  >)

function StatePresence({ children, variants }: {
  children: ReactNode
  variants: Variants
}) {
  const present = useIsPresent()
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.inert = !present
  }, [present])
  return (
    <motion.div
      ref={rootRef}
      aria-hidden={present ? undefined : 'true'}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

/**
 * Typed loading-to-result owner. `ready` renders the owner's actual content;
 * it never becomes a decorative success panel. Semantics and aria-busy
 * switch immediately, while Skeleton exit and result entry crossfade in the
 * same geometry. A newer state replaces the previous presence transition.
 */
export function DataStateBoundary<T>({
  state,
  renderReady,
  skeletonLines = 3,
  announce = false,
  label,
}: {
  state: OwnerDataState<T>
  renderReady: (data: T) => ReactNode
  skeletonLines?: number
  announce?: boolean
  label: string
}) {
  const { fadeOnly, fadeRise } = useSemanticMotion()
  const loading = state.status === 'loading'
  return (
    <div
      className="a3-data-owner"
      aria-label={label}
      aria-busy={loading}
      aria-live={announce ? 'polite' : undefined}
    >
      <AnimatePresence initial={false} mode="sync">
        {loading ? (
          <StatePresence key="loading" variants={fadeOnly}>
            <Skeleton lines={skeletonLines} label={state.label} />
          </StatePresence>
        ) : (
          <StatePresence key={state.status} variants={fadeRise}>
            {state.status === 'ready' ? renderReady(state.data) : state.status === 'error' ? (
              <DataStateBlock
                state="error"
                sentence={state.sentence}
                detail={state.detail}
                impact={state.impact}
                remedy={state.remedy}
                retryPolicy={state.retryPolicy}
                action={state.action}
              />
            ) : (
                <DataStateBlock
                  state={state.status}
                  sentence={state.sentence}
                  detail={state.detail}
                  impact={state.impact}
                  remedy={state.remedy}
                  retryPolicy={state.retryPolicy}
                  action={state.action}
                />
              )}
          </StatePresence>
        )}
      </AnimatePresence>
    </div>
  )
}

export function EmptyState({ children, action }: {
  children: string
  action?: ReactNode
}) {
  return <DataStateBlock state="empty" sentence={children} action={action} />
}

export function PartialState({ label, consequence }: {
  label: string
  consequence: string
}) {
  return <DataStateBlock state="partial" sentence={label} detail={consequence} />
}

/** Error anatomy is always cause → impact → remedy → retry policy. */
export function ErrorState({ cause, impact, remedy, retryPolicy, action }: {
  cause: string
  impact: string
  remedy: string
  retryPolicy: string
  action?: ReactNode
}) {
  return (
    <DataStateBlock
      state="error"
      sentence={cause}
      impact={impact}
      remedy={remedy}
      retryPolicy={retryPolicy}
      action={action}
    />
  )
}

export function StaleState({ children }: { children: string }) {
  return <DataStateBlock state="stale" sentence={children} />
}

export function PermissionState({ children }: { children: string }) {
  return <DataStateBlock state="permission" sentence={children} />
}
