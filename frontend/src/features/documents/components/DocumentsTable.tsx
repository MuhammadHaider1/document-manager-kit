import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatBytes } from '@/lib/utils'
import type { Document } from '@/types/domain'
import { documentSize, latestVersion } from '../utils'

export type DocumentSort = 'created_at' | 'updated_at' | 'title'
export type SortOrder = 'asc' | 'desc'

interface DocumentsTableProps {
  documents: Document[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  sortBy: DocumentSort
  sortOrder: SortOrder
  onSort: (column: DocumentSort) => void
  canDelete: boolean
  onArchive: (document: Document) => void
  onDownload: (document: Document) => void
  downloadPendingId: string | null
}

function SortButton({
  column,
  label,
  sortBy,
  sortOrder,
  onSort,
}: {
  column: DocumentSort
  label: string
  sortBy: DocumentSort
  sortOrder: SortOrder
  onSort: (column: DocumentSort) => void
}) {
  const active = sortBy === column
  const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Sort by ${label}${active ? `, currently ${sortOrder}ending` : ''}`}
    >
      {label}
      <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  )
}

function RowActions({
  document,
  canDelete,
  onArchive,
  onDownload,
  downloading,
}: {
  document: Document
  canDelete: boolean
  onArchive: (document: Document) => void
  onDownload: (document: Document) => void
  downloading: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${document.title}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to={`/app/documents/${document.id}`}>
            <ExternalLink />
            Open document
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onDownload(document)}
          disabled={downloading || !latestVersion(document)}
        >
          <Download />
          {downloading ? 'Preparing…' : 'Download latest'}
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onArchive(document)}>
              <Trash2 />
              Archive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DocumentsTable({
  documents,
  selectedIds,
  onToggle,
  onToggleAll,
  sortBy,
  sortOrder,
  onSort,
  canDelete,
  onArchive,
  onDownload,
  downloadPendingId,
}: DocumentsTableProps) {
  const allSelected =
    documents.length > 0 && documents.every((document) => selectedIds.has(document.id))
  const someSelected = documents.some((document) => selectedIds.has(document.id))

  return (
    <>
      {/* Desktop and tablet */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all documents on this page"
                />
              </TableHead>
              <TableHead>
                <SortButton
                  column="title"
                  label="Document"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>
                <SortButton
                  column="updated_at"
                  label="Updated"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => {
              const version = latestVersion(document)
              return (
                <TableRow
                  key={document.id}
                  data-state={selectedIds.has(document.id) ? 'selected' : undefined}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selectedIds.has(document.id)}
                      onCheckedChange={() => onToggle(document.id)}
                      aria-label={`Select ${document.title}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-[18rem]">
                    <div className="flex items-start gap-3">
                      <FileTypeIcon fileName={version?.file_name} mimeType={version?.mime_type} />
                      <div className="min-w-0">
                        <Link
                          to={`/app/documents/${document.id}`}
                          className="line-clamp-1 text-[0.875rem] font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                        >
                          {document.title}
                        </Link>
                        <p className="mt-0.5 line-clamp-1 text-2xs text-muted-foreground">
                          {version?.file_name ?? 'No file attached'}
                          {document.description ? ` · ${document.description}` : ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={document.processing_status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {version ? `v${version.version_number}` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {version ? formatBytes(documentSize(document)) : '—'}
                  </TableCell>
                  <TableCell>
                    <RelativeTime
                      value={document.updated_at}
                      className="whitespace-nowrap text-xs text-muted-foreground"
                    />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <RowActions
                      document={document}
                      canDelete={canDelete}
                      onArchive={onArchive}
                      onDownload={onDownload}
                      downloading={downloadPendingId === version?.id}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {documents.map((document) => {
          const version = latestVersion(document)
          return (
            <li
              key={document.id}
              className="rounded-xl border border-border/80 bg-card p-4 shadow-card"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(document.id)}
                  onCheckedChange={() => onToggle(document.id)}
                  aria-label={`Select ${document.title}`}
                  className="mt-1"
                />
                <FileTypeIcon fileName={version?.file_name} mimeType={version?.mime_type} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/documents/${document.id}`}
                    className="line-clamp-2 text-sm font-medium underline-offset-4 hover:text-accent hover:underline"
                  >
                    {document.title}
                  </Link>
                  <p className="mt-1 truncate text-2xs text-muted-foreground">
                    {version?.file_name ?? 'No file attached'}
                  </p>
                </div>
                <RowActions
                  document={document}
                  canDelete={canDelete}
                  onArchive={onArchive}
                  onDownload={onDownload}
                  downloading={downloadPendingId === version?.id}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <StatusBadge status={document.processing_status} />
                {version && (
                  <span className="text-2xs text-muted-foreground">
                    v{version.version_number} · {formatBytes(documentSize(document))}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-2xs text-muted-foreground">
                  <RelativeTime value={document.updated_at} />
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
