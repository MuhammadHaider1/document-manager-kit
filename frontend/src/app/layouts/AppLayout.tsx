import { Suspense } from 'react'
import { Menu, Search } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/shared/AppSidebar'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { Logo } from '@/components/shared/Logo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { UserMenu } from '@/components/shared/UserMenu'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { OrganizationSwitcher } from '@/features/organizations/components/OrganizationSwitcher'
import { NotificationMenu } from '@/features/notifications/components/NotificationMenu'
import { PageLoader } from '@/components/shared/PageLoader'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useUiStore } from '@/store/ui'

export function AppLayout() {
  const { organizations, activeOrganization } = useActiveOrganization()
  const { can, roleName } = useCapabilities()
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)
  const location = useLocation()

  if (organizations.length === 0) {
    return <Navigate to="/app/onboarding" replace />
  }

  if (!activeOrganization) {
    return <Navigate to="/app/onboarding" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[16.25rem] shrink-0 border-r border-border/80 lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b border-border/70 px-5">
            <Logo to="/app" />
          </div>
          <AppSidebar can={can} roleName={roleName} className="flex-1" />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/80 bg-background/85 px-3 backdrop-blur-md sm:px-5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu />
            </Button>

            <OrganizationSwitcher />

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="hidden w-56 justify-start gap-2 text-muted-foreground md:flex"
                onClick={() => setCommandOpen(true)}
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1 text-left text-xs">Search or jump to…</span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-2xs">
                  ⌘K
                </kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setCommandOpen(true)}
                aria-label="Search"
              >
                <Search />
              </Button>
              <NotificationMenu />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main
            id="main-content"
            className="mx-auto w-full max-w-[88rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <Suspense fallback={<PageLoader label="Loading page" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      <Dialog open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DialogContent className="left-0 top-0 h-full w-[17.5rem] max-w-[85vw] -translate-x-0 -translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 data-[state=open]:slide-in-from-left">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-16 items-center border-b border-border/70 px-5">
            <Logo to="/app" />
          </div>
          <AppSidebar
            can={can}
            roleName={roleName}
            onNavigate={() => setSidebarOpen(false)}
            className="flex-1"
          />
        </DialogContent>
      </Dialog>

      <CommandPalette can={can} />
      <span className="sr-only" aria-live="polite">
        {location.pathname}
      </span>
    </div>
  )
}
