import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useSemanticMotion } from '../design-system/motion'

type FocusResolver = () => HTMLElement | null

export type DialogHandle = {
  /**
   * Close through the shared fade-only lifecycle. The optional resolver is
   * used after a successful navigation; cancellation restores the initiator.
   */
  close: (focusAfterClose?: FocusResolver) => void
}

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  labelledBy: string
  describedBy?: string
  initialFocusRef?: RefObject<HTMLElement>
  returnFocusTo?: RefObject<HTMLElement>
  panelClassName?: string
  scrimClassName?: string
  underlay?: ReactNode
  children: ReactNode
}

const PORTAL_ID = 'a3_dialog_root'
const layers: string[] = []
const layerListeners = new Set<() => void>()
let preservedInert = new Map<HTMLElement, boolean>()

function portalHost(create: boolean): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const current = document.getElementById(PORTAL_ID)
  if (current || !create) return current
  const host = document.createElement('div')
  host.id = PORTAL_ID
  host.dataset.a3DialogPortal = 'true'
  document.body.append(host)
  return host
}

function notifyLayers() {
  layerListeners.forEach((listener) => listener())
}

function pushLayer(id: string) {
  layers.push(id)
  notifyLayers()
}

function removeLayer(id: string) {
  const index = layers.lastIndexOf(id)
  if (index >= 0) layers.splice(index, 1)
  notifyLayers()
}

function isTopLayer(id: string): boolean {
  return layers.at(-1) === id
}

function acquireBackgroundInert(host: HTMLElement) {
  if (layers.length !== 1) return
  preservedInert = new Map()
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement) || child === host) continue
    preservedInert.set(child, Boolean(child.inert))
    child.inert = true
  }
}

function releaseBackgroundInert() {
  if (layers.length > 0) return
  preservedInert.forEach((wasInert, element) => {
    if (element.isConnected) element.inert = wasInert
  })
  preservedInert.clear()
}

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','))).filter((element) => (
    !element.hidden && element.getAttribute('aria-hidden') !== 'true'
  ))
}

function DialogLayer({
  id,
  labelledBy,
  describedBy,
  initialFocusRef,
  returnFocusTo,
  focusAfterClose,
  onRequestClose,
  panelClassName,
  scrimClassName,
  underlay,
  children,
}: Omit<DialogProps, 'open' | 'onOpenChange'> & {
  id: string
  focusAfterClose: React.MutableRefObject<FocusResolver | undefined>
  onRequestClose: () => void
}) {
  const { fadeOnly, fadeRise } = useSemanticMotion()
  const layerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const initiatorRef = useRef<HTMLElement | null>(null)
  const [top, setTop] = useState(false)

  useLayoutEffect(() => {
    const updateTop = () => setTop(isTopLayer(id))
    layerListeners.add(updateTop)
    initiatorRef.current = returnFocusTo?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    pushLayer(id)
    const host = portalHost(true)
    if (host) acquireBackgroundInert(host)
    updateTop()

    const initial = initialFocusRef?.current
      ?? dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')
      ?? dialogRef.current?.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6')
    initial?.focus()

    return () => {
      const wasTop = isTopLayer(id)
      layerListeners.delete(updateTop)
      removeLayer(id)
      releaseBackgroundInert()

      if (wasTop) {
        const focusTarget = focusAfterClose.current?.() ?? initiatorRef.current
        focusAfterClose.current = undefined
        queueMicrotask(() => {
          if (focusTarget?.isConnected) focusTarget.focus()
          const hostAfterExit = portalHost(false)
          if (layers.length === 0 && hostAfterExit?.childElementCount === 0) {
            hostAfterExit.remove()
          }
        })
      }
    }
  }, [focusAfterClose, id, initialFocusRef, returnFocusTo])

  useLayoutEffect(() => {
    if (layerRef.current) layerRef.current.inert = !top
  }, [top])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopLayer(id)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onRequestClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = focusableElements(dialog)
      if (focusables.length === 0) {
        event.preventDefault()
        ;(initialFocusRef?.current ?? dialog).focus()
        return
      }

      const initial = initialFocusRef?.current
        ?? dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')
        ?? dialog.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6')
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement

      if (active === initial) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (!dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [id, initialFocusRef, onRequestClose])

  return (
    <motion.div
      ref={layerRef}
      className={`a3-modal-scrim a3-show${scrimClassName ? ` ${scrimClassName}` : ''}`}
      variants={fadeOnly}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-hidden={top ? undefined : 'true'}
    >
      {underlay}
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal={top ? 'true' : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={panelClassName ?? 'a3-modal'}
        tabIndex={-1}
        variants={fadeRise}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

/**
 * Canonical modal lifecycle: portal, top-layer ownership, inert background,
 * immediate title focus, complete Tab/Shift+Tab trap, topmost Escape, shared
 * presence motion, and return/destination focus after exit unmount.
 */
export const Dialog = forwardRef<DialogHandle, DialogProps>(function Dialog({
  open,
  onOpenChange,
  ...layerProps
}, ref) {
  const id = useId()
  const focusAfterClose = useRef<FocusResolver>()
  const requestClose = (focus?: FocusResolver) => {
    focusAfterClose.current = focus
    onOpenChange(false)
  }

  useImperativeHandle(ref, () => ({ close: requestClose }), [onOpenChange])

  const host = portalHost(open)
  if (!host) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogLayer
          {...layerProps}
          id={id}
          focusAfterClose={focusAfterClose}
          onRequestClose={() => requestClose()}
        />
      )}
    </AnimatePresence>,
    host,
  )
})
