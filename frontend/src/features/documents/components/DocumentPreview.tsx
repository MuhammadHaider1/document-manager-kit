import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Download, ExternalLink, FileWarning, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { documentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { assertDownloadUrlUsable, openDownloadUrl, StorageUrlError } from '@/lib/download'
import type { Document, DocumentVersion } from '@/types/domain'

function PreviewUnavailable({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-1">
        <p className="font-medium">Preview unavailable</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function DocumentPreview({
  document,
  version,
}: {
  document: Document
  version: DocumentVersion | null
}) {
  const downloadQuery = useQuery({
    queryKey: ['download-url', document.id, version?.id],
    queryFn: () => documentsApi.download(document.id, version!.id),
    enabled: Boolean(version),
    staleTime: 10 * 60_000,
    retry: false,
  })

  if (!version) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <FileWarning className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">No file version available</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload a version to preview and download this document.
        </p>
      </div>
    )
  }

  if (downloadQuery.isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/20 px-6 py-16 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Preparing secure preview…</p>
      </div>
    )
  }

  if (downloadQuery.isError) {
    const error = downloadQuery.error
    return (
      <PreviewUnavailable
        message={
          error instanceof ApiError
            ? error.message
            : 'The download link could not be created. Try again in a moment.'
        }
      />
    )
  }

  const url = downloadQuery.data?.download_url
  if (!url) return <PreviewUnavailable message="The API did not return a preview link." />

  try {
    assertDownloadUrlUsable(url)
  } catch (error) {
    return (
      <PreviewUnavailable
        message={
          error instanceof StorageUrlError
            ? error.message
            : 'This preview link cannot be opened safely.'
        }
      />
    )
  }

  const canInline =
    version.mime_type === 'application/pdf' || version.mime_type.startsWith('image/')

  if (!canInline) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/20 px-6 py-12 text-center">
        <FileWarning className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <div className="max-w-sm space-y-1">
          <p className="text-sm font-medium">This file type cannot be previewed here</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Download {version.file_name} to open it in its native application.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={() => openDownloadUrl(url, version.file_name)}>
            <Download />
            Download file
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink />
            Open in new tab
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Version {version.version_number} · {version.file_name}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDownloadUrl(url, version.file_name)}
          >
            <Download />
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink />
            New tab
          </Button>
        </div>
      </div>
      {version.mime_type === 'application/pdf' ? (
        <iframe
          key={url}
          src={url}
          title={`Preview of ${document.title}`}
          className="h-[70vh] w-full rounded-xl border border-border bg-muted/20"
        />
      ) : (
        <div className="flex justify-center rounded-xl border border-border bg-muted/20 p-4">
          <img
            src={url}
            alt={`Preview of ${document.title}`}
            className="max-h-[70vh] w-auto rounded-lg object-contain"
          />
        </div>
      )}
      <p className="text-2xs text-muted-foreground">
        Preview uses a short-lived signed link from object storage. The link expires automatically.
      </p>
    </div>
  )
}
