import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ArchiveRestore, RotateCcw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/shared/Field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { documentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { useRestoreDocument } from '@/features/documents/hooks'
import type { Document } from '@/types/domain'

const lookupSchema = z.object({
  documentId: z.string().trim().uuid('Enter a valid document ID (UUID).'),
})

type LookupValues = z.infer<typeof lookupSchema>

interface RestoreByIdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Fallback recovery path for documents that are not present in the
 * audit-derived archive list (for example because the archive event predates
 * the audit window, or the viewer cannot read the audit log).
 */
export function RestoreByIdDialog({ open, onOpenChange }: RestoreByIdDialogProps) {
  const queryClient = useQueryClient()
  const restoreDocument = useRestoreDocument()
  const [found, setFound] = useState<Document | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LookupValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { documentId: '' },
  })

  const lookup = useMutation({
    mutationFn: (documentId: string) => documentsApi.get(documentId),
    onSuccess: (document) => setFound(document),
    onError: (error) => {
      setFound(null)
      if (error instanceof ApiError && error.status === 404) {
        toast.error('No document with that ID exists in this organization.')
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'The document could not be loaded.')
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      reset({ documentId: '' })
      setFound(null)
      lookup.reset()
    }
    onOpenChange(next)
  }

  const handleRestore = async () => {
    if (!found) return
    try {
      await restoreDocument.mutateAsync(found.id)
      toast.success(`“${found.title}” restored.`)
      void queryClient.invalidateQueries({ queryKey: ['archive'] })
      close(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The document could not be restored.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore by document ID</DialogTitle>
          <DialogDescription>
            Look up an archived document directly when it is not shown in the reconstructed archive
            list.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => lookup.mutate(values.documentId.trim()))}
          className="space-y-4"
          noValidate
        >
          <Field
            label="Document ID"
            htmlFor="restore-document-id"
            hint="UUID"
            error={errors.documentId?.message}
            required
          >
            <Input
              id="restore-document-id"
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={Boolean(errors.documentId)}
              {...register('documentId')}
            />
          </Field>
          <Button type="submit" variant="outline" loading={lookup.isPending}>
            <Search />
            Look up document
          </Button>
        </form>

        {found && (
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 px-3.5 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground">
                <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{found.title}</p>
                <p className="mt-0.5 break-all font-mono text-2xs text-muted-foreground">
                  {found.id}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={found.processing_status} />
              {found.is_archived ? (
                <Badge tone="warning">Archived</Badge>
              ) : (
                <Badge tone="success">Active</Badge>
              )}
            </div>
            {found.is_archived ? (
              <Button
                type="button"
                variant="accent"
                onClick={() => void handleRestore()}
                loading={restoreDocument.isPending}
              >
                <RotateCcw />
                Restore this document
              </Button>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                This document is already active, so there is nothing to restore.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
