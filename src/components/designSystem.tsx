import {
  cloneElement,
  Fragment,
  isValidElement,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MotionProps } from 'framer-motion'
import { useSemanticMotion } from '../design-system/motion'
import { useT } from '../i18n'
import { Skeleton } from './primitives'
import { ATTENTION_MARK, Button } from './primitives'
import { SegmentedControl } from './controls'

export function SectionSheet({
  title,
  intro,
  children,
  as: Root = 'section',
  ...rest
}: {
  title?: ReactNode
  intro?: ReactNode
  children: ReactNode
  as?: 'section' | 'article' | 'div'
} & HTMLAttributes<HTMLElement>) {
  const titleId = useId()
  return (
    <Root
      {...rest}
      className={`a3-sheet${rest.className ? ` ${rest.className}` : ''}`}
      aria-labelledby={title ? titleId : rest['aria-labelledby']}
    >
      {title && <h2 id={titleId} className="a3-sheet-title">{title}</h2>}
      {intro && <p className="a3-sub">{intro}</p>}
      {children}
    </Root>
  )
}

export function PageHeader({ title, meta, lede, ...rest }: {
  title: ReactNode
  meta?: ReactNode
  lede?: ReactNode
} & HTMLAttributes<HTMLElement>) {
  return (
    <header {...rest} className={`a3-masthead${rest.className ? ` ${rest.className}` : ''}`}>
      <h1 className="a3-hero-title" tabIndex={-1} data-page-heading>{title}</h1>
      {meta && <div className="a3-meta">{meta}</div>}
      {lede && <p className="a3-lede">{lede}</p>}
    </header>
  )
}

/**
 * DC-22 · one canonical boundary between the private workspace and the
 * customer projection. The profile remains textually explicit in both
 * states; entering the customer view always delegates to DC-33.
 */
export function OutputProfileSwitch({
  mode,
  compact = false,
  blocked = false,
  blockedReason,
  onCheck,
  onExit,
  checkButtonRef,
}: {
  mode: 'intern' | 'praesentation'
  compact?: boolean
  blocked?: boolean
  blockedReason?: string
  onCheck: () => void
  onExit: () => void
  checkButtonRef?: Ref<HTMLButtonElement>
}) {
  const t = useT()
  const client = mode === 'praesentation'
  const blockedReasonId = useId()

  return (
    <div className={`a3-output-profile${compact ? ' a3-output-profile-compact' : ''}`}>
      <SegmentedControl
        layout="inline"
        legend={t('shell.profile.legend')}
        value={mode}
        onChange={(next) => next === 'praesentation' ? onCheck() : onExit()}
        options={[
          { value: 'intern', label: t('shell.profile.internal') },
          {
            value: 'praesentation',
            label: t('shell.profile.client'),
            disabled: !client && blocked,
            descriptionId: !client && blocked ? blockedReasonId : undefined,
          },
        ]}
      />

      {client ? (
        <Button variant="secondary" onClick={onExit}>{t('shell.profile.exit')}</Button>
      ) : (
        <Button
          ref={checkButtonRef}
          variant="secondary"
          disabled={blocked}
          aria-describedby={blocked && blockedReason ? blockedReasonId : undefined}
          onClick={onCheck}
        >
          {t('shell.profile.check')}
        </Button>
      )}

      {!client && blocked && blockedReason && (
        <p id={blockedReasonId} className="a3-output-blocked-reason">{blockedReason}</p>
      )}
      <p className="a3-mode-indicator" role="status" aria-live="polite" aria-atomic="true">
        <span aria-hidden="true">{client ? '◉' : '○'}</span>
        {client ? t('shell.profile.clientIndicator') : t('shell.profile.internalIndicator')}
      </p>
    </div>
  )
}

export function SmallText({ as: Root = 'span', ...rest }: {
  as?: 'span' | 'p' | 'figcaption'
} & HTMLAttributes<HTMLElement>) {
  return <Root {...rest} className={`a3-cap${rest.className ? ` ${rest.className}` : ''}`} />
}

export function InlineLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={`a3-linkbtn${props.className ? ` ${props.className}` : ''}`} />
}

