import { DOCUMENT_STATUS_META } from '@/lib/constants'
import { titleCase } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = DOCUMENT_STATUS_META[status]
  const label = meta?.label ?? titleCase(status)
  const tone = meta?.tone ?? 'neutral'

  return (
    <Badge tone={tone} className={className} title={meta?.description}>
      {status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {label}
    </Badge>
  )
}
