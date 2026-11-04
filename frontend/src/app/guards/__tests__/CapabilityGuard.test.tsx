import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CapabilityGuard } from '@/app/guards/CapabilityGuard'
import { useCapabilities } from '@/hooks/useCapabilities'
import { capabilitiesForRole } from '@/lib/permissions'

vi.mock('@/hooks/useCapabilities', () => ({
  useCapabilities: vi.fn(),
}))

function mockRole(roleName: string | null, isLoading = false) {
  const capabilities = capabilitiesForRole(roleName)
  vi.mocked(useCapabilities).mockReturnValue({
    role: null,
    roleName,
    isLoading,
    capabilities,
    can: (capability) => capabilities.has(capability),
  })
}

function renderGuard(capability: 'audit:read') {
  return render(
    <MemoryRouter initialEntries={['/app/audit']}>
      <CapabilityGuard capability={capability}>
        <p>Audit table</p>
      </CapabilityGuard>
    </MemoryRouter>
  )
}

describe('CapabilityGuard', () => {
  it('renders the protected content for a role with the capability', () => {
    mockRole('Organization Owner')
    renderGuard('audit:read')
    expect(screen.getByText('Audit table')).toBeInTheDocument()
  })

  it('shows the friendly permission state for a role without it', () => {
    mockRole('Viewer')
    renderGuard('audit:read')

    expect(screen.getByText(/you don't have access to this area/i)).toBeInTheDocument()
    expect(screen.getByText(/Your role in this organization is “Viewer”/)).toBeInTheDocument()
    expect(screen.queryByText('Audit table')).not.toBeInTheDocument()
  })

  it('waits while the role is still loading instead of flashing a 403', () => {
    mockRole(null, true)
    renderGuard('audit:read')

    expect(screen.getByText(/checking permissions/i)).toBeInTheDocument()
    expect(screen.queryByText(/you don't have access to this area/i)).not.toBeInTheDocument()
  })
})
