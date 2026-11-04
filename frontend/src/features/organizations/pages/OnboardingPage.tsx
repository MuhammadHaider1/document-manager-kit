import { Building2, Copy, LogOut, ShieldCheck } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'
import { OrganizationForm } from '@/features/organizations/components/OrganizationForm'

async function copyAccountId(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Account ID copied.')
  } catch {
    toast.error('This browser would not allow copying.')
  }
}

export function OnboardingPage() {
  useDocumentTitle('Create your organization')
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const organizations = useAuthStore((state) => state.organizations)
  const logout = useAuthStore((state) => state.logout)

  // Onboarding exists to create a first workspace. Someone who already belongs
  // to an organization must not be offered a second one from here; creating
  // another organization is an owner/admin action in the switcher.
  if (organizations.length > 0) return <Navigate to="/app" replace />

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-8">
        <Logo to="/app" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }))
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-2xl animate-fade-up">
          <div className="mb-6 space-y-2 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="font-display text-[2rem] leading-tight tracking-tight">
              Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              Create your firm&apos;s workspace to begin. Documents, members and permissions are
              isolated to this organization and can never be seen by another.
            </p>
          </div>

          <div className="surface p-6 sm:p-8">
            <OrganizationForm
              autoFocus
              submitLabel="Create workspace"
              onCreated={() => navigate('/app', { replace: true })}
            />
            {user && (
              <div className="mt-6 flex items-start justify-between gap-3 border-t border-border/70 pt-4">
                <div className="min-w-0">
                  <p className="label-caps">Your account ID</p>
                  <p className="mt-1 truncate font-mono text-xs">{user.id}</p>
                  <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                    Invited to an existing workspace? Share this ID with its administrator. They
                    need it to add your account before assigning your role.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void copyAccountId(user.id)}
                  aria-label="Copy your account ID"
                >
                  <Copy />
                </Button>
              </div>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-2xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            You can join additional organizations when an owner invites you.
          </p>
        </div>
      </main>
    </div>
  )
}
