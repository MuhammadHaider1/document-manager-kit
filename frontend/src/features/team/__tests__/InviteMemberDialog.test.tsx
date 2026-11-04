import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Invitation } from '@/types/domain'
import { rbacApi, membersApi } from '@/lib/api/endpoints'
import { InviteMemberDialog } from '../components/InviteMemberDialog'

const invitation: Invitation = {
  id: '11111111-1111-1111-1111-111111111111',
  organization_id: '22222222-2222-2222-2222-222222222222',
  organization_name: 'Northwind Legal',
  email: 'counsel@example.com',
  role_id: '33333333-3333-3333-3333-333333333333',
  role_name: 'Member',
  status: 'pending',
  invited_by_name: 'Alex Morgan',
  expires_at: '2026-11-08T01:06:22.856497Z',
  created_at: '2026-11-01T01:06:22.835660Z',
  invite_url: 'https://docuflow.example/invite/token-123',
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <InviteMemberDialog
        open
        onOpenChange={vi.fn()}
        organizationName="Northwind Legal"
        inviterName="Alex Morgan"
      />
    </QueryClientProvider>
  )
}

describe('InviteMemberDialog', () => {
  beforeEach(() => {
    vi.spyOn(rbacApi, 'roles').mockResolvedValue([])
  })

  it('creates an invitation through the API', async () => {
    const inviteSpy = vi.spyOn(membersApi, 'invite').mockResolvedValue(invitation)
    const user = userEvent.setup()
    renderDialog()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/never as an administrator/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/teammate's email/i), 'counsel@example.com')
    await user.click(screen.getByRole('button', { name: /create invitation/i }))

    await waitFor(() => {
      expect(inviteSpy).toHaveBeenCalledWith({
        email: 'counsel@example.com',
        role_id: undefined,
      })
    })

    const link = await screen.findByLabelText('Invitation link')
    expect(link).toHaveValue(invitation.invite_url)

    const draft = screen.getByRole('link', { name: /open email draft/i })
    expect(draft.getAttribute('href')).toContain(
      `mailto:${encodeURIComponent('counsel@example.com')}`
    )
    expect(draft.getAttribute('href')).toContain(encodeURIComponent(invitation.invite_url))
  })

  it('shows the API error when the invitation cannot be created', async () => {
    vi.spyOn(membersApi, 'invite').mockRejectedValue(new Error('already a member'))
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText(/teammate's email/i), 'counsel@example.com')
    await user.click(screen.getByRole('button', { name: /create invitation/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
    })
  })
})
