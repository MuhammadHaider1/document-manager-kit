import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotionCard } from '@/components/motion/MotionCard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionNotice } from '@/components/shared/PermissionNotice'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { membersApi, rbacApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/queryClient'
import { capabilitiesForRole, type Capability } from '@/lib/permissions'
import { formatDate, titleCase } from '@/lib/utils'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'
import type { Invitation, OrganizationMember } from '@/types/domain'
import { InviteMemberDialog } from '../components/InviteMemberDialog'

const CAPABILITY_LABELS: Record<Capability, string> = {
  'documents:create': 'Upload documents',
  'documents:update': 'Upload versions & restore',
  'documents:delete': 'Archive documents',
  'folders:manage': 'Manage folders',
  'comments:write': 'Post comments',
  'organization:update': 'Edit organization',
  'organizations:create': 'Create organizations',
  'members:invite': 'Invite members',
  'members:manage_roles': 'Change member roles',
  'members:remove': 'Remove members',
  'audit:read': 'Read audit log',
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  } catch {
    toast.error('This browser would not allow copying.')
  }
}

function PermissionPreview({ roleName }: { roleName: string | null }) {
  const capabilities = useMemo(() => capabilitiesForRole(roleName), [roleName])
  if (!roleName) {
    return (
      <p className="text-xs text-muted-foreground">
        No role is assigned to your account in this organization.
      </p>
    )
  }
  if (capabilities.size === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This role is read-only in the app: it can view documents but cannot change them.
      </p>
    )
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {[...capabilities].map((capability) => (
        <li key={capability}>
          <Badge tone="outline">{CAPABILITY_LABELS[capability]}</Badge>
        </li>
      ))}
    </ul>
  )
}

interface PendingRemoval {
  member: OrganizationMember
}

