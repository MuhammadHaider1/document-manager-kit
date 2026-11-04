import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'
import { AppRouter } from './router'

export function AppProviders() {
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const resolvedTheme = useUiStore((state) => state.resolvedTheme)
  const applySystemTheme = useUiStore((state) => state.applySystemTheme)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applySystemTheme()
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [applySystemTheme])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250} skipDelayDuration={100}>
          <AppRouter />
          <Toaster
            theme={resolvedTheme}
            position="top-right"
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  'rounded-xl border border-border bg-card text-card-foreground shadow-raised text-sm',
                description: 'text-muted-foreground',
                actionButton: 'bg-accent text-accent-foreground',
                cancelButton: 'bg-muted text-foreground',
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
