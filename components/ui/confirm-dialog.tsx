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
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

type Pending = { id: number; options: ConfirmOptions; trigger: HTMLElement | null }
type Entry = Pending & { resolve: (ok: boolean) => void }

/**
 * Framework-free request queue behind the provider: one dialog at a time, each
 * request resolves exactly once, and stale settles (by id) are ignored.
 */
export function createConfirmController(onChange: (current: Pending | null) => void) {
  const queue: Entry[] = []
  let current: Entry | null = null
  let nextId = 1
  const activeElement = () => {
    if (typeof document === 'undefined') return null
    const el = document.activeElement
    return el && el !== document.body && 'focus' in el ? (el as HTMLElement) : null
  }
  function advance() {
    current = queue.shift() ?? null
    onChange(current && { id: current.id, options: current.options, trigger: current.trigger })
  }
  return {
    request(options: ConfirmOptions) {
      return new Promise<boolean>((resolve) => {
        queue.push({ id: nextId++, options, trigger: activeElement(), resolve })
        if (!current) advance()
      })
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
