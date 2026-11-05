import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Info, RefreshCw, RotateCcw, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { PageHeader } from '@/components/shared/PageHeader'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApiError } from '@/lib/api/errors'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRestoreDocument } from '@/features/documents/hooks'
import { latestVersion } from '@/features/documents/utils'
import { useArchivedDocuments, type ArchivedDocumentEntry } from '../hooks'
import { RestoreByIdDialog } from '../components/RestoreByIdDialog'

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function ArchivedDocumentsPage() {
  useDocumentTitle('Archive')
  const queryClient = useQueryClient()
  const { activeOrganization } = useActiveOrganization()
  const { can, isLoading: roleLoading } = useCapabilities()
  const { canReadAudit, auditQuery, documentsQuery, items, failed, scannedEvents, isLoading } =
    useArchivedDocuments()

  const canRestore = !roleLoading && can('documents:update')
  const restore = useRestoreDocument()

  const [restoreTarget, setRestoreTarget] = useState<ArchivedDocumentEntry | null>(null)
  const [restoreByIdOpen, setRestoreByIdOpen] = useState(false)

  const refresh = () => {
    void auditQuery.refetch()
    if (items.length > 0) void documentsQuery.refetch()
  }

  const confirmRestore = async () => {
    if (!restoreTarget) return
    try {
      await restore.mutateAsync(restoreTarget.document.id)
      toast.success(`“${restoreTarget.document.title}” restored.`)
      void queryClient.invalidateQueries({ queryKey: ['archive'] })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
      setRestoreTarget(null)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The document could not be restored.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={activeOrganization?.name ?? 'Workspace'}
        title="Archive"
        description="Restore documents that were removed from the active register. Archived documents keep their versions and audit history but do not appear in search or Ask AI results."
        actions={
          <>
            <Button
              variant="outline"
              onClick={refresh}
              loading={(auditQuery.isFetching || documentsQuery.isFetching) && !isLoading}
            >
              <RefreshCw />
              Refresh
            </Button>
            <Button
              variant="accent"
              onClick={() => setRestoreByIdOpen(true)}
              disabled={!canRestore}
              title={
                canRestore
                  ? 'Restore an archived document by its UUID'
                  : 'Your role cannot restore documents'
              }
            >
              <RotateCcw />
              Restore by ID
            </Button>
          </>
        }
      />

      {!canReadAudit && !roleLoading ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            Your role cannot read the audit log, and archive events are only recorded there. Use{' '}
            <span className="font-medium text-foreground">Restore by ID</span> with the
            document&apos;s UUID, or ask an administrator to restore it.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <div className="space-y-1">
            <p>
              The API has no archived-document listing, so this view replays the{' '}
              {scannedEvents > 0 ? `${scannedEvents} most recent` : 'most recent'} document archive
              and restore events, then verifies each candidate. Documents archived before that audit
              window may not appear.
            </p>
            <p>
              {canRestore
                ? 'Restoring returns the document to the active register and Ask AI index.'
                : 'Your role can view this page but cannot restore documents.'}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Recoverable documents
            </CardTitle>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {roleLoading || isLoading
                ? 'Reconstructing the archive from audit history…'
                : `${items.length} archived ${
                    items.length === 1 ? 'document' : 'documents'
                  } found in the recent audit window`}
              {failed > 0 && (
                <span className="text-warning">
                  {' '}
                  · {failed} {failed === 1 ? 'entry' : 'entries'} could not be loaded
                </span>
              )}
            </p>
          </div>
          {canReadAudit && (
            <Badge tone="outline">
              <ArchiveRestore className="h-3 w-3" aria-hidden="true" />
              Audit-derived
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {roleLoading || isLoading ? (
            <TableSkeleton />
          ) : !canReadAudit ? (
            <EmptyState
              icon={SearchX}
              title="Archive list unavailable to your role"
              description="Archive events live in the audit log. Without audit access the only recovery path is to restore a known document ID."
              action={
                canRestore ? (
                  <Button variant="outline" onClick={() => setRestoreByIdOpen(true)}>
                    <RotateCcw />
                    Restore by ID
                  </Button>
                ) : undefined
              }
              className="rounded-none border-0 bg-transparent"
            />
          ) : auditQuery.isError ? (
            <ErrorState
              error={auditQuery.error}
              className="rounded-none border-0 shadow-none"
              onRetry={() => void auditQuery.refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="No archived documents found"
              description="Nothing in the recent audit window is currently archived. If you know a document was archived earlier, restore it by ID."
              action={
                canRestore ? (
                  <Button variant="outline" onClick={() => setRestoreByIdOpen(true)}>
                    <RotateCcw />
                    Restore by ID
                  </Button>
                ) : undefined
              }
              className="rounded-none border-0 bg-transparent"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead className="hidden sm:table-cell">Archived</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => {
                  const version = latestVersion(entry.document)
                  return (
                    <TableRow key={entry.document.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileTypeIcon fileName={version?.file_name} />
                          <div className="min-w-0">
                            <Link
                              to={`/app/documents/${entry.document.id}`}
                              className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {entry.document.title}
                            </Link>
                            <p className="truncate text-2xs text-muted-foreground">
                              Archived document · {entry.document.id.slice(0, 8)}…
                            </p>
                            <p className="mt-0.5 text-2xs text-muted-foreground sm:hidden">
                              Archived <RelativeTime value={entry.candidate.archivedAt} />
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                        <RelativeTime value={entry.candidate.archivedAt} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge status={entry.document.processing_status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {canRestore ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRestoreTarget(entry)}
                            aria-label={`Restore ${entry.document.title}`}
                          >
                            <RotateCcw />
                            Restore
                          </Button>
                        ) : (
                          <span className="text-2xs text-muted-foreground">
                            Requires restore permission
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null)
        }}
        title="Restore this document?"
        description={
          <>
            <span className="font-medium text-foreground">{restoreTarget?.document.title}</span>{' '}
            will return to the active document register and Ask AI results. Versions, comments and
            audit records are retained.
          </>
        }
        confirmLabel="Restore document"
        onConfirm={confirmRestore}
      />

      <RestoreByIdDialog open={restoreByIdOpen} onOpenChange={setRestoreByIdOpen} />
    </div>
  )
}
