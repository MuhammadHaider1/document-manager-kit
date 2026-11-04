import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { documentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { assertDownloadUrlUsable, openDownloadUrl, StorageUrlError } from '@/lib/download'
import type { Document, DocumentVersion } from '@/types/domain'
import { latestVersion } from '../utils'

/**
 * Resolves a presigned download URL through the API, then hands it to the
 * browser. Storage-host reachability problems are surfaced as a toast instead of
 * a broken link.
 */
export function useDocumentDownload() {
  const [pendingId, setPendingId] = useState<string | null>(null)

  const download = useCallback(async (document: Document, version?: DocumentVersion) => {
    const target = version ?? latestVersion(document)
    if (!target) {
      toast.error('This document has no file version to download.')
      return
    }

    setPendingId(target.id)
    try {
      const result = await documentsApi.download(document.id, target.id)
      assertDownloadUrlUsable(result.download_url)
      openDownloadUrl(result.download_url, target.file_name)
      toast.success(`Download started for ${target.file_name}.`)
    } catch (error) {
      if (error instanceof StorageUrlError) {
        toast.error(error.message, { duration: 9000 })
      } else if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('Could not prepare the download. Please try again.')
      }
    } finally {
      setPendingId(null)
    }
  }, [])

  return { download, pendingId }
}
