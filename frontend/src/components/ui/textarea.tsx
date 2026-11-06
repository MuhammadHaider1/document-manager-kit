import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[92px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out-soft placeholder:text-muted-foreground/80 hover:border-ring/50 focus-visible:border-ring focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.1)] disabled:cursor-not-allowed disabled:opacity-60',
      'aria-[invalid=true]:border-destructive',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
