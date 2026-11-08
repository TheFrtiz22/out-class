import { cn } from '@/lib/utils'

function Skeleton({ className, variant = 'glass', ...props }: React.ComponentProps<'div'> & { variant?: 'default' | 'glass' }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      data-variant={variant === 'glass' ? 'glass' : undefined}
      className={cn('oc-skeleton rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
