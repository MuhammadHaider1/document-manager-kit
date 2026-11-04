import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { documentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ACCEPTED_EXTENSIONS } from '@/lib/constants'
import { fileExtension } from '@/components/shared/FileTypeIcon'

export type UploadStatus = 'ready' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  file: File
  title: string
  status: UploadStatus
  progress: number
  error?: string
}

export interface RejectedFile {
  name: string
  reason: string
}

/**
 * Turns a file name into a readable title: separators become spaces and the
 * first letter of each word is capitalised. Existing capitals are preserved so
 * that acronyms such as "NDA" or "MSA" survive.
 */
export function titleFromFile(file: File): string {
  const extension = fileExtension(file.name)
  const base = extension ? file.name.slice(0, -(extension.length + 1)) : file.name
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return file.name
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function validateFile(file: File): string | null {
  const extension = `.${fileExtension(file.name)}`
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return `Files must be ${MAX_UPLOAD_MB} MB or smaller.`
  return null
}

export function useUploadQueue() {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const [rejected, setRejected] = useState<RejectedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const addFiles = useCallback((files: File[]) => {
    const nextItems: UploadItem[] = []
    const nextRejected: RejectedFile[] = []

    for (const file of files) {
      const reason = validateFile(file)
      if (reason) {
        nextRejected.push({ name: file.name, reason })
        continue
      }
      nextItems.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        title: titleFromFile(file),
        status: 'ready',
        progress: 0,
      })
    }

    setRejected((current) => [...current, ...nextRejected])
    if (nextItems.length > 0) setItems((current) => [...current, ...nextItems])
  }, [])

  const updateTitle = useCallback((id: string, title: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, title } : item)))
  }, [])

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearRejected = useCallback(() => setRejected([]), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setItems([])
    setRejected([])
    setIsUploading(false)
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsUploading(false)
    setItems((current) =>
      current.map((item) =>
        item.status === 'uploading' ? { ...item, status: 'ready', progress: 0 } : item
      )
    )
  }, [])

  const start = useCallback(
    async (folderId?: string) => {
      const pending = items.filter((item) => item.status === 'ready' || item.status === 'error')
      if (pending.length === 0) return { uploaded: 0, failed: 0 }

      const controller = new AbortController()
      abortRef.current = controller
      setIsUploading(true)
      let uploaded = 0
      let failed = 0

      for (const item of pending) {
        if (controller.signal.aborted) break
        if (!item.title.trim()) {
          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: 'error', error: 'A title is required.' }
                : entry
            )
          )
          failed += 1
          continue
        }

        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'uploading', progress: 0, error: undefined }
              : entry
          )
        )

        try {
          await documentsApi.upload(
            {
              title: item.title.trim(),
              folderId: folderId || undefined,
              file: item.file,
            },
            {
              signal: controller.signal,
              onProgress: (progress) => {
                setItems((current) =>
                  current.map((entry) => (entry.id === item.id ? { ...entry, progress } : entry))
                )
              },
            }
          )
          uploaded += 1
          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, status: 'done', progress: 100 } : entry
            )
          )
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') break
          failed += 1
          const message =
            error instanceof ApiError ? error.message : 'Upload failed. Please try again.'
          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: 'error', progress: 0, error: message }
                : entry
            )
          )
        }
      }

      abortRef.current = null
      setIsUploading(false)

      if (uploaded > 0) {
        void queryClient.invalidateQueries({ queryKey: ['documents'] })
        void queryClient.invalidateQueries({ queryKey: ['audit'] })
      }

      if (uploaded > 0 && failed === 0) {
        toast.success(
          `${uploaded} ${uploaded === 1 ? 'document' : 'documents'} uploaded for processing.`
        )
      } else if (uploaded > 0) {
        toast.warning(`${uploaded} uploaded, ${failed} failed. Review the errors and retry.`)
      } else if (failed > 0) {
        toast.error('No documents were uploaded. Check the errors and try again.')
      }

      return { uploaded, failed }
    },
    [items, queryClient]
  )

  return {
    items,
    rejected,
    isUploading,
    addFiles,
    updateTitle,
    remove,
    clearRejected,
    reset,
    cancel,
    start,
  }
}
