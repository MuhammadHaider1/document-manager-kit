import { Suspense } from 'react'
import { CheckCircle2, FileSearch, History, ShieldCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { PageLoader } from '@/components/shared/PageLoader'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

const PILLARS = [
  {
    icon: FileSearch,
    title: 'Grounded answers',
    description: 'Every answer is retrieved from your own matter files.',
  },
  {
    icon: History,
    title: 'Defensible versions',
    description: 'Immutable version history for every document.',
  },
  {
    icon: ShieldCheck,
    title: 'Client isolation',
    description: 'Role-based access, scoped per organization.',
  },
]

export function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(60rem 40rem at 10% -10%, hsl(var(--accent) / 0.28), transparent 60%), radial-gradient(40rem 30rem at 90% 110%, hsl(var(--accent) / 0.16), transparent 65%)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="[&_a]:text-primary-foreground [&_span]:text-primary-foreground">
            <Logo to="/" />
          </div>
        </div>

        <div className="relative max-w-lg space-y-8">
          <blockquote className="space-y-4">
            <p className="font-display text-[2.1rem] leading-[1.2] tracking-tight">
              “The record is the case. Docuflow keeps ours complete, searchable and accountable.”
            </p>
            <footer className="text-sm text-primary-foreground/70">
              Priya Raman — Managing Partner, boutique commercial firm
            </footer>
          </blockquote>

          <ul className="space-y-4 border-t border-primary-foreground/15 pt-8">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="flex items-start gap-3">
                <pillar.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{pillar.title}</p>
                  <p className="text-sm text-primary-foreground/65">{pillar.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-primary-foreground/60">
          <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          SOC 2 aligned controls · Encryption in transit and at rest
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end">
          <div className="lg:hidden">
            <Logo to="/" />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-14 sm:px-8">
          <div className="w-full max-w-md animate-fade-up">
            <Suspense fallback={<PageLoader label="Loading page" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
