import type { components } from './api'

type Schemas = components['schemas']

export type User = Schemas['UserResponseSchema']
export type UserSummary = Schemas['UserMinResponse']
export type Organization = Schemas['OrganizationResponse']
export type TokenResponse = Schemas['TokenResponseSchema']
export type RegisterPayload = Schemas['UserCreate']
export type LoginPayload = Schemas['LoginSchema']
export type Document = Schemas['DocumentResponse']
export type DocumentVersion = Schemas['DocumentVersionResponse']
export type DocumentDownload = Schemas['DocumentDownloadResponse']
export type Folder = Schemas['FolderResponse']
export type AuditLog = Schemas['AuditLogResponse']
export type Comment = Schemas['CommentResponse']
export type Notification = Schemas['NotificationResponse']
export type QueryResult = Schemas['QueryResponse']
export type OrganizationMember = Schemas['MemberResponse']
export type Invitation = Schemas['InvitationResponse']
export type InvitationPreview = Schemas['InvitationPreview']
export type InvitationCreatePayload = Schemas['InvitationCreate']
export type AcceptInvitationResult = Schemas['AcceptInvitationResponse']

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

/**
 * Roles and permissions are returned untyped by the API (the OpenAPI document
 * declares `{}`), so these shapes are taken from the live response payload.
 */
export interface Role {
  id: string
  name: string
  description: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface MemberRole {
  user_id: string
  organization_id: string
  role: Role
}

export interface DocumentSearchParams {
  q?: string
  folder_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface AuditSearchParams {
  organization_id: string
  limit?: number
  offset?: number
  entity_type?: string
}

export interface UploadDocumentInput {
  title: string
  description?: string
  folderId?: string
  file: File
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'
