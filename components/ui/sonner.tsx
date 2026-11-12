'use client'

import type { CSSProperties } from 'react'
import { CheckCircle2, Info, TriangleAlert, XCircle } from '@/components/icons'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ style, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      icons={{ success: <CheckCircle2 size={20} />, info: <Info size={20} />, warning: <TriangleAlert size={20} />, error: <XCircle size={20} />, loading: <LoadingIndicator size="lg" /> }}
      offset={{ bottom: "var(--oc-toast-offset, 24px)" }}
      mobileOffset={{ bottom: "var(--oc-toast-offset, 24px)", left: "16px", right: "16px" }}
      className="toaster group"
      // --normal-bg is a glass material, not a colour, so Sonner's default action (Undo) would draw text the colour of its fill.
      toastOptions={{ actionButtonStyle: { background: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 'var(--oc-radius-full)', fontWeight: 600 }, ...props.toastOptions }}
      style={
        {
          '--normal-bg': 'var(--oc-glass-frosted-material)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--oc-glass-light-edge)',
          '--success-bg': 'var(--success-subtle)',
          '--success-text': 'var(--success)',
          '--success-border': 'var(--border)',
          '--error-bg': 'var(--error-subtle)',
          '--error-text': 'var(--destructive)',
          '--error-border': 'var(--border)',
          '--warning-bg': 'var(--warning-subtle)',
          '--warning-text': 'var(--warning)',
          '--warning-border': 'var(--border)',
          '--info-bg': 'var(--info-subtle)',
          '--info-text': 'var(--info)',
          '--info-border': 'var(--border)',
          '--border-radius': 'var(--oc-radius-lg)',
          zIndex: 'var(--oc-z-toast)',
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
