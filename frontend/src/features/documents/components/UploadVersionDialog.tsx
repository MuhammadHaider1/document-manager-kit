import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { documentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, MAX_UPLOAD_MB } from '@/lib/constants'
import { cn, formatBytes } from '@/lib/utils'
import { validateFile } from '../hooks/useUploadQueue'

interface UploadVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  documentTitle: string
  nextVersionNumber: number
}

export function UploadVersionDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  nextVersionNumber,
}: UploadVersionDialogProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setProgress(0)
      setUploading(false)
      setError(null)
      abortRef.current = null
    }
  }, [open])

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0]
    if (!next) return
    const reason = validateFile(next)
    if (reason) {
      setError(reason)
      setFile(null)
      return
    }
    setFile(next)
    setError(null)
    setProgress(0)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME_TYPES,
    multiple: false,
    disabled: uploading,
  })

  const upload = async () => {
    if (!file) return
    const controller = new AbortController()
    abortRef.current = controller
    setUploading(true)
    setError(null)
    try {
      await documentsApi.uploadVersion(documentId, file, {
        signal: controller.signal,
        onProgress: setProgress,
      })
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success(`Version ${nextVersionNumber} uploaded. Processing has started.`)
      onOpenChange(false)
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === 'AbortError') {
        toast.message('Upload stopped.')
        setUploading(false)
        return
      }
      const message =
        uploadError instanceof ApiError
          ? uploadError.message
          : 'The version could not be uploaded. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setUploading(false)
      abortRef.current = null
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (uploading ? undefined : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a new version</DialogTitle>
          <DialogDescription>
            A new version of “{documentTitle}” will be created as v{nextVersionNumber}. Earlier
            versions remain available and immutable.
          </DialogDescription>
        </DialogHeader>

        {file ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/25 p-3">
            <FileTypeIcon fileName={file.name} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-2xs text-muted-foreground">{formatBytes(file.size)}</p>
              {uploading && <Progress value={progress} className="h-1.5" />}
            </div>
            {!uploading && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setFile(null)}
                aria-label="Remove selected file"
              >
                <X />
              </Button>
            )}
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
              isDragActive
                ? 'border-accent bg-accent-soft/60'
                : 'border-border bg-muted/25 hover:border-accent/50'
            )}
          >
            <input {...getInputProps()} aria-label="Choose a file for the new version" />
            <FileUp className="h-5 w-5 text-accent" aria-hidden="true" />
            <p className="text-sm font-medium">Drop the revised file, or browse</p>
            <p className="text-xs text-muted-foreground">
              {ACCEPTED_EXTENSIONS.join(', ')} · up to {MAX_UPLOAD_MB} MB
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          {uploading ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              Stop upload
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button
            variant="accent"
            loading={uploading}
            disabled={!file}
            onClick={() => void upload()}
          >
            Upload v{nextVersionNumber}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
