import { AlertTriangle, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  error: unknown
  title?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

function describe(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        icon: ShieldAlert,
        title: "You don't have permission",
        message:
          'Your role in this organization does not include access to this area. Ask an administrator if you need it.',
        retryable: false,
      }
    }
    if (error.isNetwork) {
      return {
        icon: WifiOff,
        title: 'Cannot reach the server',
        message: 'Check your connection. The request was not sent.',
        retryable: true,
      }
    }
    return {
      icon: AlertTriangle,
      title: error.isServer ? 'Something went wrong on our side' : 'Request failed',
      message: error.message,
      retryable: !error.isValidation,
    }
  }
  return {
    icon: AlertTriangle,
    title: 'Something went wrong',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: true,
  }
}

export function ErrorState({ error, title, onRetry, className, compact }: ErrorStateProps) {
  const info = describe(error)
  const Icon = info.icon

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 text-center',
        compact ? 'py-8' : 'py-14',
        className
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h3 className="font-display text-lg">{title ?? info.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{info.message}</p>
      </div>
      {onRetry && info.retryable && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw />
          Try again
        </Button>
      )}
    </div>
  )
}
