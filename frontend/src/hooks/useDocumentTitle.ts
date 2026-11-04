import { useEffect } from 'react'
import { APP_NAME } from '@/lib/constants'

/** Keeps the document title in sync with the active screen. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} — Legal document intelligence`
  }, [title])
}
