'use client'

import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ style, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      offset={{ bottom: "var(--oc-toast-offset, 24px)" }}
      mobileOffset={{ bottom: "var(--oc-toast-offset, 24px)", left: "16px", right: "16px" }}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
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
