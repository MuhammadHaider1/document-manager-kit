import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Building2,
  Check,
  Copy,
  Database,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotionCard } from '@/components/motion/MotionCard'
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
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionNotice } from '@/components/shared/PermissionNotice'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { organizationsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { API_BASE_URL } from '@/lib/constants'
import { cn, formatDateTime, slugify } from '@/lib/utils'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'
import { useUiStore, type ThemePreference } from '@/store/ui'

const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter the organization name.')
    .max(120, 'Keep the name under 120 characters.'),
  slug: z
    .string()
    .trim()
    .min(2, 'Enter a workspace URL.')
    .max(60, 'Keep the URL under 60 characters.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.'),
})

type OrganizationValues = z.infer<typeof organizationSchema>

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  } catch {
    toast.error('This browser would not allow copying.')
  }
}

export function SettingsPage() {
  useDocumentTitle('Settings')
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const refreshOrganizations = useAuthStore((state) => state.refreshOrganizations)
  const { activeOrganization } = useActiveOrganization()
  const { can, roleName, isLoading: roleLoading } = useCapabilities()
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)

  const canEditOrganization = can('organization:update')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: activeOrganization?.name ?? '',
      slug: activeOrganization?.slug ?? '',
    },
  })

  useEffect(() => {
    reset({
      name: activeOrganization?.name ?? '',
      slug: activeOrganization?.slug ?? '',
    })
  }, [activeOrganization?.id, activeOrganization?.name, activeOrganization?.slug, reset])

  const saveOrganization = async (values: OrganizationValues) => {
    if (!activeOrganization) return
    try {
      await organizationsApi.update(activeOrganization.id, {
        name: values.name.trim(),
        slug: values.slug.trim(),
      })
      await refreshOrganizations()
      toast.success('Organization settings saved.')
      reset({
        name: values.name.trim(),
        slug: values.slug.trim(),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors.slug) {
          setError('slug', { message: error.fieldErrors.slug })
          return
        }
        if (error.fieldErrors.name) {
          setError('name', { message: error.fieldErrors.name })
          return
        }
        toast.error(error.message)
        return
      }
      toast.error('The organization could not be updated.')
    }
  }

  const deleteOrganization = async () => {
    if (!activeOrganization || deleteConfirm !== activeOrganization.slug) return
    setDeleting(true)
    try {
      await organizationsApi.remove(activeOrganization.id)
      toast.success(`${activeOrganization.name} was deleted.`)
      setDeleteOpen(false)
      setDeleteConfirm('')
      await refreshOrganizations()
      navigate('/app', { replace: true })
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'The organization could not be deleted.'
      )
    } finally {
      setDeleting(false)
    }
  }

  const handleSignOut = async () => {
    await logout()
    toast.success('You have been signed out.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace configuration"
        title="Settings"
        description="Manage this organization's identity, review your account, and choose how Docuflow appears."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {roleName ?? 'No role assigned'}
            </Badge>
            {activeOrganization && <Badge tone="outline">{activeOrganization.slug}</Badge>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <MotionCard interactive={false}>
            <CardHeader>
              <SectionHeading
                title="Organization profile"
                description="The display name and workspace slug other members see."
              />
            </CardHeader>
            <CardContent>
              {!roleLoading && !canEditOrganization && (
                <PermissionNotice
                  className="mb-4"
                  message="Your role can view these settings but not change them. Ask an organization administrator for access."
                />
              )}
              <form onSubmit={handleSubmit(saveOrganization)} className="space-y-4" noValidate>
                <Field
                  label="Organization name"
                  htmlFor="settings-org-name"
                  error={errors.name?.message}
                  required
                >
                  <Input
                    id="settings-org-name"
                    placeholder="Raman & Associates"
                    disabled={!canEditOrganization || isSubmitting}
                    aria-invalid={Boolean(errors.name)}
                    {...register('name')}
                  />
                </Field>
                <Field
                  label="Workspace URL"
                  htmlFor="settings-org-slug"
                  error={errors.slug?.message}
                  hint="Lowercase, hyphens"
                  required
                >
                  <Input
                    id="settings-org-slug"
                    placeholder="raman-associates"
                    disabled={!canEditOrganization || isSubmitting}
                    aria-invalid={Boolean(errors.slug)}
                    {...register('slug')}
                  />
                </Field>

                <dl className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3.5 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Organization ID</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5">
                      <span className="truncate font-mono">{activeOrganization?.id ?? '—'}</span>
                      {activeOrganization && (
                        <button
                          type="button"
                          onClick={() => void copyValue(activeOrganization.id, 'Organization ID')}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          aria-label="Copy organization ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="mt-0.5">
                      {activeOrganization ? formatDateTime(activeOrganization.created_at) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="mt-0.5">
                      {activeOrganization?.is_active === false ? 'Inactive' : 'Active'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last updated</dt>
                    <dd className="mt-0.5">
                      {activeOrganization ? formatDateTime(activeOrganization.updated_at) : '—'}
                    </dd>
                  </div>
                </dl>

                {canEditOrganization && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="submit"
                      variant="accent"
                      loading={isSubmitting}
                      disabled={!isDirty && !isSubmitting}
                    >
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!isDirty || isSubmitting}
                      onClick={() =>
                        reset({
                          name: activeOrganization?.name ?? '',
                          slug: activeOrganization?.slug ?? '',
                        })
                      }
                    >
                      Discard
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        const next = slugify(activeOrganization?.name ?? '')
                        if (next) {
                          reset({
                            name: activeOrganization?.name ?? '',
                            slug: next,
                          })
                        }
                      }}
                    >
                      Rebuild slug from name
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </MotionCard>

          <MotionCard interactive={false}>
            <CardHeader>
              <SectionHeading
                title="Account"
                description="Profile details returned by the API. There is no profile update endpoint yet."
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={user?.full_name} email={user?.email} className="h-11 w-11" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user?.full_name ?? 'Account'}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap gap-1.5">
                  {user?.is_superuser && <Badge tone="gold">Superuser</Badge>}
                  <Badge tone={user?.is_active === false ? 'danger' : 'success'}>
                    {user?.is_active === false ? 'Inactive' : 'Active'}
                  </Badge>
                </div>
              </div>

              <dl className="space-y-2 border-t border-border/60 pt-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">User ID</dt>
                  <dd className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono">{user?.id ?? '—'}</span>
                    {user && (
                      <button
                        type="button"
                        onClick={() => void copyValue(user.id, 'User ID')}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label="Copy user ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Role in this organization</dt>
                  <dd className="font-medium">{roleName ?? 'Not assigned'}</dd>
                </div>
              </dl>

              <Button
                variant="outline"
                onClick={() => void handleSignOut()}
                className="w-full sm:w-auto"
              >
                <LogOut />
                Sign out of this browser
              </Button>
            </CardContent>
          </MotionCard>
        </div>

        <div className="space-y-5">
          <MotionCard interactive={false}>
            <CardHeader>
              <SectionHeading title="Appearance" description="Applies to this browser only." />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
                {THEMES.map((option) => {
                  const Icon = option.icon
                  const active = theme === option.value
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border px-2 py-3.5 text-xs transition-[color,background-color,border-color,box-shadow] duration-200',
                        active
                          ? 'border-accent/60 bg-accent-soft/60 text-foreground shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:border-accent/40 hover:bg-muted/30 hover:text-foreground'
                      )}
                      whileHover={reduce ? undefined : { y: -2 }}
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {option.label}
                      {active && <Check className="h-3 w-3 text-accent" aria-hidden="true" />}
                    </motion.button>
                  )
                })}
              </div>
              <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                System follows your operating system preference and updates automatically when it
                changes.
              </p>
            </CardContent>
          </MotionCard>

          <MotionCard interactive={false}>
            <CardHeader>
              <SectionHeading title="Session & data" />
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-start gap-2">
                <ShieldCheck
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                  aria-hidden="true"
                />
                Access tokens are held in memory only. The refresh token lives in sessionStorage and
                is cleared when the browser tab closes or you sign out.
              </p>
              <p className="flex items-start gap-2">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                Tenant data is cached per organization and discarded when you switch workspaces.
              </p>
              <p className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                API base path: <span className="font-mono">{API_BASE_URL}</span>
              </p>
            </CardContent>
          </MotionCard>

          {activeOrganization && (
            <MotionCard interactive={false} className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Deleting an organization removes its documents, folders, comments and audit
                  history for every member. This cannot be undone.
                </p>
              </CardHeader>
              <CardContent>
                {roleLoading ? (
                  <div className="h-9 w-44 animate-pulse rounded-md bg-muted" aria-hidden="true" />
                ) : canEditOrganization ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setDeleteConfirm('')
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 />
                    Delete organization
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only organization administrators can delete a workspace.
                  </p>
                )}
              </CardContent>
            </MotionCard>
          )}
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return
          setDeleteOpen(open)
          if (!open) setDeleteConfirm('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {activeOrganization?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the organization and all of its documents, versions, comments
              and audit records. Every member loses access immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field
              label={`Type “${activeOrganization?.slug ?? ''}” to confirm`}
              htmlFor="delete-org-confirm"
              required
            >
              <Input
                id="delete-org-confirm"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={deleting}
                className="font-mono text-xs"
              />
            </Field>
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-muted-foreground">
              <UserRound
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
                aria-hidden="true"
              />
              The API will refuse this request if your role does not permit organization deletion.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleting}
              disabled={deleteConfirm !== activeOrganization?.slug}
              onClick={() => void deleteOrganization()}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
