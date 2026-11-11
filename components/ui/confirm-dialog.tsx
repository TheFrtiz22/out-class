'use client'

import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The one confirmation surface for OutClass, in place of the browser's native confirm. */
export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  /** A specific verb phrase, e.g. "Delete round", never "OK". */
  confirmLabel: string
  cancelLabel?: string
  /** "danger" styles the action as destructive and starts focus on Cancel. */
  tone?: 'default' | 'danger'
  /** Requests with the same key share one dialog and one answer. Defaults to title + confirmLabel. */
  key?: string
  /**
   * Where focus goes when the dialog closes. Defaults to the element that asked; a menu item
   * (which unmounts with its menu) hands focus back to the menu's trigger instead.
   */
  returnFocus?: HTMLElement | null | { readonly current: HTMLElement | null }
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

type Pending = { id: number; options: ConfirmOptions; trigger: HTMLElement | null }
type Entry = Pending & { key: string; promise: Promise<boolean>; resolve: (ok: boolean) => void }

/** The element focus should return to, captured when the confirm is requested. */
export function confirmReturnTarget(active: Element | null, returnFocus?: ConfirmOptions['returnFocus']): HTMLElement | null {
  const explicit = returnFocus && 'current' in returnFocus ? returnFocus.current : returnFocus
  if (explicit) return explicit
  if (!active || typeof document === 'undefined' || active === document.body || !('focus' in active)) return null
  // Menu items unmount with their menu. Radix labels the menu by its trigger's generated id
  // and the open trigger controls the menu; the latter still holds if the trigger sets its own id.
  const menu = active.closest('[role="menu"]')
  const triggerId = menu?.getAttribute('aria-labelledby')
  const menuTrigger = !menu ? null
    : (triggerId ? document.getElementById(triggerId) : null)
      ?? (menu.id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`) : null)
  return menuTrigger ?? (active as HTMLElement)
}

/**
 * Framework-free request queue behind the provider: one dialog at a time, each
 * request resolves exactly once, a repeated request (same key) shares the open
 * or queued one, and stale settles (by id) are ignored.
 */
export function createConfirmController(onChange: (current: Pending | null) => void) {
  const queue: Entry[] = []
  let current: Entry | null = null
  let nextId = 1
  function advance() {
    current = queue.shift() ?? null
    onChange(current && { id: current.id, options: current.options, trigger: current.trigger })
  }
  return {
    request(options: ConfirmOptions) {
      const key = options.key ?? `${options.title}\u0000${options.confirmLabel}`
      const existing = [current, ...queue].find((entry) => entry?.key === key)
      if (existing) return existing.promise
      let resolve!: (ok: boolean) => void
      const promise = new Promise<boolean>((done) => { resolve = done })
      const active = typeof document === 'undefined' ? null : document.activeElement
      queue.push({ id: nextId++, key, options, trigger: confirmReturnTarget(active, options.returnFocus), promise, resolve })
      if (!current) advance()
      return promise
    },
    settle(id: number, ok: boolean) {
      if (!current || current.id !== id) return
      const done = current
      current = null
      done.resolve(ok)
      advance()
    },
    cancelAll() {
      const all = current ? [current, ...queue] : [...queue]
      queue.length = 0
      current = null
      for (const entry of all) entry.resolve(false)
    },
  }
}

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

/** Returns an awaitable confirm: `if (!(await confirm({ ... }))) return`. */
export function useConfirm(): ConfirmFn {
  const confirm = React.useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>.')
  return confirm
}

/**
 * useConfirm for components whose confirmed actions have no busy state of their own:
 * while this component's confirm is open, further requests resolve false, so a double
 * click can never run the action twice.
 */
export function useConfirmOnce(): ConfirmFn {
  const confirm = useConfirm()
  const open = React.useRef(false)
  return React.useCallback<ConfirmFn>(async (options) => {
    if (open.current) return false
    open.current = true
    try { return await confirm(options) } finally { open.current = false }
  }, [confirm])
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [controller] = React.useState(() => createConfirmController(setPending))
  // Keep the last request's copy on screen while the close animation runs.
  const shown = React.useRef<Pending | null>(null)
  if (pending) shown.current = pending
  const openedFrom = React.useRef<HTMLElement | null>(null)
  const action = React.useRef<HTMLButtonElement>(null)

  React.useLayoutEffect(() => {
    // Runs before the dialog's focus scope moves focus, so this is the element to return to.
    if (pending && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) openedFrom.current = document.activeElement
  }, [pending])
  React.useEffect(() => () => controller.cancelAll(), [controller])

  const confirm = React.useCallback<ConfirmFn>((options) => controller.request(options), [controller])
  const view = pending ?? shown.current
  const danger = view?.options.tone === 'danger'
  const cancel = () => { if (pending) controller.settle(pending.id, false) }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) cancel() }}>
        {view && (
          <AlertDialogContent
            data-confirm-tone={danger ? 'danger' : 'default'}
            className="motion-reduce:animate-none sm:max-w-md"
            overlayProps={{ className: 'motion-reduce:animate-none', onClick: cancel }}
            // Title-only confirms have no description; tell Radix not to expect one.
            {...(view.options.description ? {} : { 'aria-describedby': undefined })}
            onOpenAutoFocus={(event) => {
              // Radix focuses Cancel by default; that is the safer choice for danger.
              if (danger) return
              event.preventDefault()
              action.current?.focus({ preventScroll: true })
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const target = [view.trigger, openedFrom.current].find((el) => el?.isConnected)
              openedFrom.current = null
              target?.focus({ preventScroll: true })
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{view.options.title}</AlertDialogTitle>
              {view.options.description && <AlertDialogDescription>{view.options.description}</AlertDialogDescription>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{view.options.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                ref={action}
                data-variant={danger ? 'destructive' : 'default'}
                className={cn(danger && buttonVariants({ variant: 'destructive' }))}
                onClick={() => { if (pending) controller.settle(pending.id, true) }}
              >
                {view.options.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
