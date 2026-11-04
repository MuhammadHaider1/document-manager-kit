import { API_BASE_URL } from '../constants'
import type { ApiError } from './errors'
import { toApiError } from './errors'
import {
  emitSessionExpired,
  getAccessToken,
  getActiveOrganizationId,
  refreshAccessToken,
} from './session'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  signal?: AbortSignal
  /** Attach the access token. Defaults to true. */
  auth?: boolean
  /** Attach X-Organization-Id. Defaults to false; tenant routes opt in. */
  organization?: boolean
  headers?: Record<string, string>
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams()
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      search.set(key, String(value))
    }
  }
  const suffix = search.toString()
  return `${API_BASE_URL}${path}${suffix ? `?${suffix}` : ''}`
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers)
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.auth !== false) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  if (options.organization) {
    const organizationId = getActiveOrganizationId()
    if (organizationId) headers.set('X-Organization-Id', organizationId)
  }
  return headers
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null
  const contentType = response.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) payload = await response.json()
    else payload = await response.text()
  } catch {
    payload = null
  }
  return toApiError(response.status, payload)
}

async function execute(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET'
  const url = buildUrl(path, options.query)

  try {
    return await fetch(url, {
      method,
      headers: buildHeaders(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: 'same-origin',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw toApiError(0, error)
  }
}

/**
 * Single entry point for JSON calls. Handles one silent refresh on 401, then
 * announces session expiry so the auth store can redirect to /login.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await execute(path, options)

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await execute(path, options)
    } else {
      emitSessionExpired()
      throw await parseError(response)
    }
  }

  if (!response.ok) {
    const error = await parseError(response)
    if (error.isUnauthorized) emitSessionExpired()
    throw error
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    const text = await response.text()
    return text as T
  }
  return (await response.json()) as T
}

/**
 * Opens a raw response for the streaming RAG endpoint. Kept separate from
 * apiRequest because the body is consumed incrementally as text.
 */
export async function streamRequest(path: string, options: RequestOptions): Promise<Response> {
  let response = await execute(path, options)

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await execute(path, options)
    } else {
      emitSessionExpired()
      throw await parseError(response)
    }
  }

  if (!response.ok) throw await parseError(response)
  return response
}

interface UploadOptions {
  /** Upload progress from 0 to 100. */
  onProgress?: (percent: number) => void
  signal?: AbortSignal
  organization?: boolean
}

/**
 * Multipart upload via XHR: fetch cannot report upload progress, and per-file
 * progress is a product requirement.
 */
export function uploadFormData<T>(path: string, formData: FormData, options: UploadOptions = {}) {
  return new Promise<T>((resolve, reject) => {
    const send = () => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', buildUrl(path))
      xhr.responseType = 'text'

      const token = getAccessToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      if (options.organization) {
        const organizationId = getActiveOrganizationId()
        if (organizationId) xhr.setRequestHeader('X-Organization-Id', organizationId)
      }

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        options.onProgress?.(Math.round((event.loaded / event.total) * 100))
      }

      xhr.onload = () => {
        const contentType = xhr.getResponseHeader('content-type') ?? ''
        let payload: unknown = xhr.responseText
        if (contentType.includes('json') && xhr.responseText) {
          try {
            payload = JSON.parse(xhr.responseText)
          } catch {
            payload = xhr.responseText
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          if (xhr.status === 204 || !payload) {
            resolve(undefined as T)
            return
          }
          resolve(payload as T)
          return
        }

        if (xhr.status === 401) {
          void refreshAccessToken().then((refreshed) => {
            if (refreshed) send()
            else {
              emitSessionExpired()
              reject(toApiError(401, payload))
            }
          })
          return
        }

        reject(toApiError(xhr.status, payload))
      }

      xhr.onerror = () => reject(toApiError(0, null))
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))

      options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(formData)
    }

    send()
  })
}
