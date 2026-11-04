import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { authApi, organizationsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { useAuthStore } from '@/store/auth'
import type { Organization, User } from '@/types/domain'

vi.mock('@/lib/api/endpoints', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
  organizationsApi: {
    list: vi.fn(),
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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<div>APP HOME</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
    vi.mocked(authApi.me).mockReset()
    vi.mocked(organizationsApi.list).mockReset()
    vi.mocked(authApi.me).mockResolvedValue(user)
    vi.mocked(organizationsApi.list).mockResolvedValue([organization])
    useAuthStore.setState({
      status: 'anonymous',
      user: null,
      organizations: [],
      activeOrganizationId: null,
      notice: null,
    })
  })

  it('signs in, stores the session and lands in the workspace', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
    })

    renderLogin()

    await userEventSetup.type(screen.getByLabelText(/work email/i), '  qa@firm.com  ')
    await userEventSetup.type(screen.getByLabelText(/^password/i), 'ExamplePass123!')
    await userEventSetup.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText('APP HOME')).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'qa@firm.com',
      password: 'ExamplePass123!',
    })
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().activeOrganizationId).toBe(organization.id)
  })

  it('shows an inline error for invalid credentials and stays on the page', async () => {
    const userEventSetup = userEvent.setup()
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError('Invalid Email or Password', { status: 401 })
    )

    renderLogin()

    await userEventSetup.type(screen.getByLabelText(/work email/i), 'qa@firm.com')
    await userEventSetup.type(screen.getByLabelText(/^password/i), 'wrong-password')
    await userEventSetup.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
    expect(screen.queryByText('APP HOME')).not.toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it('validates the form before calling the API', async () => {
    const userEventSetup = userEvent.setup()
    renderLogin()

    await userEventSetup.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })
})
