import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorState } from '@/components/shared/ErrorState'
import { ApiError } from '@/lib/api/errors'

describe('ErrorState', () => {
  it('turns a 403 into a permission message without a retry action', () => {
    const onRetry = vi.fn()
    render(<ErrorState error={new ApiError('Forbidden', { status: 403 })} onRetry={onRetry} />)

    expect(screen.getByText(/you don't have permission/i)).toBeInTheDocument()
    expect(screen.getByText(/role in this organization/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('offers a retry for server and network failures', async () => {
    const userEventSetup = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <ErrorState error={new ApiError('Server exploded', { status: 503 })} onRetry={onRetry} />
    )

    expect(screen.getByText(/something went wrong on our side/i)).toBeInTheDocument()
    await userEventSetup.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('explains network failures', () => {
    render(<ErrorState error={new ApiError('offline', { status: 0 })} />)
    expect(screen.getByText(/cannot reach the server/i)).toBeInTheDocument()
  })
})
