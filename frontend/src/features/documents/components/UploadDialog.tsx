import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CheckCircle2, FileUp, Loader2, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from '@/components/ui/select'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, MAX_UPLOAD_MB } from '@/lib/constants'
import { cn, formatBytes } from '@/lib/utils'
import type { Folder } from '@/types/domain'
import { useUploadQueue } from '../hooks/useUploadQueue'
import { flattenFolders } from '../utils'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: Folder[]
  defaultFolderId?: string
}

export function UploadDialog({ open, onOpenChange, folders, defaultFolderId }: UploadDialogProps) {
  const queue = useUploadQueue()
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? 'none')
  const [finished, setFinished] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      queue.addFiles(acceptedFiles)
      setFinished(false)
    },
    [queue]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME_TYPES,
    multiple: true,
    disabled: queue.isUploading,
    noClick: queue.isUploading,
  })

  useEffect(() => {
    if (open) {
      setFolderId(defaultFolderId ?? 'none')
      setFinished(false)
      queue.reset()
    }
    // Reset is intentionally only tied to the dialog opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFolderId])

  const handleClose = (next: boolean) => {
    if (queue.isUploading) return
    if (!next) {
      queue.reset()
      setFinished(false)
    }
    onOpenChange(next)
  }

  const handleUpload = async () => {
    await queue.start(folderId === 'none' ? undefined : folderId)
    setFinished(true)
  }

  const readyCount = queue.items.filter(
    (item) => item.status === 'ready' || item.status === 'error'
  ).length
  const doneCount = queue.items.filter((item) => item.status === 'done').length
  const folderOptions = flattenFolders(folders)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            PDF, DOCX, TXT and image files up to {MAX_UPLOAD_MB} MB each. Text is extracted and
            indexed in the background; you can close this window once the upload completes.
          </DialogDescription>
        </DialogHeader>

        {!finished ? (
          <>
            <div
              {...getRootProps()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
                isDragActive
                  ? 'border-accent bg-accent-soft/60'
                  : 'border-border bg-muted/25 hover:border-accent/50 hover:bg-muted/40',
                isDragReject && 'border-destructive bg-destructive/5',
                queue.isUploading && 'pointer-events-none opacity-60'
              )}
            >
              <input {...getInputProps()} aria-label="Choose files to upload" />
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-accent">
                <FileUp className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">
                {isDragActive ? 'Drop files to add them' : 'Drag and drop files here, or browse'}
              </p>
              <p className="text-xs text-muted-foreground">
                Accepted: {ACCEPTED_EXTENSIONS.join(', ')}
              </p>
            </div>

            {queue.rejected.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive">Files not added</p>
                {queue.rejected.map((file) => (
                  <p key={`${file.name}-${file.reason}`} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{file.name}</span> — {file.reason}
                  </p>
                ))}
              </div>
            )}

            {queue.items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {queue.items.length} {queue.items.length === 1 ? 'file' : 'files'} selected
                  </p>
                  <Select value={folderId} onValueChange={setFolderId}>
                    <SelectTrigger
                      className="h-8 w-[13rem] text-xs"
                      aria-label="Destination folder"
                    >
                      <SelectValue placeholder="No folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No folder</SelectItem>
                      {folderOptions.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {'— '.repeat(folder.depth)}
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {queue.items.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border/80 bg-card p-3">
                      <div className="flex items-start gap-2.5">
                        <FileTypeIcon fileName={item.file.name} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Input
                            value={item.title}
                            onChange={(event) => queue.updateTitle(item.id, event.target.value)}
                            disabled={queue.isUploading || item.status === 'done'}
                            aria-label={`Title for ${item.file.name}`}
                            className="h-8 text-sm"
                          />
                          <p className="flex items-center gap-2 text-2xs text-muted-foreground">
                            <span className="truncate">{item.file.name}</span>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0">{formatBytes(item.file.size)}</span>
                          </p>
                          {item.status === 'uploading' && (
                            <Progress
                              value={item.progress}
                              className="h-1.5"
                              aria-label={`Uploading ${item.file.name}`}
                            />
                          )}
                          {item.status === 'error' && (
                            <p className="text-2xs font-medium text-destructive">{item.error}</p>
                          )}
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.status === 'uploading' && (
                            <Loader2
                              className="h-4 w-4 animate-spin text-accent"
                              aria-hidden="true"
                            />
                          )}
                          {item.status === 'done' && (
                            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                          )}
                          {item.status === 'error' && (
                            <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                          )}
                          {!queue.isUploading && item.status !== 'done' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => queue.remove(item.id)}
                              aria-label={`Remove ${item.file.name}`}
                            >
                              <X />
                            </Button>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              {queue.isUploading ? (
                <Button variant="outline" onClick={queue.cancel}>
                  Stop upload
                </Button>
              ) : (
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant="accent"
                onClick={() => void handleUpload()}
                loading={queue.isUploading}
                disabled={readyCount === 0}
              >
                {queue.isUploading
                  ? 'Uploading…'
                  : `Upload ${readyCount > 0 ? readyCount : ''} ${readyCount === 1 ? 'document' : 'documents'}`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/25 px-5 py-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-lg">
                  {doneCount > 0
                    ? `${doneCount} ${doneCount === 1 ? 'document' : 'documents'} uploaded`
                    : 'No documents were uploaded'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {doneCount > 0
                    ? 'Processing has started. Status updates automatically on the documents page.'
                    : 'Review the errors below, then try again.'}
                </p>
              </div>
            </div>
            {queue.items.some((item) => item.status === 'error') && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive">Some files failed</p>
                {queue.items
                  .filter((item) => item.status === 'error')
                  .map((item) => (
                    <p key={item.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{item.file.name}</span> —{' '}
                      {item.error}
                    </p>
                  ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={queue.reset}>
                Upload more
              </Button>
              <Button variant="accent" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
