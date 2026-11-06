import { cn } from '@/lib/utils'

function Skeleton({ className, variant, ...props }: React.ComponentProps<'div'> & { variant?: 'default' | 'glass' }) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant === 'glass' ? 'glass' : undefined}
      aria-hidden="true"
      className={cn('oc-skeleton rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
