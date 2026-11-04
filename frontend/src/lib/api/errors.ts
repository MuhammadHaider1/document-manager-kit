export type FieldErrors = Record<string, string>

interface ApiErrorOptions {
  status?: number
  fieldErrors?: FieldErrors
  details?: unknown
}

/**
 * Normalised error for every failure path (HTTP, network, abort). Components
 * only ever deal with this shape, so toast copy and inline form errors stay
 * consistent across the app.
 */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors
  readonly details: unknown

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.fieldErrors = options.fieldErrors ?? {}
    this.details = options.details
  }

  get isNetwork() {
    return this.status === 0
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }

  get isNotFound() {
    return this.status === 404
  }

  get isValidation() {
    return this.status === 422 || this.status === 400
  }

  get isRateLimited() {
    return this.status === 429
  }

  get isServer() {
    return this.status >= 500
  }
}

interface FastApiValidationIssue {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

function isValidationIssue(value: unknown): value is FastApiValidationIssue {
  return typeof value === 'object' && value !== null && 'msg' in value
}

function parseFieldName(loc: Array<string | number> | undefined): string | null {
  if (!loc?.length) return null
  const parts = loc.filter((part) => part !== 'body' && part !== 'query' && part !== 'path')
  const last = parts[parts.length - 1]
  return typeof last === 'string' ? last : null
}

export function toApiError(status: number, payload: unknown): ApiError {
  if (status === 0) {
    return new ApiError('Cannot reach the server. Check your connection and try again.', {
      status: 0,
      details: payload,
    })
  }

  const detail =
    typeof payload === 'object' && payload !== null && 'detail' in payload
      ? (payload as { detail: unknown }).detail
      : payload

  if (typeof detail === 'string') {
    return new ApiError(detail, { status, details: payload })
  }

  if (Array.isArray(detail)) {
    const issues = detail.filter(isValidationIssue)
    const fieldErrors: FieldErrors = {}
    for (const issue of issues) {
      const field = parseFieldName(issue.loc)
      if (field && issue.msg && !fieldErrors[field]) fieldErrors[field] = issue.msg
    }
    const message =
      issues.length > 0
        ? issues
            .map((issue) => issue.msg)
            .filter(Boolean)
            .join('. ')
        : 'The request could not be validated.'
    return new ApiError(message, { status, fieldErrors, details: payload })
  }

  if (status === 401)
    return new ApiError('Your session has expired. Please sign in again.', { status })
  if (status === 403) {
    return new ApiError("You don't have permission to perform this action.", { status })
  }
  if (status === 404) return new ApiError('The requested item could not be found.', { status })
  if (status === 429) {
    return new ApiError('Too many requests. Please wait a moment and try again.', { status })
  }
  if (status >= 500) {
    return new ApiError('The server ran into a problem. Please try again.', { status })
  }
  return new ApiError('Something went wrong. Please try again.', { status, details: payload })
}