export function TeamPage() {
  useDocumentTitle('Members')
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const activeOrganizationId = useAuthStore((state) => state.activeOrganizationId)
  const { activeOrganization } = useActiveOrganization()
  const { role, roleName, can, isLoading: roleLoading } = useCapabilities()
  const canInvite = !roleLoading && can('members:invite')
  const canManageRoles = !roleLoading && can('members:manage_roles')
  const canRemove = !roleLoading && can('members:remove')
  const canManageMembers = canInvite || canManageRoles || canRemove

  const [inviteOpen, setInviteOpen] = useState(false)
  const [removal, setRemoval] = useState<PendingRemoval | null>(null)
  const [revocation, setRevocation] = useState<Invitation | null>(null)

  const membersQuery = useQuery({
    queryKey: queryKeys.members(activeOrganizationId),
    queryFn: () => membersApi.list(),
    enabled: Boolean(activeOrganizationId),
  })

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations(activeOrganizationId),
    queryFn: () => membersApi.invitations(),
    enabled: Boolean(activeOrganizationId) && canInvite,
  })

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles,
    queryFn: () => rbacApi.roles(),
    staleTime: 10 * 60_000,
  })

  const permissionsQuery = useQuery({
    queryKey: queryKeys.permissions,
    queryFn: () => rbacApi.permissions(),
    staleTime: 10 * 60_000,
  })

  const invalidateTeam = () => {
    void queryClient.invalidateQueries({ queryKey: ['team', activeOrganizationId] })
  }

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rbacApi.assignRole({ user_id: userId, role_id: roleId }),
    onSuccess: () => {
      toast.success('Role updated.')
      invalidateTeam()
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'The role could not be updated.')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => membersApi.remove(userId),
    onSuccess: () => {
      toast.success('Member removed from the organization.')
      invalidateTeam()
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'The member could not be removed.')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => membersApi.revokeInvitation(invitationId),
    onSuccess: () => {
      toast.success('Invitation revoked.')
      invalidateTeam()
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'The invitation could not be revoked.'
      )
    },
  })

  const members = membersQuery.data ?? []
  const invitations = invitationsQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const permissions = permissionsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={activeOrganization?.name ?? 'Organization'}
        title="Members"
        description="Everyone with access to this organization, their role, and the invitations that are still waiting to be accepted."
        context={
          <Badge tone="gold">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            {roleLoading ? 'Resolving your role…' : (roleName ?? 'No role assigned')}
          </Badge>
        }
        actions={
          <>
            {canInvite && !roleLoading && (
              <Button variant="accent" onClick={() => setInviteOpen(true)}>
                <UserPlus />
                Invite member
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                void membersQuery.refetch()
                if (canInvite) void invitationsQuery.refetch()
              }}
              loading={
                (membersQuery.isFetching || invitationsQuery.isFetching) && !membersQuery.isLoading
              }
            >
              <RefreshCw />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <MotionCard interactive={false} delay={0.04}>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" aria-hidden="true" />
                  Member directory
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {membersQuery.isSuccess
                    ? `${members.length} ${members.length === 1 ? 'person has' : 'people have'} access to ${activeOrganization?.name ?? 'this organization'}.`
                    : 'Loading the people in this organization.'}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {membersQuery.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : membersQuery.isError ? (
                <ErrorState
                  error={membersQuery.error}
                  compact
                  onRetry={() => void membersQuery.refetch()}
                />
              ) : members.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No members yet"
                  description="Invite a teammate to give them access to this organization."
                  action={
                    canInvite ? (
                      <Button variant="accent" onClick={() => setInviteOpen(true)}>
                        <UserPlus />
                        Invite member
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                  {members.map((member) => {
                    const isSelf = member.user_id === user?.id
                    const isRowUpdating =
                      roleMutation.isPending && roleMutation.variables?.userId === member.user_id
                    return (
                      <li
                        key={member.membership_id}
                        className="flex flex-col gap-3 px-3.5 py-3.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/40 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <UserAvatar
                            name={member.full_name}
                            email={member.email}
                            className="h-9 w-9 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-medium">
                                {member.full_name || member.email.split('@')[0]}
                              </p>
                              {isSelf && <Badge tone="gold">You</Badge>}
                              {!member.is_active && <Badge tone="warning">Inactive</Badge>}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                            <p className="mt-1 text-2xs text-muted-foreground">
                              Joined <RelativeTime value={member.joined_at} />
                              {member.role_name ? ` · ${member.role_name}` : ' · no role'}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          {canManageRoles && !isSelf && member.role_id ? (
                            <Select
                              value={member.role_id}
                              onValueChange={(roleId) =>
                                roleMutation.mutate({ userId: member.user_id, roleId })
                              }
                              disabled={rolesQuery.isLoading || isRowUpdating}
                            >
                              <SelectTrigger
                                className="h-9 w-[10.5rem] text-xs"
                                aria-label={`Role for ${member.full_name || member.email}`}
                              >
                                <SelectValue placeholder="Choose role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge tone={member.role_name ? 'navy' : 'warning'}>
                              {member.role_name ?? 'No role'}
                            </Badge>
                          )}

                          {canRemove && !isSelf && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${member.full_name || member.email}`}
                              onClick={() => setRemoval({ member })}
                            >
                              <UserMinus />
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {!roleLoading && !canManageMembers && (
                <div className="mt-3">
                  <PermissionNotice message="Only roles with member permissions can invite, change roles or remove people. You can still see who has access." />
                </div>
              )}
              {!roleLoading && canManageMembers && !canInvite && (
                <div className="mt-3">
                  <PermissionNotice message="Your role can manage existing members but cannot create new invitations." />
                </div>
              )}
            </CardContent>
          </MotionCard>

          {canInvite && (
            <MotionCard interactive={false} delay={0.1}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <MailPlus className="h-4 w-4 text-accent" aria-hidden="true" />
                    Pending invitations
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Links that have been created but not accepted yet.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {invitationsQuery.isLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map((index) => (
                      <Skeleton key={index} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : invitationsQuery.isError ? (
                  <ErrorState
                    error={invitationsQuery.error}
                    compact
                    onRetry={() => void invitationsQuery.refetch()}
                  />
                ) : invitations.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3.5 py-6 text-center text-sm text-muted-foreground">
                    No pending invitations.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                    {invitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex flex-col gap-3 px-3.5 py-3.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/40 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{invitation.email}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            <Badge tone="outline">{invitation.role_name}</Badge> invited
                            {invitation.invited_by_name ? ` by ${invitation.invited_by_name}` : ''}
                          </p>
                          <p className="mt-1 text-2xs text-muted-foreground">
                            Expires {formatDate(invitation.expires_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void copyToClipboard(invitation.invite_url, 'Invitation link')
                            }
                          >
                            <Copy />
                            Copy link
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Revoke invitation for ${invitation.email}`}
                            onClick={() => setRevocation(invitation)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </MotionCard>
          )}
        </div>

        <div className="space-y-5">
          <MotionCard interactive={false} delay={0.08}>
            <CardHeader>
              <CardTitle>Your membership</CardTitle>
              <p className="text-xs text-muted-foreground">In {activeOrganization?.name}.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {roleLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              ) : role ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">{role.name}</Badge>
                    {role.organization_id === null && <Badge tone="neutral">Platform role</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {role.description ?? 'No description is recorded for this role.'}
                  </p>
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <p className="label-caps">Capabilities in this app</p>
                    <PermissionPreview roleName={roleName} />
                    <p className="text-2xs leading-relaxed text-muted-foreground">
                      Friendly labels are derived from the role name because the API does not yet
                      expose a role-to-permission mapping. The API remains authoritative and can
                      still refuse an action.
                    </p>
                  </div>
                  {user && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-2xs text-muted-foreground">Your account</p>
                        <p className="truncate text-xs">{user.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void copyToClipboard(user.id, 'User ID')}
                        aria-label="Copy your user ID"
                      >
                        <Copy />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  The API did not return a role for your account in this organization.
                </p>
              )}
            </CardContent>
          </MotionCard>

          <MotionCard interactive={false} delay={0.14}>
            <CardContent className="p-5 sm:p-6">
              <Tabs defaultValue="roles">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="roles">
                    <Users className="h-3.5 w-3.5" />
                    Roles ({roles.length})
                  </TabsTrigger>
                  <TabsTrigger value="permissions">
                    <KeyRound className="h-3.5 w-3.5" />
                    Permissions ({permissions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="roles" className="space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Roles are returned by the API as a flat catalogue. Some are platform-wide,
                    others belong to an organization.
                  </p>
                  {rolesQuery.isLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <Skeleton key={index} className="h-16 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : rolesQuery.isError ? (
                    <ErrorState
                      error={rolesQuery.error}
                      compact
                      onRetry={() => void rolesQuery.refetch()}
                    />
                  ) : (
                    <ul className="space-y-2">
                      {roles.map((option) => {
                        const isMine = option.id === role?.id
                        return (
                          <li
                            key={option.id}
                            className="rounded-lg border border-border/70 bg-muted/15 px-3.5 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{option.name}</p>
                              {isMine && (
                                <Badge tone="success">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  Your role
                                </Badge>
                              )}
                              <Badge tone={option.organization_id === null ? 'neutral' : 'outline'}>
                                {option.organization_id === null ? 'Platform' : 'Organization'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="ml-auto h-6 w-6"
                                onClick={() => void copyToClipboard(option.id, 'Role ID')}
                                aria-label={`Copy ${option.name} role ID`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {option.description ?? 'No description is recorded for this role.'}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="permissions" className="space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Permission names are issued by the API. Role-to-permission links are not
                    exposed, so this is a reference catalogue rather than the effective grants of a
                    role.
                  </p>
                  {permissionsQuery.isLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <Skeleton key={index} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : permissionsQuery.isError ? (
                    <ErrorState
                      error={permissionsQuery.error}
                      compact
                      onRetry={() => void permissionsQuery.refetch()}
                    />
                  ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                      {permissions.map((permission) => (
                        <li key={permission.id} className="px-3.5 py-3">
                          <p className="font-mono text-xs font-medium">
                            {permission.name}
                            {permission.name.includes(':')
                              ? ''
                              : ` · ${titleCase(permission.name)}`}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {permission.description ?? 'No description is recorded.'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </MotionCard>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <p>
          Invitees join this organization as{' '}
          <span className="font-medium text-foreground">Member</span> by default and never receive a
          personal workspace. Invitations are single-use and expire automatically. Docuflow has no
          email service configured, so share the invitation link yourself.
        </p>
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationName={activeOrganization?.name ?? 'this organization'}
        inviterName={user?.full_name}
        onInvited={invalidateTeam}
      />

      <ConfirmDialog
        open={Boolean(removal)}
        onOpenChange={(open) => {
          if (!open) setRemoval(null)
        }}
        title="Remove this member?"
        description={
          removal ? (
            <>
              <span className="font-medium text-foreground">
                {removal.member.full_name || removal.member.email}
              </span>{' '}
              will lose access to {activeOrganization?.name}. Their account is not deleted and they
              can be invited again later.
            </>
          ) : null
        }
        confirmLabel="Remove member"
        destructive
        onConfirm={async () => {
          if (!removal) return
          await removeMutation.mutateAsync(removal.member.user_id)
          setRemoval(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(revocation)}
        onOpenChange={(open) => {
          if (!open) setRevocation(null)
        }}
        title="Revoke this invitation?"
        description={
          revocation ? (
            <>
              The link sent to{' '}
              <span className="font-medium text-foreground">{revocation.email}</span> will stop
              working immediately. You can create a new invitation afterwards.
            </>
          ) : null
        }
        confirmLabel="Revoke invitation"
        destructive
        onConfirm={async () => {
          if (!revocation) return
          await revokeMutation.mutateAsync(revocation.id)
          setRevocation(null)
        }}
      />
    </div>
  )
}
