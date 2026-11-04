import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { CreateOrganizationDialog } from './CreateOrganizationDialog'

export function OrganizationSwitcher({ className }: { className?: string }) {
  const { activeOrganization, organizations } = useActiveOrganization()
  const { can, isLoading } = useCapabilities()
  const setActiveOrganization = useAuthStore((state) => state.setActiveOrganization)
  const [createOpen, setCreateOpen] = useState(false)
  const canCreateOrganization = !isLoading && can('organizations:create')

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'h-auto min-w-0 max-w-[15rem] justify-start gap-2 px-2 py-1.5 text-left',
              className
            )}
            aria-label="Switch organization"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15 dark:text-foreground">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-semibold leading-tight">
                {activeOrganization?.name ?? 'Select organization'}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {organizations.length}{' '}
                {organizations.length === 1 ? 'organization' : 'organizations'}
              </span>
            </span>
            <ChevronsUpDown
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
          {organizations.map((organization) => (
            <DropdownMenuItem
              key={organization.id}
              onSelect={() => setActiveOrganization(organization.id)}
              className="gap-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-2xs font-semibold">
                {organization.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{organization.name}</span>
                <span className="block truncate text-2xs text-muted-foreground">
                  {organization.slug}
                </span>
              </span>
              {organization.id === activeOrganization?.id && (
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          ))}
          {canCreateOrganization && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Plus />
                Create organization
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canCreateOrganization && (
        <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </>
  )
}
