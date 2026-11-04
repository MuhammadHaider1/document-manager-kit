import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'

export function Logo({
  className,
  compact = false,
  to = '/',
}: {
  className?: string
  compact?: boolean
  to?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      aria-label={`${APP_NAME} home`}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm dark:bg-primary/90">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M6 3.5h8l4 4v13H6z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path
            d="M9 12h6M9 15.5h4"
            stroke="hsl(var(--accent))"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.15rem] font-semibold tracking-tight">
            {APP_NAME}
          </span>
          <span className="mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Legal workspace
          </span>
        </span>
      )}
    </Link>
  )
}
