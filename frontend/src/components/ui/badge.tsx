import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] transition-colors',
  {
    variants: {
      tone: {
        neutral: 'border-border/70 bg-muted text-muted-foreground',
        navy: 'border-primary/15 bg-primary/10 text-primary dark:border-primary/25 dark:text-foreground',
        gold: 'border-accent/25 bg-accent/10 text-accent dark:text-accent',
        success:
          'border-success/25 bg-success/10 text-success dark:border-success/30 dark:text-success',
        warning:
          'border-warning/30 bg-warning/10 text-warning dark:border-warning/30 dark:text-warning',
        danger:
          'border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/30 dark:text-destructive',
        info: 'border-info/25 bg-info/10 text-info dark:border-info/30 dark:text-info',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
