import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Archive, FolderPlus, FolderTree, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/shared/Field'
import { Input } from '@/components/ui/input'
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
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { foldersApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import type { Folder } from '@/types/domain'
import { flattenFolders } from '../utils'

const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter a folder name.')
    .max(80, 'Keep the name under 80 characters.'),
})

type FolderValues = z.infer<typeof folderSchema>

function TreeItem({
  folder,
  depth,
  selectedFolderId,
  onSelect,
  canManage,
  onRename,
  onDelete,
}: {
  folder: Folder
  depth: number
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
  canManage: boolean
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}) {
  return (
    <li>
      <div className="group flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-1 text-left text-[0.8125rem] transition-colors',
            selectedFolderId === folder.id
              ? 'bg-card font-medium text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          aria-current={selectedFolderId === folder.id ? 'true' : undefined}
        >
          <FolderTree className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{folder.name}</span>
        </button>
        {canManage && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onRename(folder)}
              aria-label={`Rename folder ${folder.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onDelete(folder)}
              aria-label={`Delete folder ${folder.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
      {folder.children && folder.children.length > 0 && (
        <ul>
          {folder.children.map((child) => (
            <TreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              canManage={canManage}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

interface FolderPanelProps {
  folders: Folder[]
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
  canManage: boolean
}

export function FolderPanel({ folders, selectedFolderId, onSelect, canManage }: FolderPanelProps) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [parentId, setParentId] = useState('none')
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null)
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FolderValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: '' },
  })

  const {
    register: registerRename,
    handleSubmit: handleRenameSubmit,
    reset: resetRename,
    setError: setRenameError,
    formState: { errors: renameErrors, isSubmitting: isRenaming },
  } = useForm<FolderValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: '' },
  })

  const options = flattenFolders(folders)

  const createFolder = async (values: FolderValues) => {
    try {
      await foldersApi.create({
        name: values.name.trim(),
        parent_id: parentId === 'none' ? null : parentId,
      })
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Folder created.')
      setCreateOpen(false)
      reset({ name: '' })
      setParentId('none')
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) {
        setError('name', { message: error.fieldErrors.name })
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not create the folder.')
    }
  }

  const openRename = (folder: Folder) => {
    setFolderToRename(folder)
    resetRename({ name: folder.name })
  }

  const renameFolder = async (values: FolderValues) => {
    if (!folderToRename) return
    try {
      await foldersApi.update(folderToRename.id, { name: values.name.trim() })
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Folder renamed.')
      setFolderToRename(null)
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) {
        setRenameError('name', { message: error.fieldErrors.name })
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not rename the folder.')
    }
  }

  const deleteFolder = async () => {
    if (!folderToDelete) return
    try {
      await foldersApi.remove(folderToDelete.id)
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      if (selectedFolderId === folderToDelete.id) onSelect(null)
      toast.success('Folder deleted.')
      setFolderToDelete(null)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the folder.')
    }
  }

  return (
    <aside className="rounded-xl border border-border/80 bg-muted/20 p-3" aria-label="Folders">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Folders
        </p>
        {canManage && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCreateOpen(true)}
            aria-label="Create folder"
          >
            <FolderPlus />
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] transition-colors',
          selectedFolderId === null
            ? 'bg-card font-medium text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
        )}
        aria-current={selectedFolderId === null ? 'true' : undefined}
      >
        <FolderTree className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        All documents
      </button>

      {folders.length === 0 ? (
        <p className="px-2 py-3 text-2xs leading-relaxed text-muted-foreground">
          No folders yet. {canManage ? 'Create one to organise matters.' : ''}
        </p>
      ) : (
        <ul className="mt-1">
          {folders.map((folder) => (
            <TreeItem
              key={folder.id}
              folder={folder}
              depth={0}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              canManage={canManage}
              onRename={openRename}
              onDelete={setFolderToDelete}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-border/70 pt-2">
        <Link
          to="/app/archive"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
        >
          <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Archived documents
        </Link>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a folder</DialogTitle>
            <DialogDescription>
              Folders mirror your matter structure and can be nested. Documents can be moved by
              uploading a version target later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(createFolder)} className="space-y-4" noValidate>
            <Field label="Folder name" htmlFor="folder-name" error={errors.name?.message} required>
              <Input
                id="folder-name"
                placeholder="Commercial — 2026"
                autoFocus
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
            </Field>
            <Field label="Parent folder" htmlFor="folder-parent" hint="Optional">
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="folder-parent">
                  <SelectValue placeholder="Top level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top level</SelectItem>
                  {options.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {'— '.repeat(folder.depth)}
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" loading={isSubmitting}>
                Create folder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(folderToRename)}
        onOpenChange={(open) => {
          if (!open) setFolderToRename(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>
              The new name is visible to everyone in this organization. Documents and subfolders
              keep their place.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit(renameFolder)} className="space-y-4" noValidate>
            <Field
              label="Folder name"
              htmlFor="folder-rename"
              error={renameErrors.name?.message}
              required
            >
              <Input
                id="folder-rename"
                placeholder="Commercial — 2026"
                autoFocus
                aria-invalid={Boolean(renameErrors.name)}
                {...registerRename('name')}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFolderToRename(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" loading={isRenaming}>
                Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(folderToDelete)}
        onOpenChange={(open) => {
          if (!open) setFolderToDelete(null)
        }}
        title={`Delete “${folderToDelete?.name ?? ''}”?`}
        description="Deleting a folder also removes its subfolders. Documents inside are retained and become unfiled. This cannot be undone."
        confirmLabel="Delete folder"
        destructive
        onConfirm={deleteFolder}
      />
    </aside>
  )
}
