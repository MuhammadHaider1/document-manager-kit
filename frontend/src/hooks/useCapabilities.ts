import { useQuery } from '@tanstack/react-query'
import { rbacApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { capabilitiesForRole, type Capability } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth'

/**
 * Resolves the signed-in user's role in the active organization and derives the
 * UI capabilities from it. See lib/permissions.ts for the documented gap: the
 * API has no permissions-per-role endpoint yet.
 */
export function useCapabilities() {
  const user = useAuthStore((state) => state.user)
  const organizationId = useAuthStore((state) => state.activeOrganizationId)

  const roleQuery = useQuery({
    queryKey: queryKeys.myRole(organizationId, user?.id),
    queryFn: () => rbacApi.memberRole(user!.id),
    enabled: Boolean(user?.id && organizationId),
    staleTime: 5 * 60_000,
  })

  const roleName = roleQuery.data?.role.name ?? null
  const capabilities = capabilitiesForRole(roleName)

  return {
    role: roleQuery.data?.role ?? null,
    roleName,
    isLoading: roleQuery.isLoading,
    capabilities,
    can: (capability: Capability) => capabilities.has(capability),
  }
}
