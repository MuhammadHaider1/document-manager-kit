import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Capability } from '@/lib/permissions'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { OrganizationSwitcher } from '../components/OrganizationSwitcher'

vi.mock('@/hooks/useCapabilities', () => ({ useCapabilities: vi.fn() }))
vi.mock('@/hooks/useActiveOrganization', () => ({ useActiveOrganization: vi.fn() }))

const organization = {
  id: '6b1c25b9-3687-4946-b300-6fca75fa60d5',
  name: 'QA UI Workspace',
  slug: 'qa-ui-workspace',
  is_active: true,
  created_at: '2026-10-29T10:00:00Z',
  updated_at: '2026-10-29T10:00:00Z',
}

function mockRole(roleName: string, canCreateOrganization: boolean) {
  vi.mocked(useActiveOrganization).mockReturnValue({
    activeOrganization: organization,
    activeOrganizationId: organization.id,
    organizations: [organization],
  })
  vi.mocked(useCapabilities).mockReturnValue({
    role: {
      id: 'role-id',
      name: roleName,
      description: null,
      organization_id: organization.id,
      created_at: '2026-10-29T10:00:00Z',
      updated_at: '2026-10-29T10:00:00Z',
    },
    roleName,
    isLoading: false,
    capabilities: new Set<Capability>(),
    can: (capability) => capability === 'organizations:create' && canCreateOrganization,
  })
}

async function openSwitcher() {
  const user = userEvent.setup()
  render(<OrganizationSwitcher />)
  await user.click(screen.getByRole('button', { name: /switch organization/i }))
  await screen.findByRole('menu')
}

describe('OrganizationSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers organization creation to an owner', async () => {
    mockRole('Organization Owner', true)
    await openSwitcher()

    expect(screen.getByRole('menuitem', { name: /create organization/i })).toBeInTheDocument()
  })

  it('hides organization creation from a member', async () => {
    mockRole('Member', false)
    await openSwitcher()

    expect(screen.queryByRole('menuitem', { name: /create organization/i })).not.toBeInTheDocument()
  })
})
