import {
  cloneElement,
  Fragment,
  isValidElement,
  useId,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
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
import { Button } from './primitives'
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
  blocked = false,
  blockedReason,
  onCheck,
  onExit,
  checkButtonRef,
}: {
  mode: 'intern' | 'praesentation'
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
    <div className="a3-output-profile">
      <SegmentedControl
        layout="inline"
        legend={t('shell.mode.legend')}
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
}: {
  title: ReactNode
  meta?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  onOpen?: () => void
  children?: ReactNode
}) {
  return (
    <article className="a3-card-core" data-interactive={onOpen ? 'true' : undefined}>
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
            <span className="a3-prerequisite-sign" aria-hidden="true">
              {item.resolved ? '✓' : '▲'}
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

/** A canonical hierarchical table row with native disclosure semantics. */
export function DisclosureRow({
  label,
  cells,
  children,
}: {
  label: ReactNode
  cells: ReadonlyArray<ReactNode>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const { fadeRise } = useSemanticMotion()
  return (
    <Fragment>
      <tr className="a3-disclosure-row">
        <th scope="row">
          <button
            type="button"
            className="a3-disclosure-button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen((current) => !current)}
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
