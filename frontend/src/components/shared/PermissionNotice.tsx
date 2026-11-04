import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PermissionNotice({
  message = 'Your role does not allow this action. Ask an organization administrator if you need access.',
  className,
}: {
  message?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-3 text-sm text-foreground',
        className
      )}
      role="note"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="leading-relaxed">{message}</p>
    </div>
  )
}
