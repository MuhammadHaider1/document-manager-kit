import { ArrowLeft, FileQuestion } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  const location = useLocation()
  const insideApp = location.pathname.startsWith('/app')

  return (
    <main
      className={
        insideApp
          ? 'flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center'
          : 'flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center'
      }
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <FileQuestion className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <p className="label-caps">Error 404</p>
        <h1 className="font-display text-3xl">This page is not on file</h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page you requested may have been moved or the link is incomplete.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="accent">
          <Link to="/app">
            <ArrowLeft />
            Back to workspace
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Go to homepage</Link>
        </Button>
      </div>
    </main>
  )
}
