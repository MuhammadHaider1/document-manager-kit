import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AskAiPage } from '@/features/ask/pages/AskAiPage'
import { rbacApi } from '@/lib/api/endpoints'
import { streamRequest } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { useAuthStore } from '@/store/auth'
import type { MemberRole, Organization, User } from '@/types/domain'

vi.mock('@/lib/api/endpoints', () => ({
  rbacApi: {
    memberRole: vi.fn(),
  },
}))

vi.mock('@/lib/api/client', () => ({
  streamRequest: vi.fn(),
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

function fakeStream(chunks: string[], contentType = 'text/plain') {
  let index = 0
  return {
    headers: { get: () => contentType },
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[index++]) }
            : { done: true, value: undefined },
      }),
    },
  } as unknown as Response
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
    vi.mocked(streamRequest).mockReset()
    vi.mocked(rbacApi.memberRole).mockReset()
    vi.mocked(rbacApi.memberRole).mockResolvedValue(memberRole)
    useAuthStore.setState({
      status: 'authenticated',
      user,
      organizations: [organization],
      activeOrganizationId: organization.id,
    })
  })

  it('streams a plain-text answer into the conversation', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(streamRequest).mockResolvedValue(
      fakeStream([
        'Either party may terminate for convenience ',
        'with **60 days written notice**.',
      ])
    )

    renderPage()

    await userEventSetup.type(
      screen.getByLabelText(/ask a question about this organization/i),
      'What is the notice period?'
    )
    await userEventSetup.click(screen.getByRole('button', { name: /send question/i }))

    expect(await screen.findByText(/60 days written notice/i)).toBeInTheDocument()

    expect(streamRequest).toHaveBeenCalledTimes(1)
    expect(streamRequest).toHaveBeenCalledWith(
      '/query-stream',
      expect.objectContaining({
        method: 'POST',
        body: { query: 'What is the notice period?' },
        organization: true,
      })
    )
  })

  it('shows an error state when the stream fails', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(streamRequest).mockRejectedValue(
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
    expect(streamRequest).not.toHaveBeenCalled()
  })
})
