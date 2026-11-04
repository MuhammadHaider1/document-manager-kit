import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { useCapabilities } from '@/hooks/useCapabilities'

export function ForbiddenPage() {
  const { roleName } = useCapabilities()

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Restricted"
        title="You don't have access to this area"
        description="This section is limited to roles with audit or administration permissions."
      />
      <div className="surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="max-w-md space-y-1.5">
          <h2 className="font-display text-xl">Permission required</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {roleName
              ? `Your role in this organization is “${roleName}”, which does not include access to this page.`
              : 'Your role in this organization does not include access to this page.'}{' '}
            Ask an organization administrator if you need it.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app">Back to overview</Link>
        </Button>
      </div>
    </div>
  )
}
