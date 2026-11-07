import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { LoadingIndicator } from '@/components/ui/loading-indicator'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap oc-button disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        /** Visuals for every variant live in styles/interface-primitives.css (@layer components), so the
         * glass pill is the default and call-site utilities still override it. */
        default: '',
        destructive: '',
        outline: '',
        secondary: '',
        ghost: '',
        accent: '',
        link: '',
        /** Light glass pill; same as outline. */
        glass: '',
        /** Navy glass pill; same as default. */
        'glass-primary': '',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3 has-[>.oc-button-content>svg]:px-3',
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5 has-[>.oc-button-content>svg]:px-2.5',
        lg: 'h-11 px-6 has-[>svg]:px-4 has-[>.oc-button-content>svg]:px-4',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  children,
  disabled,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Keeps the resting content in layout while showing a decorative activity marker. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant || "default"}
      data-size={size || "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || props["aria-busy"]}
      data-loading={loading || undefined}
      // A Radix trigger composed with asChild replaces data-slot; this hook is what the button styles key on.
      data-button=""
    >
      {!asChild && loading !== undefined ? <>
        <span className="oc-button-content">{children}</span>
        {loading && <LoadingIndicator size="sm" className="oc-button-loading" />}
      </> : children}
    </Comp>
  )
}

export { Button, buttonVariants }
