import { formatDateTime, relativeTime } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function RelativeTime({
  value,
  className,
  fallback = '—',
}: {
  value: string | null | undefined
  className?: string
  fallback?: string
}) {
  if (!value) return <span className={className}>{fallback}</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={value} className={className}>
          {relativeTime(value)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(value)}</TooltipContent>
    </Tooltip>
  )
}