export function LinkButton({ disabled, disabledReason, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & {
    disabled?: boolean
    disabledReason?: string
  }) {
  const reasonId = useId()
  return (
    <span className="a3-link-action">
      <button
        {...props}
        type={props.type ?? 'button'}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && disabledReason ? reasonId : props['aria-describedby']}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault()
            return
          }
          props.onClick?.(event)
        }}
        className={`a3-linkbtn${props.className ? ` ${props.className}` : ''}`}
      />
      {disabled && disabledReason && (
        <span id={reasonId} className="a3-form-disabled-reason">{disabledReason}</span>
      )}
    </span>
  )
}

export function FormField({
  label,
  htmlFor,
  helperText,
  error,
  disabledReason,
  loading = false,
  children,
}: {
  label: ReactNode
  htmlFor: string
  helperText?: ReactNode
  error?: ReactNode
  disabledReason?: ReactNode
  loading?: boolean
  children: ReactElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean | 'grammar' | 'spelling'
  }>
}) {
  const t = useT()
  const helperId = useId()
  const errorId = useId()
  const disabledId = useId()
  const describedBy = [
    children.props['aria-describedby'],
    helperText && helperId,
    error && errorId,
    disabledReason && disabledId,
  ].filter(Boolean).join(' ')
  const control = isValidElement(children) ? cloneElement(children, {
    id: children.props.id ?? htmlFor,
    'aria-invalid': error ? true : children.props['aria-invalid'],
    'aria-describedby': describedBy || undefined,
  }) : children

  return (
    <div className="a3-form-field" aria-busy={loading}>
      <label htmlFor={htmlFor}>{label}</label>
      {loading ? <Skeleton lines={1} label={t('common.fieldLoading')} /> : control}
      {helperText && <p id={helperId} className="a3-form-helper">{helperText}</p>}
      {error && <p id={errorId} className="a3-form-error">{error}</p>}
      {disabledReason && (
        <p id={disabledId} className="a3-form-disabled-reason">{disabledReason}</p>
      )}
    </div>
  )
}

export function SelectField({
  label,
  helperText,
  error,
  disabledReason,
  id: providedId,
  children,
  ...selectProps
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode
  helperText?: ReactNode
  error?: ReactNode
  disabledReason?: ReactNode
}) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const helperId = useId()
  const errorId = useId()
  const disabledId = useId()
  const describedBy = [
    selectProps['aria-describedby'],
    helperText && helperId,
    error && errorId,
    disabledReason && disabledId,
  ].filter(Boolean).join(' ')

  return (
    <div className="a3-form-field">
      <label htmlFor={id}>{label}</label>
      <select
        {...selectProps}
        id={id}
        className={`a3-select-field${selectProps.className ? ` ${selectProps.className}` : ''}`}
        aria-invalid={error ? true : selectProps['aria-invalid']}
        aria-describedby={describedBy || undefined}
      >
        {children}
      </select>
      {helperText && <p id={helperId} className="a3-form-helper">{helperText}</p>}
      {error && <p id={errorId} className="a3-form-error">{error}</p>}
      {disabledReason && (
        <p id={disabledId} className="a3-form-disabled-reason">{disabledReason}</p>
      )}
    </div>
  )
}

export function Card({
  title,
  meta,
  status,
  actions,
  onOpen,
  children,
  /**
   * Rein additiver Layout-Hook (z. B. `h-full` für gleich hohe Karten in
   * einem CSS-Grid mit variabler Kartenhöhe) — verändert nie `a3-card-core`
   * selbst, nur zusätzliche Utility-Klassen daneben. Optional, ohne
   * Default: bestehende Aufrufer bleiben unverändert.
   */
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  onOpen?: () => void
  children?: ReactNode
  className?: string
}) {
  return (
    <article
      className={'a3-card-core' + (className ? ` ${className}` : '')}
      data-interactive={onOpen ? 'true' : undefined}
    >
      <div className="a3-card-title">
        {onOpen ? (
          <button type="button" className="a3-linkbtn a3-card-destination" onClick={onOpen}>
            {title}
          </button>
        ) : title}
      </div>
      {meta && <div className="a3-card-meta">{meta}</div>}
      {children && <div className="a3-card-noninteractive">{children}</div>}
      {status && <div className="a3-card-noninteractive">{status}</div>}
      {actions && <div className="a3-card-actions">{actions}</div>}
    </article>
  )
}

