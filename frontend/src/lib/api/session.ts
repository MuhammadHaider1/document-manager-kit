import { API_BASE_URL, STORAGE_KEYS } from '../constants'
import { toApiError } from './errors'

/**
 * Token storage policy
 * --------------------
 * The API issues a short-lived access token plus a long-lived refresh token and
 * has no httpOnly-cookie option. The access token therefore lives only in
 * memory. The refresh token is kept in `sessionStorage`, which survives page
 * reloads but not a closed tab, so it is never written to localStorage where it
 * would sit indefinitely. On reload the session is silently re-established
 * through POST /auth/refresh.
 */
let accessToken: string | null = null
let refreshToken: string | null = readStoredRefreshToken()
let refreshPromise: Promise<boolean> | null = null
let sessionExpiredHandler: (() => void) | null = null
let organizationId: string | null = readStoredOrganizationId()

function readStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.refreshToken)
  } catch {
    return null
  }
}

function readStoredOrganizationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.activeOrganization)
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  return refreshToken
}

export function getActiveOrganizationId(): string | null {
  return organizationId
}

export function setActiveOrganizationId(id: string | null) {
  organizationId = id
  try {
    if (id) localStorage.setItem(STORAGE_KEYS.activeOrganization, id)
    else localStorage.removeItem(STORAGE_KEYS.activeOrganization)
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function setSession(tokens: { access_token: string; refresh_token: string }) {
  accessToken = tokens.access_token
  refreshToken = tokens.refresh_token
  try {
    sessionStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token)
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  accessToken = null
  refreshToken = null
  try {
    sessionStorage.removeItem(STORAGE_KEYS.refreshToken)
  } catch {
    /* ignore */
  }
}

export function onSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler
}

export function emitSessionExpired() {
  sessionExpiredHandler?.()
}

interface TokenPayload {
  access_token: string
  refresh_token: string
}

function isTokenPayload(value: unknown): value is TokenPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TokenPayload).access_token === 'string' &&
    typeof (value as TokenPayload).refresh_token === 'string'
  )
}

/**
 * Exchanges the refresh token for a new pair. Concurrent callers share one
 * in-flight request so a burst of 401s cannot trigger a refresh storm.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false)
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!response.ok) {
        clearSession()
        return false
      }
      const payload: unknown = await response.json()
      if (!isTokenPayload(payload)) {
        clearSession()
        return false
      }
      setSession(payload)
      return true
    } catch {
      clearSession()
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/** Re-exported so upload helpers and the request client share one error shape. */
export { toApiError }
