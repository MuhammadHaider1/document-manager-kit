import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  Download,
  FileText,
  History,
  MessageSquare,
  RotateCcw,
  ScrollText,
  Sparkles,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotionCard } from '@/components/motion/MotionCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionNotice } from '@/components/shared/PermissionNotice'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ApiError } from '@/lib/api/errors'
import { DOCUMENT_STATUS_META } from '@/lib/constants'
import { formatBytes, formatDateTime } from '@/lib/utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useArchiveDocument, useDocument, useDocumentVersions, useRestoreDocument } from '../hooks'
import { useDocumentDownload } from '../hooks/useDocumentDownload'
import { DocumentPreview } from '../components/DocumentPreview'
import { UploadVersionDialog } from '../components/UploadVersionDialog'
import { DocumentActivity } from '../components/DocumentActivity'
import { DocumentAskPanel } from '../components/DocumentAskPanel'
import { DocumentComments } from '../components/DocumentComments'
import { latestVersion } from '../utils'

const TABS = ['overview', 'preview', 'versions', 'activity', 'ask', 'comments'] as const
type TabValue = (typeof TABS)[number]

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  )
}

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const documentQuery = useDocument(documentId)
  const versionsQuery = useDocumentVersions(documentId)
  const { can } = useCapabilities()
  const { download, pendingId } = useDocumentDownload()
  const archiveMutation = useArchiveDocument()
  const restoreMutation = useRestoreDocument()

  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)

  const document = documentQuery.data
  useDocumentTitle(document?.title ?? 'Document')

  const initialTab = searchParams.get('tab')
  const tab: TabValue = TABS.includes(initialTab as TabValue)
    ? (initialTab as TabValue)
    : 'overview'
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const versions = useMemo(() => {
    const source = versionsQuery.data ?? document?.versions ?? []
    return [...source].sort((a, b) => b.version_number - a.version_number)
  }, [versionsQuery.data, document?.versions])

  const version = latestVersion(document)

  if (documentQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (documentQuery.isError) {
    if (documentQuery.error instanceof ApiError && documentQuery.error.isNotFound) {
      return (
        <div className="space-y-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/app/documents">
              <ArrowLeft />
              Documents
            </Link>
          </Button>
          <EmptyState
            icon={FileText}
            title="Document not found"
            description="It may have been archived, or the link belongs to a different organization."
            action={
              <Button asChild variant="accent">
                <Link to="/app/documents">Back to documents</Link>
              </Button>
            }
          />
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/documents">
            <ArrowLeft />
            Documents
          </Link>
        </Button>
        <ErrorState error={documentQuery.error} onRetry={() => void documentQuery.refetch()} />
      </div>
    )
  }

  if (!document) return null

  const statusMeta = DOCUMENT_STATUS_META[document.processing_status]
  const canUpdate = can('documents:update')
  const canDelete = can('documents:delete')
  const canAsk = can('documents:create') || can('documents:update')
  const nextVersion = (versions[0]?.version_number ?? 0) + 1

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/app/documents">
          <ArrowLeft />
          Documents
        </Link>
      </Button>

      <PageHeader
        eyebrow={document.is_archived ? 'Archived document' : 'Document'}
        title={document.title}
        description={document.description ?? 'No description recorded for this document.'}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={document.processing_status} />
            {document.is_archived && <Badge tone="warning">Archived</Badge>}
            {version && (
              <span className="text-2xs text-muted-foreground">
                v{version.version_number} · {version.file_name} · {formatBytes(version.file_size)}
              </span>
            )}
          </div>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void download(document)}
              loading={pendingId === version?.id}
              disabled={!version}
            >
              <Download />
              Download
            </Button>
            {canUpdate && !document.is_archived && (
              <Button variant="accent" onClick={() => setVersionDialogOpen(true)}>
                <Upload />
                New version
              </Button>
            )}
            {document.is_archived
              ? canUpdate && (
                  <Button variant="outline" onClick={() => setRestoreOpen(true)}>
                    <RotateCcw />
                    Restore
                  </Button>
                )
              : canDelete && (
                  <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                    <Archive />
                    Archive
                  </Button>
                )}
          </>
        }
      />

      {document.processing_status === 'processing' && (
        <div className="rounded-lg border border-info/25 bg-info/5 px-3.5 py-2.5 text-xs text-muted-foreground">
          Text extraction and indexing are running. This page refreshes automatically; status badges
          update without a reload.
        </div>
      )}
      {document.processing_status === 'failed' && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-xs text-muted-foreground">
          Processing failed for the latest version. The source file is retained — upload a corrected
          version to retry indexing.
        </div>
      )}
      {document.processing_status === 'pending' && (
        <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          This document is queued for processing. Indexing begins as soon as a worker is available.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Status', value: statusMeta?.label ?? document.processing_status },
          { label: 'Versions', value: String(versions.length) },
          { label: 'Uploaded', value: formatDateTime(document.created_at) },
          { label: 'Last updated', value: formatDateTime(document.updated_at) },
        ].map((item, index) => (
          <MotionCard key={item.label} delay={0.04 + index * 0.05} className="px-4 py-3">
            <p className="label-caps">{item.label}</p>
            <p className="mt-1.5 truncate text-sm font-medium" title={item.value}>
              {item.value}
            </p>
          </MotionCard>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">
            <FileText className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="preview">
            <FileText className="h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="versions">
            <History className="h-3.5 w-3.5" />
            Versions
          </TabsTrigger>
          {can('audit:read') && (
            <TabsTrigger value="activity">
              <ScrollText className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
          )}
          <TabsTrigger value="ask">
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </TabsTrigger>
          <TabsTrigger value="comments">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <MotionCard interactive={false} delay={0.08}>
              <CardHeader>
                <CardTitle>Document record</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <MetadataRow label="Title">{document.title}</MetadataRow>
                  <MetadataRow label="Description">
                    {document.description ?? (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </MetadataRow>
                  <MetadataRow label="Processing status">
                    <span className="inline-flex items-center gap-2">
                      <StatusBadge status={document.processing_status} />
                      <span className="text-xs text-muted-foreground">
                        {statusMeta?.description ?? 'Status returned by the API.'}
                      </span>
                    </span>
                  </MetadataRow>
                  <MetadataRow label="Retention state">
                    {document.is_archived ? 'Archived — retained, not searchable' : 'Active'}
                  </MetadataRow>
                  <MetadataRow label="Organization">
                    <span className="font-mono text-xs">{document.organization_id}</span>
                  </MetadataRow>
                  <MetadataRow label="Document ID">
                    <span className="font-mono text-xs">{document.id}</span>
                  </MetadataRow>
                  <MetadataRow label="Created">{formatDateTime(document.created_at)}</MetadataRow>
                  <MetadataRow label="Last updated">
                    {formatDateTime(document.updated_at)}
                  </MetadataRow>
                </dl>
              </CardContent>
            </MotionCard>

            <div className="space-y-5">
              <MotionCard interactive={false} delay={0.12}>
                <CardHeader>
                  <CardTitle>Latest version</CardTitle>
                </CardHeader>
                <CardContent>
                  {version ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <FileTypeIcon fileName={version.file_name} mimeType={version.mime_type} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{version.file_name}</p>
                          <p className="text-2xs text-muted-foreground">
                            v{version.version_number} · {formatBytes(version.file_size)} ·{' '}
                            {version.mime_type}
                          </p>
                        </div>
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        Uploaded <RelativeTime value={version.created_at} />
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void download(document, version)}
                          loading={pendingId === version.id}
                        >
                          <Download />
                          Download
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setTab('preview')}>
                          Preview
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No file version has been stored.
                    </p>
                  )}
                </CardContent>
              </MotionCard>

              <MotionCard interactive={false} delay={0.16}>
                <CardHeader>
                  <CardTitle>Version history</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {versions.slice(0, 4).map((entry) => (
                      <li key={entry.id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
                          {entry.version_number}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{entry.file_name}</p>
                          <p className="text-2xs text-muted-foreground">
                            <RelativeTime value={entry.created_at} />
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 px-0"
                    onClick={() => setTab('versions')}
                  >
                    View all {versions.length} versions
                  </Button>
                </CardContent>
              </MotionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <DocumentPreview document={document} version={version} />
        </TabsContent>

        <TabsContent value="versions">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg">Version lineage</h2>
                <p className="text-sm text-muted-foreground">
                  Every upload is retained immutably with its own file and timestamp.
                </p>
              </div>
              {canUpdate && !document.is_archived && (
                <Button variant="accent" size="sm" onClick={() => setVersionDialogOpen(true)}>
                  <Upload />
                  Upload v{nextVersion}
                </Button>
              )}
            </div>

            {versionsQuery.isError ? (
              <ErrorState
                error={versionsQuery.error}
                compact
                onRetry={() => void versionsQuery.refetch()}
              />
            ) : versions.length === 0 ? (
              <EmptyState
                icon={History}
                title="No versions recorded"
                description="Upload a file to create the first version of this document."
              />
            ) : (
              <ol className="space-y-3">
                {versions.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card transition-[border-color,box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-raised sm:flex-row sm:items-center"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary dark:text-foreground">
                      v{entry.version_number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.file_name}</p>
                      <p className="text-2xs text-muted-foreground">
                        {formatBytes(entry.file_size)} · {entry.mime_type} · uploaded{' '}
                        <RelativeTime value={entry.created_at} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {index === 0 && <Badge tone="gold">Current</Badge>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void download(document, entry)}
                        loading={pendingId === entry.id}
                      >
                        <Download />
                        Download
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>

        {can('audit:read') && (
          <TabsContent value="activity">
            <DocumentActivity documentId={document.id} />
          </TabsContent>
        )}

        <TabsContent value="ask">
          {canAsk ? (
            <DocumentAskPanel document={document} />
          ) : (
            <PermissionNotice message="Your role can read this document but cannot run AI queries. Ask an administrator for Contributor access." />
          )}
        </TabsContent>

        <TabsContent value="comments">
          <DocumentComments documentId={document.id} canWrite={can('comments:write')} />
        </TabsContent>
      </Tabs>

      <UploadVersionDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        documentId={document.id}
        documentTitle={document.title}
        nextVersionNumber={nextVersion}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this document?"
        description="It will be removed from the active list and from Ask AI results. Versions, comments and audit records are retained."
        confirmLabel="Archive document"
        destructive
        onConfirm={async () => {
          try {
            await archiveMutation.mutateAsync(document.id)
            toast.success('Document archived.')
          } catch (error) {
            toast.error(
              error instanceof ApiError ? error.message : 'Could not archive the document.'
            )
          }
        }}
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore this document?"
        description="The document will return to the active list and become available to Ask AI again."
        confirmLabel="Restore document"
        onConfirm={async () => {
          try {
            await restoreMutation.mutateAsync(document.id)
            toast.success('Document restored.')
          } catch (error) {
            toast.error(
              error instanceof ApiError ? error.message : 'Could not restore the document.'
            )
          }
        }}
      />
    </div>
  )
}