export function Badge({
  sign,
  kind = 'status',
  children,
}: {
  sign: ReactNode
  kind?: 'status' | 'metadata'
  children: ReactNode
}) {
  return (
    <span className={`a3-badge${kind === 'metadata' ? ' a3-badge-metadata' : ''}`}>
      <span aria-hidden="true">{sign}</span>
      {children}
    </span>
  )
}

export type ReadinessItem = {
  id: string
  label: string
  ready: boolean
  detail?: ReactNode
}

type ChecklistMotion = {
  initial?: MotionProps['initial']
  animate?: MotionProps['animate']
  transition?: MotionProps['transition']
}

export type ChecklistPresentationItem = {
  id: string
  label: ReactNode
  resolved: boolean
  detail?: ReactNode
  trailing?: ReactNode
  motion?: ChecklistMotion
}

/** Shared visual anatomy for readiness and prerequisite compositions. */
export function ChecklistPresentation({
  summary,
  summaryClassName = 'a3-cap',
  announceSummary = false,
  summaryMotion,
  items,
}: {
  summary: ReactNode
  summaryClassName?: string
  announceSummary?: boolean
  summaryMotion?: ChecklistMotion
  items: ReadonlyArray<ChecklistPresentationItem>
}) {
  return (
    <>
      <motion.p
        className={summaryClassName}
        aria-live={announceSummary ? 'polite' : undefined}
        initial={summaryMotion?.initial}
        animate={summaryMotion?.animate}
        transition={summaryMotion?.transition}
      >
        {summary}
      </motion.p>
      <ul className="a3-prerequisite-list">
        {items.map((item) => (
          <motion.li
            key={item.id}
            className="a3-prerequisite-row"
            data-state={item.resolved ? 'resolved' : 'open'}
            initial={item.motion?.initial}
            animate={item.motion?.animate}
            transition={item.motion?.transition}
          >
            {/* F25: an unresolved prerequisite previously reused `▲`, the
                canonical derived-provenance glyph, for "needs attention"
                instead. */}
            <span className="a3-prerequisite-sign" aria-hidden="true">
              {item.resolved ? '✓' : ATTENTION_MARK}
            </span>
            <span>
              <strong>{item.label}</strong>
              {item.detail && <span className="a3-prerequisite-state">{item.detail}</span>}
            </span>
            {item.trailing}
          </motion.li>
        ))}
      </ul>
    </>
  )
}

/** DC-26: explicit output-profile readiness, never an aggregate ring. */
export function ReadinessChecklist({
  label,
  items,
  nextAction,
}: {
  label: string
  items: ReadonlyArray<ReadinessItem>
  nextAction?: ReactNode
}) {
  const t = useT()
  const done = items.filter((item) => item.ready).length
  return (
    <section className="a3-readiness-checklist" aria-label={label}>
      <ChecklistPresentation
        summary={t('designSystem.readinessSummary', { done, total: items.length })}
        items={items.map((item) => ({
          id: item.id,
          label: item.label,
          resolved: item.ready,
          detail: item.detail,
        }))}
      />
      {nextAction && <div className="a3-prerequisite-actions">{nextAction}</div>}
    </section>
  )
}

/** DC-27: one visible continuation, with no competing primary action. */
export function NextStep({ label, description, action, onAction }: {
  label?: string
  description: ReactNode
  action: string
  onAction: () => void
}) {
  const t = useT()
  return (
    <div className="a3-nextstep">
      <p className="a3-mtag">{label ?? t('chrome3.nextStep')}</p>
      <p>{description}</p>
      <div className="a3-prerequisite-actions">
        <Button variant="primary" onClick={onAction}>{action}</Button>
      </div>
    </div>
  )
}

export type WorkflowStepState = 'done' | 'attention' | 'blocked'

export type WorkflowStep = {
  id: string
  number: number
  title: string
  /** Visible state text (DC-13 STEP-002) — the marker only duplicates it. */
  stateText: string
  state: WorkflowStepState
  current: boolean
  onOpen: () => void
}

