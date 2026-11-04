import { clsx, type ClassValue } from 'clsx'
import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value)
}

export function formatDate(value: string | Date, pattern = 'd MMM yyyy'): string {
  try {
    return format(toDate(value), pattern)
  } catch {
    return '—'
  }
}

export function formatDateTime(value: string | Date): string {
  try {
    return format(toDate(value), 'd MMM yyyy, HH:mm')
  } catch {
    return '—'
  }
}

export function relativeTime(value: string | Date): string {
  try {
    const date = toDate(value)
    if (isToday(date)) return formatDistanceToNowStrict(date, { addSuffix: true })
    if (isYesterday(date)) return `yesterday, ${format(date, 'HH:mm')}`
    return formatDistanceToNowStrict(date, { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`
}

export function initials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return '?'
  const source = nameOrEmail.includes('@') ? (nameOrEmail.split('@')[0] ?? '') : nameOrEmail
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function truncate(value: string, max = 120): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Returns true when a URL is http(s) and therefore safe to hand to the browser. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Presigned object-storage URLs are minted with the storage host name. If that
 * host is localhost but the app is served from another machine, the browser
 * cannot reach it. We surface that instead of silently failing.
 */
export function isUnreachableStorageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const localHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0']
    const browserHost = window.location.hostname
    return localHosts.includes(url.hostname) && !localHosts.includes(browserHost)
  } catch {
    return false
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = columns.map(escape).join(',')
  const body = rows.map((row) => columns.map((column) => escape(row[column])).join(','))
  return [header, ...body].join('\r\n')
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
