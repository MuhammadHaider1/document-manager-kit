import { create } from 'zustand'
import type { Organization, RegisterPayload, User } from '@/types/domain'
import { authApi, organizationsApi } from '@/lib/api/endpoints'
import {
  clearSession,
  getActiveOrganizationId,
  getRefreshToken,
  onSessionExpired,
  refreshAccessToken,
  setActiveOrganizationId,
  setSession,
} from '@/lib/api/session'
import { queryClient } from '@/lib/queryClient'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  user: User | null
  organizations: Organization[]
  activeOrganizationId: string | null
  notice: string | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: (notice?: string) => Promise<void>
  setActiveOrganization: (organizationId: string) => void
  refreshOrganizations: () => Promise<Organization[]>
  createOrganization: (payload: { name: string; slug: string }) => Promise<Organization>
  clearNotice: () => void
  sessionExpired: () => void
}

function pickActiveOrganization(
  organizations: Organization[],
  preferredId: string | null
): string | null {
  if (preferredId && organizations.some((organization) => organization.id === preferredId)) {
    return preferredId
  }
  return organizations[0]?.id ?? null
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'loading',
  user: null,
  organizations: [],
  activeOrganizationId: getActiveOrganizationId(),
  notice: null,

  bootstrap: async () => {
    if (!getRefreshToken()) {
      set({ status: 'anonymous', user: null, organizations: [] })
      return
    }

    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      set({ status: 'anonymous', user: null, organizations: [] })
      return
    }

    try {
      const [user, organizations] = await Promise.all([authApi.me(), organizationsApi.list()])
      const activeOrganizationId = pickActiveOrganization(organizations, get().activeOrganizationId)
      setActiveOrganizationId(activeOrganizationId)
      set({ status: 'authenticated', user, organizations, activeOrganizationId, notice: null })
    } catch {
      clearSession()
      set({ status: 'anonymous', user: null, organizations: [] })
    }
  },

  login: async (email, password) => {
    const tokens = await authApi.login({ email, password })
    setSession(tokens)
    const [user, organizations] = await Promise.all([authApi.me(), organizationsApi.list()])
    const activeOrganizationId = pickActiveOrganization(organizations, get().activeOrganizationId)
    setActiveOrganizationId(activeOrganizationId)
    set({ status: 'authenticated', user, organizations, activeOrganizationId, notice: null })
  },

  register: async (payload) => {
    await authApi.register(payload)
    await get().login(payload.email, payload.password)
  },

  logout: async (notice) => {
    try {
      await authApi.logout()
    } catch {
      // The local session is cleared regardless of the server response.
    }
    clearSession()
    setActiveOrganizationId(null)
    queryClient.clear()
    set({
      status: 'anonymous',
      user: null,
      organizations: [],
      activeOrganizationId: null,
      notice: notice ?? null,
    })
  },

  setActiveOrganization: (organizationId) => {
    if (organizationId === get().activeOrganizationId) return
    setActiveOrganizationId(organizationId)
    // Tenant data must never leak between organizations.
    queryClient.clear()
    set({ activeOrganizationId: organizationId })
  },

  refreshOrganizations: async () => {
    const organizations = await organizationsApi.list()
    const activeOrganizationId = pickActiveOrganization(organizations, get().activeOrganizationId)
    setActiveOrganizationId(activeOrganizationId)
    set({ organizations, activeOrganizationId })
    return organizations
  },

  createOrganization: async (payload) => {
    const organization = await organizationsApi.create(payload)
    setActiveOrganizationId(organization.id)
    queryClient.clear()
    set((state) => ({
      organizations: [...state.organizations, organization],
      activeOrganizationId: organization.id,
    }))
    return organization
  },

  clearNotice: () => set({ notice: null }),

  sessionExpired: () => {
    clearSession()
    queryClient.clear()
    set({
      status: 'anonymous',
      user: null,
      organizations: [],
      activeOrganizationId: null,
      notice: 'Your session expired. Please sign in again.',
    })
  },
}))

onSessionExpired(() => {
  useAuthStore.getState().sessionExpired()
})
