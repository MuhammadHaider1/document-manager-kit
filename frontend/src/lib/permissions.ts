/**
 * Capability map
 * --------------
 * GAP: the API returns roles and permissions as separate lists but exposes no
 * role→permission links and no "my permissions" endpoint. Until that exists the
 * UI derives capabilities from the role name returned by
 * GET /rbac/members/{user_id}/role. This mapping is intentionally in one place
 * so it can be swapped for a server-provided permission list later. The backend
 * remains the source of truth: every action is still enforced server-side and a
 * 403 is shown as a friendly permission state.
 */
export type Capability =
  | 'documents:create'
  | 'documents:update'
  | 'documents:delete'
  | 'folders:manage'
  | 'comments:write'
  | 'organizations:create'
  | 'organization:update'
  | 'members:invite'
  | 'members:manage_roles'
  | 'members:remove'
  | 'audit:read'

const ALL_CAPABILITIES: Capability[] = [
  'documents:create',
  'documents:update',
  'documents:delete',
  'folders:manage',
  'comments:write',
  'organizations:create',
  'organization:update',
  'members:invite',
  'members:manage_roles',
  'members:remove',
  'audit:read',
]

const READ_ONLY: Capability[] = []

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  'Super Admin': ALL_CAPABILITIES,
  'Platform Admin': ALL_CAPABILITIES,
  'Organization Owner': ALL_CAPABILITIES,
  Admin: ALL_CAPABILITIES,
  'Workspace Admin': [
    'documents:create',
    'documents:update',
    'documents:delete',
    'folders:manage',
    'comments:write',
    'organization:update',
    'members:invite',
    'audit:read',
  ],
  Contributor: ['documents:create', 'documents:update', 'folders:manage', 'comments:write'],
  Member: ['documents:create', 'documents:update', 'folders:manage', 'comments:write'],
  Reviewer: ['comments:write'],
  Viewer: READ_ONLY,
}

export function capabilitiesForRole(roleName: string | null | undefined): Set<Capability> {
  if (!roleName) return new Set()
  return new Set(ROLE_CAPABILITIES[roleName] ?? READ_ONLY)
}

/** Unknown or missing roles fail closed for write actions. */
export function hasCapability(
  roleName: string | null | undefined,
  capability: Capability
): boolean {
  return capabilitiesForRole(roleName).has(capability)
}
