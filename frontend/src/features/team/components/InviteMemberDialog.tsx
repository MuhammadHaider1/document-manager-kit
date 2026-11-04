import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertTriangle, Copy, ExternalLink, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { membersApi, rbacApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/queryClient'
import { useAuthStore } from '@/store/auth'
import type { Invitation } from '@/types/domain'
import { buildInviteMessage } from '../utils'

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationName: string
  inviterName?: string | null
  onInvited?: () => void
}

const INVITABLE_ROLES = ['Member', 'Contributor', 'Reviewer', 'Viewer']

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  roleId: z.string().optional(),
})

type InviteValues = z.infer<typeof inviteSchema>

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  } catch {
    toast.error('This browser would not allow copying.')
  }
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  organizationName,
  inviterName,
  onInvited,
}: InviteMemberDialogProps) {
  const activeOrganizationId = useAuthStore((state) => state.activeOrganizationId)
  const [created, setCreated] = useState<Invitation | null>(null)

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', roleId: undefined },
  })

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles,
    queryFn: () => rbacApi.roles(),
    enabled: open,
    staleTime: 10 * 60_000,
  })

  const invitableRoles = useMemo(
    () => (rolesQuery.data ?? []).filter((role) => INVITABLE_ROLES.includes(role.name)),
    [rolesQuery.data]
  )

  const inviteMutation = useMutation({
    mutationFn: (values: InviteValues) =>
      membersApi.invite({
        email: values.email.trim(),
        role_id: values.roleId || undefined,
      }),
    onSuccess: (invitation) => {
      setCreated(invitation)
      form.reset({ email: '', roleId: undefined })
      toast.success('Invitation created. Share the link with your teammate.')
      onInvited?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'The invitation could not be created.'
      )
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      setCreated(null)
      form.reset({ email: '', roleId: undefined })
      inviteMutation.reset()
    }
    onOpenChange(next)
  }

  const subject = `Invitation to ${organizationName} on Docuflow`
  const message = created
    ? buildInviteMessage({
        organizationName,
        inviteUrl: created.invite_url,
        roleName: created.role_name,
        inviterName,
        expiresAt: created.expires_at,
      })
    : ''

  const mailtoHref = created
    ? `mailto:${encodeURIComponent(created.email)}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(message)}`
    : '#'

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            Invite someone to{' '}
            <span className="font-medium text-foreground">{organizationName}</span> as a member.
            They join with the role you choose here — never as an administrator.
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <form
            onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <Field
              label="Teammate's email"
              htmlFor="invite-email"
              error={form.formState.errors.email?.message}
              hint="The invitation can only be accepted by this address"
              required
            >
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="colleague@firm.com"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register('email')}
              />
            </Field>

            <Field
              label="Role on acceptance"
              htmlFor="invite-role"
              error={form.formState.errors.roleId?.message}
              hint="Defaults to Member. Administrators can be promoted later."
            >
              <Select
                value={form.watch('roleId') ?? ''}
                onValueChange={(value) =>
                  form.setValue('roleId', value === 'default' ? undefined : value)
                }
                disabled={rolesQuery.isLoading}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue
                    placeholder={rolesQuery.isLoading ? 'Loading roles…' : 'Member (default)'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Member (default)</SelectItem>
                  {invitableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
              <p>
                Docuflow does not send email yet. After creating the invitation you get a private
                link to share. The link is single-use and expires automatically.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" loading={inviteMutation.isPending}>
                <Send />
                Create invitation
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/25 bg-success/5 px-3.5 py-3 text-sm">
              <p className="font-medium">Invitation ready for {created.email}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                They will join {created.organization_name} as{' '}
                <span className="font-medium text-foreground">{created.role_name}</span> after
                accepting. The link expires {new Date(created.expires_at).toLocaleDateString()}.
              </p>
            </div>

            <div className="space-y-2">
              <p className="label-caps">Invitation link</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={created.invite_url}
                  aria-label="Invitation link"
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copy(created.invite_url, 'Invitation link')}
                  >
                    <Copy />
                    Copy
                  </Button>
                  <Button asChild variant="outline" size="icon" aria-label="Open invitation link">
                    <a href={created.invite_url} target="_blank" rel="noreferrer">
                      <ExternalLink />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="label-caps">Email draft</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy(message, 'Invitation message')}
                >
                  <Copy />
                  Copy message
                </Button>
              </div>
              <Textarea
                readOnly
                value={message}
                rows={10}
                aria-label="Invitation message"
                className="font-mono text-xs leading-relaxed"
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>

            {activeOrganizationId && (
              <p className="text-2xs leading-relaxed text-muted-foreground">
                Pending invitations appear on the Team page, where you can copy the link again or
                revoke it.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Close
              </Button>
              <Button asChild variant="accent">
                <a href={mailtoHref}>
                  <Mail />
                  Open email draft
                </a>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
