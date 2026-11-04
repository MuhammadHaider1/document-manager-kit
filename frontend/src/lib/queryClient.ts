import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Never retry auth, permission, validation or not-found errors.
          if ([400, 401, 403, 404, 422].includes(error.status)) return false
          if (error.status === 429) return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

export const queryKeys = {
  me: ['auth', 'me'] as const,
  organizations: ['organizations'] as const,
  organization: (id: string) => ['organizations', id] as const,
  folders: (organizationId: string | null) => ['folders', organizationId] as const,
  documents: (organizationId: string | null, params: unknown) =>
    ['documents', organizationId, params] as const,
  document: (organizationId: string | null, id: string) =>
    ['documents', organizationId, id] as const,
  versions: (organizationId: string | null, id: string) =>
    ['documents', organizationId, id, 'versions'] as const,
  comments: (organizationId: string | null, id: string) =>
    ['documents', organizationId, id, 'comments'] as const,
  audit: (organizationId: string | null, params: unknown) =>
    ['audit', organizationId, params] as const,
  team: (organizationId: string | null) => ['team', organizationId] as const,
  members: (organizationId: string | null) => ['team', organizationId, 'members'] as const,
  invitations: (organizationId: string | null) => ['team', organizationId, 'invitations'] as const,
  invitationPreview: (token: string) => ['invitations', 'preview', token] as const,
  myRole: (organizationId: string | null, userId: string | undefined) =>
    ['team', organizationId, 'role', userId] as const,
  roles: ['roles'] as const,
  permissions: ['permissions'] as const,
  notifications: (unreadOnly: boolean) => ['notifications', { unreadOnly }] as const,
  notificationCount: ['notifications', 'unread-count'] as const,
}
