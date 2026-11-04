import { useCapabilities } from '@/hooks/useCapabilities'
import { PageLoader } from '@/components/shared/PageLoader'
import { ForbiddenPage } from '@/components/shared/ForbiddenPage'
import type { Capability } from '@/lib/permissions'

/** UI-level gate. The API still enforces the same permission server-side. */
export function CapabilityGuard({
  capability,
  children,
}: {
  capability: Capability
  children: React.ReactNode
}) {
  const { can, isLoading } = useCapabilities()

  if (isLoading) return <PageLoader label="Checking permissions" />
  if (!can(capability)) return <ForbiddenPage />
  return <>{children}</>
}
