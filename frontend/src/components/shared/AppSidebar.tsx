import { cn } from '@/lib/utils'
import { APP_NAV, type NavItem } from '@/app/navigation'
import { NavLink } from 'react-router-dom'
import { Lock } from 'lucide-react'
import type { Capability } from '@/lib/permissions'

interface AppSidebarProps {
  can: (capability: Capability) => boolean
  roleName: string | null
  onNavigate?: () => void
  className?: string
}

function Navigation({ can, onNavigate }: Pick<AppSidebarProps, 'can' | 'onNavigate'>) {
  const items = APP_NAV.filter((item) => !item.capability || can(item.capability))

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main navigation">
      <p className="px-2.5 pb-2 pt-4 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
        Workspace
      </p>
      {items.map((item) => (
        <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.875rem] font-medium text-muted-foreground transition-colors',
          'hover:bg-card hover:text-foreground',
          isActive &&
            'bg-card text-foreground shadow-sm before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-accent'
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

export function AppSidebar({ can, roleName, onNavigate, className }: AppSidebarProps) {
  return (
    <div className={cn('flex h-full flex-col bg-sidebar', className)}>
      <Navigation can={can} onNavigate={onNavigate} />
      <div className="mt-auto border-t border-border/70 px-5 py-4">
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" />
          <span className="truncate">{roleName ?? 'Organization member'}</span>
        </div>
        <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground/80">
          Client data is isolated to this organization.
        </p>
      </div>
    </div>
  )
}
