import type {
  AcceptInvitationResult,
  AuditLog,
  AuditSearchParams,
  Comment,
  Document,
  DocumentDownload,
  DocumentSearchParams,
  DocumentVersion,
  Folder,
  Invitation,
  InvitationCreatePayload,
  InvitationPreview,
  LoginPayload,
  MemberRole,
  Notification,
  Organization,
  OrganizationMember,
  Paginated,
  Permission,
  QueryResult,
  RegisterPayload,
  Role,
  TokenResponse,
  User,
  UploadDocumentInput,
} from '@/types/domain'
import { RAG_PATH } from '../constants'
import { apiRequest, uploadFormData } from './client'

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<User>('/auth/register', { method: 'POST', body: payload, auth: false }),

  login: (payload: LoginPayload) =>
    apiRequest<TokenResponse>('/auth/login', { method: 'POST', body: payload, auth: false }),

  me: () => apiRequest<User>('/auth/me'),

  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
}

export const organizationsApi = {
  list: () => apiRequest<Organization[]>('/organizations/'),

  get: (organizationId: string) => apiRequest<Organization>(`/organizations/${organizationId}`),

  create: (payload: { name: string; slug: string }) =>
    apiRequest<Organization>('/organizations/', { method: 'POST', body: payload }),

  update: (organizationId: string, payload: Partial<Pick<Organization, 'name' | 'slug'>>) =>
    apiRequest<Organization>(`/organizations/${organizationId}`, {
      method: 'PATCH',
      body: payload,
    }),

  remove: (organizationId: string) =>
    apiRequest<void>(`/organizations/${organizationId}`, { method: 'DELETE' }),
}

export const foldersApi = {
  tree: () => apiRequest<Folder[]>('/folders/tree', { organization: true }),

  create: (payload: { name: string; parent_id?: string | null }) =>
    apiRequest<Folder>('/folders', { method: 'POST', body: payload, organization: true }),

  update: (folderId: string, payload: { name?: string; parent_id?: string | null }) =>
    apiRequest<Folder>(`/folders/${folderId}`, {
      method: 'PATCH',
      body: payload,
      organization: true,
    }),

  remove: (folderId: string) =>
    apiRequest<void>(`/folders/${folderId}`, { method: 'DELETE', organization: true }),
}

export const documentsApi = {
  search: (params: DocumentSearchParams) =>
    apiRequest<Paginated<Document>>('/documents/search', {
      query: { ...params },
      organization: true,
    }),

  get: (documentId: string) =>
    apiRequest<Document>(`/documents/${documentId}`, { organization: true }),

  upload: (
    input: UploadDocumentInput,
    options: { onProgress?: (p: number) => void; signal?: AbortSignal }
  ) => {
    const formData = new FormData()
    formData.append('title', input.title)
    formData.append('file', input.file)
    if (input.description?.trim()) formData.append('description', input.description.trim())
    if (input.folderId) formData.append('folder_id', input.folderId)
    return uploadFormData<Document>('/documents', formData, {
      ...options,
      organization: true,
    })
  },

  versions: (documentId: string) =>
    apiRequest<DocumentVersion[]>(`/documents/${documentId}/versions`, { organization: true }),

  uploadVersion: (
    documentId: string,
    file: File,
    options: { onProgress?: (p: number) => void; signal?: AbortSignal } = {}
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    return uploadFormData<DocumentVersion>(`/documents/${documentId}/versions`, formData, {
      ...options,
      organization: true,
    })
  },

  download: (documentId: string, versionId: string, expiresIn = 900) =>
    apiRequest<DocumentDownload>(`/documents/${documentId}/versions/${versionId}/download`, {
      query: { expires_in: expiresIn },
      organization: true,
    }),

  archive: (documentId: string) =>
    apiRequest<Document>(`/documents/${documentId}`, { method: 'DELETE', organization: true }),

  restore: (documentId: string) =>
    apiRequest<Document>(`/documents/${documentId}/restore`, {
      method: 'POST',
      organization: true,
    }),
}

export const rbacApi = {
  roles: () => apiRequest<Role[]>('/rbac/roles'),

  permissions: () => apiRequest<Permission[]>('/rbac/permissions'),

  memberRole: (userId: string) =>
    apiRequest<MemberRole>(`/rbac/members/${userId}/role`, { organization: true }),

  assignRole: (payload: { user_id: string; role_id: string }) =>
    apiRequest<void>('/rbac/assign-role', { method: 'POST', body: payload, organization: true }),

  revokeRole: (payload: { user_id: string }) =>
    apiRequest<void>('/rbac/revoke-role', { method: 'POST', body: payload, organization: true }),
}

export const membersApi = {
  list: () => apiRequest<OrganizationMember[]>('/members', { organization: true }),

  remove: (userId: string) =>
    apiRequest<{ message: string }>(`/members/${userId}`, {
      method: 'DELETE',
      organization: true,
    }),

  invitations: () => apiRequest<Invitation[]>('/members/invitations', { organization: true }),

  invite: (payload: InvitationCreatePayload) =>
    apiRequest<Invitation>('/members/invitations', {
      method: 'POST',
      body: payload,
      organization: true,
    }),

  revokeInvitation: (invitationId: string) =>
    apiRequest<{ message: string }>(`/members/invitations/${invitationId}/revoke`, {
      method: 'POST',
      organization: true,
    }),

  previewInvitation: (token: string) =>
    apiRequest<InvitationPreview>(`/members/invitations/preview/${encodeURIComponent(token)}`),

  acceptInvitation: (token: string) =>
    apiRequest<AcceptInvitationResult>('/members/invitations/accept', {
      method: 'POST',
      body: { token },
    }),
}

export const commentsApi = {
  list: (documentId: string) =>
    apiRequest<Comment[]>(`/comments/documents/${documentId}/comments`, { organization: true }),

  create: (documentId: string, payload: { content: string; parent_id?: string | null }) =>
    apiRequest<Comment>(`/comments/documents/${documentId}/comments`, {
      method: 'POST',
      body: payload,
      organization: true,
    }),

  update: (commentId: string, payload: { content: string }) =>
    apiRequest<Comment>(`/comments/${commentId}`, {
      method: 'PATCH',
      body: payload,
      organization: true,
    }),

  remove: (commentId: string) =>
    apiRequest<void>(`/comments/${commentId}`, { method: 'DELETE', organization: true }),
}

export const auditApi = {
  list: (params: AuditSearchParams) =>
    apiRequest<AuditLog[]>('/audit-logs/', { query: { ...params } }),
}

export const notificationsApi = {
  list: (params: { unread_only?: boolean; limit?: number; offset?: number } = {}) =>
    apiRequest<Notification[]>('/notifications/', { query: { ...params } }),

  markRead: (notificationId: string) =>
    apiRequest<Notification>(`/notifications/${notificationId}/read`, { method: 'PATCH' }),

  markAllRead: () => apiRequest<void>('/notifications/read-all', { method: 'POST' }),
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  type: 'registry_list' | 'document_answer' | 'general_answer' | 'error'
  answer: string
  sources: unknown[]
  disclaimer?: string
}

export const chatApi = {
  send: (payload: { query: string; history: ChatHistoryMessage[] }, signal?: AbortSignal) =>
    apiRequest<ChatResponse>('/chat/', {
      method: 'POST',
      body: payload,
      organization: true,
      signal,
    }),
}

export const ragApi = {
  query: (query: string) =>
    apiRequest<QueryResult>(RAG_PATH, { method: 'POST', body: { query }, organization: true }),
}
