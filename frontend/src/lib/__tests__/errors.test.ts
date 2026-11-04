import { describe, expect, it } from 'vitest'
import { ApiError, toApiError } from '@/lib/api/errors'

describe('toApiError', () => {
  it('maps a network failure to a retryable status 0 error', () => {
    const error = toApiError(0, null)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.isNetwork).toBe(true)
    expect(error.message).toMatch(/cannot reach the server/i)
  })

  it('uses a string detail from the API verbatim', () => {
    const error = toApiError(400, { detail: 'Invalid Email or Password' })
    expect(error.status).toBe(400)
    expect(error.message).toBe('Invalid Email or Password')
    expect(error.fieldErrors).toEqual({})
  })

  it('extracts FastAPI validation issues into field errors', () => {
    const error = toApiError(422, {
      detail: [
        { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' },
        { loc: ['body', 'password'], msg: 'field required', type: 'missing' },
        { loc: ['query', 'page'], msg: 'ensure this value is greater than 0', type: 'value_error' },
      ],
    })
    expect(error.isValidation).toBe(true)
    expect(error.fieldErrors).toEqual({
      email: 'value is not a valid email address',
      password: 'field required',
      page: 'ensure this value is greater than 0',
    })
    expect(error.message).toContain('value is not a valid email address')
  })

  it('falls back to friendly copy for common status codes', () => {
    expect(toApiError(401, {}).message).toMatch(/session has expired/i)
    expect(toApiError(403, {}).message).toMatch(/permission/i)
    expect(toApiError(404, {}).message).toMatch(/could not be found/i)
    expect(toApiError(429, {}).message).toMatch(/too many requests/i)
    expect(toApiError(503, {}).message).toMatch(/server ran into a problem/i)
    expect(toApiError(500, {}).isServer).toBe(true)
  })

  it('exposes status helpers used by screens', () => {
    expect(toApiError(401, {}).isUnauthorized).toBe(true)
    expect(toApiError(403, {}).isForbidden).toBe(true)
    expect(toApiError(404, {}).isNotFound).toBe(true)
    expect(toApiError(429, {}).isRateLimited).toBe(true)
  })
})