/**
 * DC-13 canonical `WorkflowStepper` (`STEP-001…007`, `KEY-003`, `TABS-001`).
 * Promoted out of `OpportunityCard.tsx`'s former hand-rolled
 * `ReadinessOverview` per `docs/audit/design-system-governance.md`
 * DS-GOV-EX-07's own follow-up: this closes the "no canonical React source"
 * half of the exception for its first consumer. `Sidebar.tsx`'s vertical
 * `.a3-chapters` anatomy is a separate, deliberately untouched consumer this
 * cycle — migrating it is a materially larger, unrelated regression surface
 * than this ticket owns — so the exception record stays open until both
 * render this component; see the governance doc's removal condition.
 *
 * A `blocked` step is a REAL lock (STEP-003, CLAUDE.md rule 12): it stays
 * keyboard-reachable via roving tabindex (never native `disabled`) and its
 * own visible state text IS the exposed reason (`aria-describedby`), but
 * activating it does not navigate — the same no-op-on-activation pattern
 * `CheckboxCard`'s `mandatory` prop already uses for a toggle, applied here
 * to navigation instead.
 */
export function WorkflowStepper({ label, steps, orientation = 'horizontal' }: {
  label: string
  steps: ReadonlyArray<WorkflowStep>
  orientation?: 'horizontal' | 'vertical'
}) {
  const t = useT()
  const listRef = useRef<HTMLOListElement>(null)
  const [focusIdx, setFocusIdx] = useState(0)
  const reasonId = useId()

  const moveFocus = (next: number) => {
    setFocusIdx(next)
    listRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const len = steps.length
    const forwardKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
    const backwardKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
    const next = e.key === forwardKey ? (focusIdx + 1) % len
      : e.key === backwardKey ? (focusIdx - 1 + len) % len
        : e.key === 'Home' ? 0
          : e.key === 'End' ? len - 1
            : null
    if (next === null) return
    e.preventDefault()
    moveFocus(next)
  }

  return (
    <nav aria-label={label}>
      <ol
        ref={listRef}
        className={'a3-workflow-stepper' + (orientation === 'vertical' ? ' a3-wf-vertical' : '')}
        onKeyDown={onKey}
      >
        {steps.map((step, i) => {
          const locked = step.state === 'blocked'
          const textId = `${reasonId}-${step.id}`
          return (
            <li key={step.id} className="a3-wf-item">
              <button
                type="button"
                onClick={() => { setFocusIdx(i); if (!locked) step.onOpen() }}
                onFocus={() => setFocusIdx(i)}
                aria-current={step.current ? 'step' : undefined}
                aria-disabled={locked ? true : undefined}
                aria-describedby={textId}
                tabIndex={focusIdx === i ? 0 : -1}
                className={'a3-wf-step relative flex min-h-hit-target w-full items-center gap-3 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
                  + (step.state === 'done' ? ' a3-wf-done' : '')
                  + (step.current ? ' a3-wf-cur' : '')
                  + (locked ? ' a3-wf-locked' : '')}
              >
                <span className="a3-wf-n numeric shrink-0">
                  <span aria-hidden="true">{step.number}</span>
                  <span className="sr-only">
                    {t('oppcard.stepPosition', { n: step.number, total: steps.length })}
                  </span>
                </span>
                <span aria-hidden="true" className="w-4 shrink-0">
                  {step.state === 'done' ? '✓' : locked ? '○' : ATTENTION_MARK}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-text-primary">{step.title}</span>
                  <span id={textId} className="a3-cap block">{step.stateText}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** A canonical hierarchical table row with native disclosure semantics. */
export function DisclosureRow({
  label,
  cells,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  label: ReactNode
  cells: ReadonlyArray<ReactNode>
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const contentId = useId()
  const { fadeRise } = useSemanticMotion()
  const toggle = () => {
    const next = !open
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  return (
    <Fragment>
      <tr className="a3-disclosure-row">
        <th scope="row">
          <button
            type="button"
            className="a3-disclosure-button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={toggle}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'} </span>{label}
          </button>
        </th>
        {cells.map((cell, index) => <td key={index}>{cell}</td>)}
      </tr>
      <AnimatePresence initial={false}>
        {open && (
          <motion.tr
            id={contentId}
            className="a3-disclosure-content"
            variants={fadeRise}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <td colSpan={cells.length + 1}>{children}</td>
          </motion.tr>
        )}
      </AnimatePresence>
    </Fragment>
  )
}
