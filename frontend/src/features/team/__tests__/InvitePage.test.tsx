import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Organization } from '@/types/domain'
import { membersApi } from '@/lib/api/endpoints'
import { useAuthStore } from '@/store/auth'
import { InvitePage } from '../pages/InvitePage'

const preview = {
  organization_id: '22222222-2222-2222-2222-222222222222',
  organization_name: 'Northwind Legal',
  email: 'counsel@example.com',
  role_name: 'Member',
  status: 'pending',
  invited_by_name: 'Alex Morgan',
  expires_at: '2026-11-08T01:06:22.856497Z',
}

const joinedOrganization: Organization = {
  id: preview.organization_id,
  name: preview.organization_name,
  slug: 'northwind-legal',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/invite/token-123']}>
        <Routes>
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/app" element={<div>Workspace home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InvitePage', () => {
  const refreshOrganizations = vi.fn()
  const setActiveOrganization = vi.fn()

  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'counsel@example.com',
        full_name: 'Invited Counsel',
        is_active: true,
        is_superuser: false,
      },
      refreshOrganizations,
      setActiveOrganization,
    })
    refreshOrganizations.mockResolvedValue([joinedOrganization])
  })

  it('shows the invitation and joins the organization', async () => {
    vi.spyOn(membersApi, 'previewInvitation').mockResolvedValue(preview)
    vi.spyOn(membersApi, 'acceptInvitation').mockResolvedValue({
      organization_id: preview.organization_id,
      organization_name: preview.organization_name,
      role_id: '33333333-3333-3333-3333-333333333333',
      role_name: 'Member',
      message: 'You joined Northwind Legal as Member.',
    })

    const user = userEvent.setup()
    renderPage()

    expect(
      await screen.findByRole('heading', { name: /join northwind legal/i })
    ).toBeInTheDocument()
    expect(screen.getAllByText('Member').length).toBeGreaterThan(0)
    expect(screen.getByText('counsel@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /join northwind legal/i }))

    await waitFor(() => {
      expect(membersApi.acceptInvitation).toHaveBeenCalledWith('token-123')
      expect(refreshOrganizations).toHaveBeenCalled()
      expect(setActiveOrganization).toHaveBeenCalledWith(preview.organization_id)
    })
    expect(await screen.findByText('Workspace home')).toBeInTheDocument()
  })

  it('blocks accepting when the signed-in email does not match', async () => {
    useAuthStore.setState({
      user: {
        id: '55555555-5555-5555-5555-555555555555',
        email: 'someone.else@example.com',
        full_name: 'Someone Else',
        is_active: true,
        is_superuser: false,
      },
    })
    vi.spyOn(membersApi, 'previewInvitation').mockResolvedValue(preview)

    renderPage()

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /join northwind legal/i })).not.toBeInTheDocument()
  })
})
