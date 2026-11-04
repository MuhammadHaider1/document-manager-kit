import { Building2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OrganizationForm } from './OrganizationForm'

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateOrganizationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <DialogTitle>Create an organization</DialogTitle>
          <DialogDescription>
            An organization is the isolated workspace for one firm or legal team. Documents, members
            and permissions never cross between organizations.
          </DialogDescription>
        </DialogHeader>
        <OrganizationForm
          autoFocus
          onCancel={() => onOpenChange(false)}
          onCreated={() => {
            onOpenChange(false)
            onCreated?.()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
