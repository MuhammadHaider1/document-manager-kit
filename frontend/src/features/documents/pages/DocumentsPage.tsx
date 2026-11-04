import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, FileStack, Search, Sparkles, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { PermissionNotice } from '@/components/shared/PermissionNotice'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { documentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { DOCUMENT_PAGE_SIZE } from '@/lib/constants'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import type { Document, Folder } from '@/types/domain'
import { useDocuments, useFolderTree } from '../hooks'
import { useDocumentDownload } from '../hooks/useDocumentDownload'
import { DocumentsTable, type DocumentSort, type SortOrder } from '../components/DocumentsTable'
import { FolderPanel } from '../components/FolderPanel'
import { UploadDialog } from '../components/UploadDialog'

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  )
}

export function DocumentsPage() {
  useDocumentTitle('Documents')
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { can, isLoading: roleLoading } = useCapabilities()
  const { download, pendingId } = useDocumentDownload()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)
  const [page, setPage] = useState(1)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<DocumentSort>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [documentToArchive, setDocumentToArchive] = useState<Document | null>(null)
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(searchParams.get('upload') === '1')

  const canUpload = can('documents:create')
  const canDelete = can('documents:delete')

  const foldersQuery = useFolderTree()
  const documentsQuery = useDocuments({
    q: debouncedSearch.trim() || undefined,
    folder_id: folderId ?? undefined,
    page,
    page_size: DOCUMENT_PAGE_SIZE,
    sort_by: sortBy,
    sort_order: sortOrder,
  })

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [debouncedSearch, folderId, sortBy, sortOrder])

  useEffect(() => {
    if (searchParams.get('upload') === '1') {
      setUploadOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('upload')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    setSelected(new Set())
  }, [page])

  const documents = useMemo(() => documentsQuery.data?.items ?? [], [documentsQuery.data])
  const total = documentsQuery.data?.total ?? 0
  const totalPages = documentsQuery.data?.total_pages ?? 0
  const hasFilters = Boolean(debouncedSearch.trim() || folderId)

  const selectedDocuments = useMemo(
    () => documents.filter((document) => selected.has(document.id)),
    [documents, selected]
  )

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((current) => {
      const allSelected =
        documents.length > 0 && documents.every((document) => current.has(document.id))
      return allSelected ? new Set() : new Set(documents.map((document) => document.id))
    })
  }

  const handleSort = (column: DocumentSort) => {
    if (column === sortBy) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder(column === 'title' ? 'asc' : 'desc')
    }
  }

  const archiveDocument = async () => {
    if (!documentToArchive) return
    setArchiving(true)
    try {
      await documentsApi.archive(documentToArchive.id)
      toast.success(`“${documentToArchive.title}” archived.`)
      setDocumentToArchive(null)
      setSelected((current) => {
        const next = new Set(current)
        next.delete(documentToArchive.id)
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not archive the document.')
    } finally {
      setArchiving(false)
    }
  }

  const archiveSelected = async () => {
    if (selectedDocuments.length === 0) return
    setArchiving(true)
    const results = await Promise.allSettled(
      selectedDocuments.map((document) => documentsApi.archive(document.id))
    )
    const failures = results.filter((result) => result.status === 'rejected').length
    const successes = results.length - failures

    if (successes > 0) {
      toast.success(`${successes} ${successes === 1 ? 'document' : 'documents'} archived.`)
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    }
    if (failures > 0) {
      toast.error(`${failures} ${failures === 1 ? 'document' : 'documents'} could not be archived.`)
    }
    setSelected(new Set())
    setBulkArchiveOpen(false)
    setArchiving(false)
  }

  const clearFilters = () => {
    setSearch('')
    setFolderId(null)
    setPage(1)
  }

  const activeFolderName = useMemo(() => {
    if (!folderId) return null
    const walk = (folders: Folder[]): string | null => {
      for (const folder of folders) {
        if (folder.id === folderId) return folder.name
        const found = walk(folder.children ?? [])
        if (found) return found
      }
      return null
    }
    return walk(foldersQuery.data ?? [])
  }, [folderId, foldersQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        description="Every contract, pleading and piece of correspondence in this organization — searchable and versioned."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/app/ask">
                <Sparkles />
                Ask AI
              </Link>
            </Button>
            {roleLoading ? (
              <Button variant="outline" loading disabled>
                <Upload />
                Upload
              </Button>
            ) : canUpload ? (
              <Button variant="accent" onClick={() => setUploadOpen(true)}>
                <Upload />
                Upload
              </Button>
            ) : (
              <Button variant="outline" disabled title="Your role cannot upload documents">
                <Upload />
                Upload
              </Button>
            )}
          </>
        }
      />

      {!roleLoading && !canUpload && (
        <PermissionNotice message="Your role can read documents but cannot upload new ones. Ask an organization administrator for Contributor access." />
      )}

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="space-y-4">
          {foldersQuery.isLoading ? (
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <FolderPanel
              folders={foldersQuery.data ?? []}
              selectedFolderId={folderId}
              onSelect={setFolderId}
              canManage={can('folders:manage')}
            />
          )}
          <div className="hidden rounded-xl border border-border/80 bg-card p-4 lg:block">
            <p className="label-caps">Search covers</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Titles, descriptions and extracted document text. Results are limited to this
              organization.
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, description or document text…"
                className="pl-9 pr-9"
                aria-label="Search documents"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={`${sortBy}:${sortOrder}`}
              onValueChange={(value) => {
                const [nextSort, nextOrder] = value.split(':')
                setSortBy((nextSort as DocumentSort) ?? 'created_at')
                setSortOrder((nextOrder as SortOrder) ?? 'desc')
              }}
            >
              <SelectTrigger className="sm:w-[12.5rem]" aria-label="Sort documents">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Newest first</SelectItem>
                <SelectItem value="created_at:asc">Oldest first</SelectItem>
                <SelectItem value="updated_at:desc">Recently updated</SelectItem>
                <SelectItem value="title:asc">Title A–Z</SelectItem>
                <SelectItem value="title:desc">Title Z–A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span aria-live="polite">
              {documentsQuery.isLoading
                ? 'Loading documents…'
                : `${total} ${total === 1 ? 'document' : 'documents'}${
                    activeFolderName ? ` in “${activeFolderName}”` : ''
                  }${debouncedSearch.trim() ? ` matching “${debouncedSearch.trim()}”` : ''}`}
            </span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-2xs"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
            {activeOrganizationId && (
              <span className="ml-auto hidden text-2xs text-muted-foreground/80 sm:inline">
                organization-scoped
              </span>
            )}
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft/60 px-3 py-2">
              <p className="text-xs font-medium">
                {selected.size} {selected.size === 1 ? 'document' : 'documents'} selected
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-2xs"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </Button>
              <div className="ml-auto">
                {canDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setBulkArchiveOpen(true)}
                  >
                    <Archive />
                    Archive selected
                  </Button>
                ) : (
                  <span className="text-2xs text-muted-foreground">
                    Archiving requires permission
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
            {documentsQuery.isLoading ? (
              <TableSkeleton />
            ) : documentsQuery.isError ? (
              <ErrorState
                error={documentsQuery.error}
                className="rounded-none border-0 shadow-none"
                onRetry={() => void documentsQuery.refetch()}
              />
            ) : documents.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={Search}
                  title="No documents match those filters"
                  description="Try a broader search term, a different folder, or clear the filters to see everything in this organization."
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                  className="rounded-none border-0 bg-transparent"
                />
              ) : (
                <EmptyState
                  icon={FileStack}
                  title="No documents yet"
                  description="Upload a contract, pleading or lease. Docuflow extracts the text, indexes it for Ask AI and keeps every version."
                  action={
                    canUpload ? (
                      <Button variant="accent" onClick={() => setUploadOpen(true)}>
                        <Upload />
                        Upload your first document
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <Link to="/app/team">Ask an administrator for access</Link>
                      </Button>
                    )
                  }
                  className="rounded-none border-0 bg-transparent"
                />
              )
            ) : (
              <DocumentsTable
                documents={documents}
                selectedIds={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                canDelete={canDelete}
                onArchive={setDocumentToArchive}
                onDownload={(document) => void download(document)}
                downloadPendingId={pendingId}
              />
            )}
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={DOCUMENT_PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folders={foldersQuery.data ?? []}
        defaultFolderId={folderId ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(documentToArchive)}
        onOpenChange={(open) => {
          if (!open && !archiving) setDocumentToArchive(null)
        }}
        title="Archive this document?"
        description={
          <>
            <span className="font-medium text-foreground">{documentToArchive?.title}</span> will be
            removed from the active document list and Ask AI results. Versions and audit records are
            retained.
          </>
        }
        confirmLabel="Archive document"
        destructive
        onConfirm={archiveDocument}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selectedDocuments.length} ${selectedDocuments.length === 1 ? 'document' : 'documents'}?`}
        description="They will be removed from the active document list and Ask AI results. Versions and audit records are retained."
        confirmLabel="Archive selected"
        destructive
        onConfirm={archiveSelected}
      />
    </div>
  )
}
