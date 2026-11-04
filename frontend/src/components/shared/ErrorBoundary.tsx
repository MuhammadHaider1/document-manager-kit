import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Top-level boundary: keeps a render crash from blanking the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console only the error message — never tokens or document content.
    console.error('Render error:', error.message, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertOctagon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl">This page could not be displayed</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            An unexpected error interrupted the page. Your data is safe. Reload to continue.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <Button variant="outline" onClick={() => window.location.assign('/app')}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </main>
    )
  }
}
