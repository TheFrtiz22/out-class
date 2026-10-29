import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('oc-skeleton rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
