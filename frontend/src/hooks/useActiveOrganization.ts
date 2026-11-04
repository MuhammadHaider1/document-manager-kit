import { useAuthStore } from '@/store/auth'

export function useActiveOrganization() {
  const organizations = useAuthStore((state) => state.organizations)
  const activeOrganizationId = useAuthStore((state) => state.activeOrganizationId)
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ?? null

  return { activeOrganization, activeOrganizationId, organizations }
}
