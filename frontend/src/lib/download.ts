import { isSafeHttpUrl, isUnreachableStorageUrl } from './utils'

/**
 * Presigned links point at the object-storage host. If that host is only
 * reachable from the API server (for example `localhost` when the app is opened
 * from another machine), handing the URL to the browser would fail silently.
 * We detect that case and surface a clear, actionable message instead.
 */
export class StorageUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUrlError'
  }
}

export function assertDownloadUrlUsable(url: string): void {
  if (!isSafeHttpUrl(url)) {
    throw new StorageUrlError(
      'The API returned a download link with an unsupported protocol, so it was blocked for safety.'
    )
  }
  if (isUnreachableStorageUrl(url)) {
    throw new StorageUrlError(
      'This download link points to a storage host that this browser cannot reach. The API needs to return a publicly reachable object-storage URL for downloads and previews.'
    )
  }
}

export function openDownloadUrl(url: string, fileName?: string): void {
  assertDownloadUrlUsable(url)
  const link = document.createElement('a')
  link.href = url
  if (fileName) link.download = fileName
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
