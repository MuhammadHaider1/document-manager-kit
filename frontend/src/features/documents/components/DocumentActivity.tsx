import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { Skeleton } from '@/components/ui/skeleton'
import { auditApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { titleCase } from '@/lib/utils'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'

/**
 * Audit entries can be filtered by entity type but not by entity id, so this
 * view requests the latest document events for the organization and narrows
 * them to this document. See "Backend gaps".
 */
export function DocumentActivity({ documentId }: { documentId: string }) {
  const { activeOrganizationId } = useActiveOrganization()

  const auditQuery = useQuery({
    queryKey: queryKeys.audit(activeOrganizationId, {
      entity_type: 'DOCUMENT',
      limit: 100,
      documentId,
    }),
    queryFn: () =>
      auditApi.list({
        organization_id: activeOrganizationId!,
        entity_type: 'DOCUMENT',
        limit: 100,
        offset: 0,
      }),
    enabled: Boolean(activeOrganizationId),
  })

  const entries = useMemo(
    () => (auditQuery.data ?? []).filter((entry) => entry.entity_id === documentId),
    [auditQuery.data, documentId]
  )

  if (auditQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (auditQuery.isError) {
    return <ErrorState error={auditQuery.error} compact onRetry={() => void auditQuery.refetch()} />
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No recorded activity"
        description="Uploads, version changes and archive actions for this document appear here with the actor and timestamp."
      />
    )
  }

  return (
    <div className="space-y-1">
      <p className="mb-3 text-xs text-muted-foreground">
        {entries.length} {entries.length === 1 ? 'event' : 'events'} in the latest 100 document
        audit records.
      </p>
      <ol className="relative ml-2 space-y-4 border-l border-border/80 pl-5">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            <span
              className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full border-2 border-card bg-accent"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[0.8125rem] font-medium">{titleCase(entry.action)}</p>
              <RelativeTime value={entry.created_at} className="text-2xs text-muted-foreground" />
            </div>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {entry.user_id ? `User ${entry.user_id.slice(0, 8)}…` : 'System'}
              {entry.ip_address ? ` · ${entry.ip_address}` : ''}
            </p>
            {entry.details && (
              <details className="mt-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5">
                <summary className="cursor-pointer text-2xs font-medium text-muted-foreground">
                  Event detail
                </summary>
                <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-2xs text-foreground/80">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
