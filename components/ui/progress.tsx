'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

function Progress({ className, value, max = 100, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100
  const bounded = typeof value === 'number' && Number.isFinite(value) ? Math.min(limit, Math.max(0, value)) : null
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn('bg-muted relative h-1.5 w-full overflow-hidden rounded-full', className)} {...props} max={limit} value={bounded}>
      <ProgressPrimitive.Indicator data-slot="progress-indicator" className={cn('bg-primary h-full w-full transition-transform motion-ui', bounded === null && 'animate-pulse')} style={{ transform: `translateX(-${bounded === null ? 65 : 100 - bounded / limit * 100}%)` }} />
    </ProgressPrimitive.Root>
  )
}
export { Progress }
