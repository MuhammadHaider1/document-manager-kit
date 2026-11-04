import { describe, expect, it } from 'vitest'
import { capabilitiesForRole, hasCapability, type Capability } from '@/lib/permissions'

const WRITE_CAPABILITIES: Capability[] = [
  'documents:create',
  'documents:update',
  'documents:delete',
  'folders:manage',
  'members:invite',
  'members:manage_roles',
  'members:remove',
  'organization:update',
  'organizations:create',
  'comments:write',
]

describe('capability mapping', () => {
  it('grants every capability to organization owners and admins', () => {
    for (const role of ['Organization Owner', 'Admin', 'Super Admin', 'Platform Admin']) {
      const capabilities = capabilitiesForRole(role)
      for (const capability of WRITE_CAPABILITIES) {
        expect(capabilities.has(capability), `${role} should have ${capability}`).toBe(true)
      }
      expect(capabilities.has('audit:read')).toBe(true)
    }
  })

  it('keeps a viewer read-only and without audit access', () => {
    const capabilities = capabilitiesForRole('Viewer')
    expect(capabilities.size).toBe(0)
    for (const capability of WRITE_CAPABILITIES) {
      expect(capabilities.has(capability)).toBe(false)
    }
  })

  it('allows contributors to upload and comment but not archive or manage members', () => {
    expect(hasCapability('Contributor', 'documents:create')).toBe(true)
    expect(hasCapability('Contributor', 'documents:update')).toBe(true)
    expect(hasCapability('Contributor', 'comments:write')).toBe(true)
    expect(hasCapability('Contributor', 'documents:delete')).toBe(false)
    expect(hasCapability('Contributor', 'members:invite')).toBe(false)
    expect(hasCapability('Contributor', 'members:manage_roles')).toBe(false)
    expect(hasCapability('Contributor', 'members:remove')).toBe(false)
    expect(hasCapability('Contributor', 'audit:read')).toBe(false)
  })

  it('only lets owners and platform admins create organizations', () => {
    for (const role of ['Organization Owner', 'Admin', 'Super Admin', 'Platform Admin']) {
      expect(hasCapability(role, 'organizations:create'), role).toBe(true)
    }
    for (const role of ['Workspace Admin', 'Contributor', 'Member', 'Reviewer', 'Viewer']) {
      expect(hasCapability(role, 'organizations:create'), role).toBe(false)
    }
  })

  it('fails closed for unknown or missing roles', () => {
    expect(capabilitiesForRole(null).size).toBe(0)
    expect(capabilitiesForRole(undefined).size).toBe(0)
    expect(capabilitiesForRole('Auditor').size).toBe(0)
    expect(hasCapability('Some Future Role', 'documents:create')).toBe(false)
  })
})
