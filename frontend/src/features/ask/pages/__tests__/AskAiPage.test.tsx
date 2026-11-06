import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AskAiPage } from '@/features/ask/pages/AskAiPage'
import { chatApi, rbacApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { useAuthStore } from '@/store/auth'
import type { MemberRole, Organization, User } from '@/types/domain'

vi.mock('@/lib/api/endpoints', () => ({
  chatApi: {
    send: vi.fn(),
  },
  rbacApi: {
    memberRole: vi.fn(),
  },
}))

const user: User = {
  id: 'user-1',
  email: 'qa@firm.com',
  full_name: 'QA Counsel',
  is_active: true,
  is_superuser: false,
}

const organization: Organization = {
  id: 'org-1',
  name: 'QA Workspace',
  slug: 'qa-workspace',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const memberRole: MemberRole = {
  user_id: user.id,
  organization_id: organization.id,
  role: {
    id: 'role-1',
    name: 'Contributor',
    description: 'Can upload documents',
    organization_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AskAiPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AskAiPage', () => {
  beforeEach(() => {
    vi.mocked(chatApi.send).mockReset()
    vi.mocked(rbacApi.memberRole).mockReset()
    vi.mocked(rbacApi.memberRole).mockResolvedValue(memberRole)
    useAuthStore.setState({
      status: 'authenticated',
      user,
      organizations: [organization],
      activeOrganizationId: organization.id,
    })
  })

  it('sends a question to chat and renders the JSON answer', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(chatApi.send).mockResolvedValue({
      type: 'document_answer',
      answer: 'Either party may terminate for convenience with **60 days written notice**.',
      sources: [],
    })

    renderPage()

    await userEventSetup.type(
      screen.getByLabelText(/ask a question about this organization/i),
      'What is the notice period?'
    )
    await userEventSetup.click(screen.getByRole('button', { name: /send question/i }))

    expect(await screen.findByText(/60 days written notice/i)).toBeInTheDocument()

    expect(chatApi.send).toHaveBeenCalledTimes(1)
    expect(chatApi.send).toHaveBeenCalledWith(
      { query: 'What is the notice period?', history: [] },
      expect.any(AbortSignal)
    )
  })

  it('sends recent conversation turns as chat history and shows the disclaimer', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(chatApi.send)
      .mockResolvedValueOnce({
        type: 'document_answer',
        answer: 'The contract renews annually.',
        sources: [],
      })
      .mockResolvedValueOnce({
        type: 'general_answer',
        answer: 'It means the agreement extends for another year.',
        sources: [],
        disclaimer: 'This answer is based on general knowledge.',
      })
      .mockResolvedValueOnce({
        type: 'general_answer',
        answer: 'The agreement extends for one additional year.',
        sources: [],
      })

    renderPage()

    const input = screen.getByLabelText(/ask a question about this organization/i)
    await userEventSetup.type(input, 'When does it renew?')
    await userEventSetup.click(screen.getByRole('button', { name: /send question/i }))
    await screen.findByText(/contract renews annually/i)

    await userEventSetup.type(input, 'What does that mean?')
    await userEventSetup.click(screen.getByRole('button', { name: /send question/i }))

    expect(await screen.findByText(/based on general knowledge/i)).toBeInTheDocument()
    expect(chatApi.send).toHaveBeenLastCalledWith(
      {
        query: 'What does that mean?',
        history: [
          { role: 'user', content: 'When does it renew?' },
          { role: 'assistant', content: 'The contract renews annually.' },
        ],
      },
      expect.any(AbortSignal)
    )

    await userEventSetup.click(screen.getByRole('button', { name: /regenerate/i }))
    await screen.findByText(/one additional year/i)
    expect(chatApi.send).toHaveBeenLastCalledWith(
      {
        query: 'What does that mean?',
        history: [
          { role: 'user', content: 'When does it renew?' },
          { role: 'assistant', content: 'The contract renews annually.' },
        ],
      },
      expect.any(AbortSignal)
    )
  })

  it('shows an error state when the chat request fails', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(chatApi.send).mockRejectedValue(
      new ApiError('The server ran into a problem. Please try again.', { status: 500 })
    )

    renderPage()

    await userEventSetup.type(
      screen.getByLabelText(/ask a question about this organization/i),
      'Summarise the liability cap'
    )
    await userEventSetup.click(screen.getByRole('button', { name: /send question/i }))

    await waitFor(() => {
      expect(screen.getByText(/incomplete answer/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/server ran into a problem/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('does not send an empty question', async () => {
    const userEventSetup = userEvent.setup()
    renderPage()

    const send = screen.getByRole('button', { name: /send question/i })
    expect(send).toBeDisabled()
    await userEventSetup.click(send)
    expect(chatApi.send).not.toHaveBeenCalled()
  })
})
