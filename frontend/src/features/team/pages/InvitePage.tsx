import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Building2, LogOut, ShieldCheck, UserPlus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { PageLoader } from '@/components/shared/PageLoader'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { membersApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/queryClient'
import { formatDate } from '@/lib/utils'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'

export function InvitePage() {
  useDocumentTitle('Organization invitation')
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const refreshOrganizations = useAuthStore((state) => state.refreshOrganizations)
  const setActiveOrganization = useAuthStore((state) => state.setActiveOrganization)

  const previewQuery = useQuery({
    queryKey: queryKeys.invitationPreview(token),
    queryFn: () => membersApi.previewInvitation(token),
    enabled: Boolean(token),
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: () => membersApi.acceptInvitation(token),
    onSuccess: async (result) => {
      const organizations = await refreshOrganizations()
      setActiveOrganization(result.organization_id)
      toast.success(result.message)
      if (organizations.some((organization) => organization.id === result.organization_id)) {
        navigate('/app', { replace: true })
      } else {
        navigate('/app/onboarding', { replace: true })
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'The invitation could not be accepted. Please try again.'
      )
    },
  })

  const preview = previewQuery.data
  const emailMismatch =
    Boolean(preview && user) && preview!.email.toLowerCase() !== user!.email.toLowerCase()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-8">
        <Logo to="/" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void logout().then(() =>
                navigate('/login', {
                  replace: true,
                  state: { from: `/invite/${token}` },
                })
              )
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-xl animate-fade-up">
          {previewQuery.isLoading ? (
            <PageLoader label="Loading invitation" />
          ) : previewQuery.isError ? (
            <div className="surface space-y-4 p-6 text-center sm:p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-2">
                <h1 className="font-display text-2xl">This invitation is not available</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {previewQuery.error instanceof ApiError
                    ? previewQuery.error.message
                    : 'The invitation link is invalid or has expired.'}
                </p>
              </div>
              <Button variant="accent" onClick={() => navigate('/app', { replace: true })}>
                Go to your workspace
              </Button>
            </div>
          ) : preview ? (
            <div className="surface overflow-hidden">
              <div className="border-b border-border/70 bg-primary px-6 py-7 text-primary-foreground sm:px-8">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-xs uppercase tracking-[0.14em] text-primary-foreground/60">
                  You have been invited
                </p>
                <h1 className="mt-1 font-display text-[1.9rem] leading-tight">
                  Join {preview.organization_name}
                </h1>
                <p className="mt-2 text-sm text-primary-foreground/70">
                  {preview.invited_by_name
                    ? `${preview.invited_by_name} invited you to collaborate on Docuflow.`
                    : 'You have been invited to collaborate on Docuflow.'}
                </p>
              </div>

              <div className="space-y-5 p-6 sm:p-8">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3">
                    <dt className="label-caps">Organization</dt>
                    <dd className="mt-1 text-sm font-medium">{preview.organization_name}</dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3">
                    <dt className="label-caps">Your role</dt>
                    <dd className="mt-1">
                      <Badge tone="gold">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        {preview.role_name}
                      </Badge>
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3">
                    <dt className="label-caps">Invited email</dt>
                    <dd className="mt-1 break-all text-sm">{preview.email}</dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3">
                    <dt className="label-caps">Expires</dt>
                    <dd className="mt-1 text-sm">{formatDate(preview.expires_at)}</dd>
                  </div>
                </dl>

                {emailMismatch ? (
                  <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-3 text-sm">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                      <p className="leading-relaxed text-muted-foreground">
                        This invitation was sent to{' '}
                        <span className="font-medium text-foreground">{preview.email}</span>, but
                        you are signed in as{' '}
                        <span className="font-medium text-foreground">{user?.email}</span>. Sign in
                        with the invited address to accept it.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void logout().then(() =>
                          navigate('/login', {
                            replace: true,
                            state: { from: `/invite/${token}` },
                          })
                        )
                      }}
                    >
                      <LogOut />
                      Sign in with another account
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Accepting adds you to this organization as{' '}
                      <span className="font-medium text-foreground">{preview.role_name}</span>. Your
                      existing workspaces are not changed.
                    </p>
                    <Button
                      variant="accent"
                      size="lg"
                      className="w-full"
                      loading={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate()}
                    >
                      <UserPlus />
                      Join {preview.organization_name}
                      {!acceptMutation.isPending && <ArrowRight />}
                    </Button>
                  </div>
                )}

                <p className="text-2xs leading-relaxed text-muted-foreground">
                  Invitations are single-use. If this link has already been used, ask an
                  administrator of {preview.organization_name} for a new one.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
