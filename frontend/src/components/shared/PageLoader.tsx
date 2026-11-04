import { Loader2 } from 'lucide-react'

export function PageLoader({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
