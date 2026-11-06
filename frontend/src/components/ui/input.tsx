import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out-soft file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/80 hover:border-ring/50 focus-visible:border-ring focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.1)] disabled:cursor-not-allowed disabled:opacity-60',
        'aria-[invalid=true]:border-destructive',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
