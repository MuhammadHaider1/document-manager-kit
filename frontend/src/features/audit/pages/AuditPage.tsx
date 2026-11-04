import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Download, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { auditApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { cn, downloadTextFile, formatDateTime, titleCase, toCsv } from '@/lib/utils'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { AuditLog } from '@/types/domain'

const PAGE_SIZE = 25

const ENTITY_TYPES = [
  { value: 'ALL', label: 'All entity types' },
  { value: 'DOCUMENT', label: 'Documents' },
  { value: 'DOCUMENT_VERSION', label: 'Document versions' },
  { value: 'FOLDER', label: 'Folders' },
] as const

function ActionBadge({ action }: { action: string }) {
  const destructive = /DELETE|ARCHIVE|REVOKE/i.test(action)
  const create = /CREATE|UPLOAD|RESTORE/i.test(action)
  return (
    <Badge tone={destructive ? 'danger' : create ? 'success' : 'neutral'}>
      {titleCase(action)}
    </Badge>
  )
}

function DetailsCell({ entry }: { entry: AuditLog }) {
  if (!entry.details) {
    return <span className="text-2xs text-muted-foreground">No detail recorded</span>
  }
  return (
    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-2.5 font-mono text-2xs text-foreground/80">
      {JSON.stringify(entry.details, null, 2)}
    </pre>
  )
}

export function AuditPage() {
  useDocumentTitle('Audit log')
  const { activeOrganization } = useActiveOrganization()
  const { roleName } = useCapabilities()

  const [entityType, setEntityType] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const offset = (page - 1) * PAGE_SIZE

  const auditQuery = useQuery({
    queryKey: queryKeys.audit(activeOrganization?.id ?? null, {
      limit: PAGE_SIZE,
      offset,
      entity_type: entityType === 'ALL' ? null : entityType,
    }),
    queryFn: () =>
      auditApi.list({
        organization_id: activeOrganization!.id,
        limit: PAGE_SIZE,
        offset,
        entity_type: entityType === 'ALL' ? undefined : entityType,
      }),
    enabled: Boolean(activeOrganization?.id),
    placeholderData: (previous) => previous,
  })

  const entries = auditQuery.data ?? []
  const hasNext = entries.length === PAGE_SIZE
  const hasPrevious = page > 1

  const expandableCount = entries.filter((entry) => Boolean(entry.details)).length

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportCsv = () => {
    if (entries.length === 0) return
    const csv = toCsv(
      entries.map((entry) => ({
        created_at: entry.created_at,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id ?? '',
        user_id: entry.user_id ?? '',
        ip_address: entry.ip_address ?? '',
        details: entry.details ?? '',
      })),
      ['created_at', 'action', 'entity_type', 'entity_id', 'user_id', 'ip_address', 'details']
    )
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `docuflow-audit-${activeOrganization?.slug ?? 'organization'}-${stamp}-p${page}.csv`,
      csv,
      'text/csv'
    )
  }

  const rangeStart = entries.length === 0 ? 0 : offset + 1
  const rangeEnd = offset + entries.length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={activeOrganization?.name ?? 'Organization'}
        title="Audit log"
        description="An append-only record of document, folder and version activity in this organization, with actor, IP address and timestamp."
        context={
          <Badge tone="gold">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            {roleName ? `Viewing as ${roleName}` : 'Permission checked by the API'}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void auditQuery.refetch()}
              loading={auditQuery.isFetching && !auditQuery.isLoading}
            >
              <RefreshCw />
              Refresh
            </Button>
            <Button variant="accent" onClick={exportCsv} disabled={entries.length === 0}>
              <Download />
              Export page as CSV
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={entityType}
            onValueChange={(value) => {
              setEntityType(value)
              setPage(1)
              setExpanded(new Set())
            }}
          >
            <SelectTrigger className="w-[13.5rem]" aria-label="Filter by entity type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {entityType !== 'ALL' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-2xs"
              onClick={() => {
                setEntityType('ALL')
                setPage(1)
              }}
            >
              Clear filter
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {auditQuery.isLoading
            ? 'Loading audit records…'
            : entries.length === 0
              ? 'No records on this page'
              : `Showing ${rangeStart}–${rangeEnd} · ${entries.length} records · ${expandableCount} with detail`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
        {auditQuery.isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="ml-auto h-3 w-24" />
              </div>
            ))}
          </div>
        ) : auditQuery.isError ? (
          <ErrorState
            error={auditQuery.error}
            className="rounded-none border-0 shadow-none"
            onRetry={() => void auditQuery.refetch()}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={entityType === 'ALL' ? 'No audit events yet' : 'No events for this entity type'}
            description={
              entityType === 'ALL'
                ? 'Actions such as uploads, new versions, folder changes, archives and restores will appear here as they happen.'
                : 'Try a different entity type, or clear the filter to see all recorded activity.'
            }
            className="rounded-none border-0 bg-transparent"
            action={
              entityType !== 'ALL' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEntityType('ALL')
                    setPage(1)
                  }}
                >
                  Clear filter
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border/60 md:hidden">
              {entries.map((entry) => {
                const isOpen = expanded.has(entry.id)
                return (
                  <div key={entry.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <ActionBadge action={entry.action} />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {titleCase(entry.entity_type)}
                          {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}…` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        <RelativeTime value={entry.created_at} />
                      </span>
                    </div>
                    {entry.details && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 px-1.5 text-2xs"
                          onClick={() => toggle(entry.id)}
                          aria-expanded={isOpen}
                        >
                          <ChevronDown
                            className={cn('transition-transform', isOpen && 'rotate-180')}
                          />
                          {isOpen ? 'Hide detail' : 'Show detail'}
                        </Button>
                        {isOpen && (
                          <div className="mt-2">
                            <DetailsCell entry={entry} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead className="hidden lg:table-cell">IP address</TableHead>
                    <TableHead className="w-12 pr-5">
                      <span className="sr-only">Detail</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const isOpen = expanded.has(entry.id)
                    return (
                      <TableRow key={entry.id} className="align-top">
                        <TableCell className="whitespace-nowrap pl-5">
                          <span
                            className="text-xs font-medium"
                            title={formatDateTime(entry.created_at)}
                          >
                            <RelativeTime value={entry.created_at} />
                          </span>
                          <span className="mt-0.5 block text-2xs text-muted-foreground">
                            {formatDateTime(entry.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={entry.action} />
                        </TableCell>
                        <TableCell>
                          <p className="text-xs">{titleCase(entry.entity_type)}</p>
                          {entry.entity_id && (
                            <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                              {entry.entity_id.slice(0, 8)}…
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.user_id ? (
                            <span className="font-mono text-2xs text-muted-foreground">
                              {entry.user_id.slice(0, 8)}…
                            </span>
                          ) : (
                            <span className="text-2xs text-muted-foreground">System</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="font-mono text-2xs text-muted-foreground">
                            {entry.ip_address ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          {entry.details && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => toggle(entry.id)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? 'Hide event detail' : 'Show event detail'}
                            >
                              <ChevronDown
                                className={cn('transition-transform', isOpen && 'rotate-180')}
                              />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {[...expanded].length > 0 && (
              <div className="space-y-3 border-t border-border/70 bg-muted/20 p-4 sm:p-5">
                {entries
                  .filter((entry) => expanded.has(entry.id))
                  .map((entry) => (
                    <div key={entry.id} className="space-y-2">
                      <p className="text-2xs font-medium text-muted-foreground">
                        {titleCase(entry.action)} · {formatDateTime(entry.created_at)}
                      </p>
                      <DetailsCell entry={entry} />
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      <nav
        aria-label="Audit pagination"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-2xs leading-relaxed text-muted-foreground">
          The API does not return a total audit count, so pages are navigated forward and backward.
          {entries.length === PAGE_SIZE ? ' A full page means more records may follow.' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((current) => Math.max(1, current - 1))
              setExpanded(new Set())
            }}
            disabled={!hasPrevious || auditQuery.isFetching}
          >
            Previous
          </Button>
          <span className="px-1 text-xs text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((current) => current + 1)
              setExpanded(new Set())
            }}
            disabled={!hasNext || auditQuery.isFetching}
          >
            Next
          </Button>
        </div>
      </nav>
    </div>
  )
}
