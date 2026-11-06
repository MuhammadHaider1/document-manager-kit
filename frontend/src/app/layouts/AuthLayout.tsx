import { Suspense } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, FileSearch, History, ShieldCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { PageLoader } from '@/components/shared/PageLoader'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { EASE } from '@/components/motion/Reveal'
import { PageTransition } from '@/components/motion/PageTransition'

const PILLARS = [
  {
    icon: FileSearch,
    title: 'Grounded answers',
    description: 'Document answers are grounded in your own matter files.',
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
  const reduce = useReducedMotion()

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
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
          animate={reduce ? undefined : { x: [0, 26, 0], y: [0, -18, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl"
          animate={reduce ? undefined : { x: [0, -20, 0], y: [0, 22, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="relative"
          initial={reduce ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="[&_a]:text-primary-foreground [&_span]:text-primary-foreground">
            <Logo to="/" />
          </div>
        </motion.div>

        <div className="relative max-w-lg space-y-8">
          <motion.blockquote
            className="space-y-4"
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
          >
            <p className="font-display text-[2.1rem] leading-[1.2] tracking-tight">
              “The record is the case. Docuflow keeps ours complete, searchable and accountable.”
            </p>
            <footer className="text-sm text-primary-foreground/70">
              Priya Raman — Managing Partner, boutique commercial firm
            </footer>
          </motion.blockquote>

          <motion.ul
            className="space-y-4 border-t border-primary-foreground/15 pt-8"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.1, delayChildren: 0.32 } },
            }}
          >
            {PILLARS.map((pillar) => (
              <motion.li
                key={pillar.title}
                className="flex items-start gap-3"
                variants={{
                  hidden: { opacity: 0, x: -14 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.48, ease: EASE } },
                }}
              >
                <pillar.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{pillar.title}</p>
                  <p className="text-sm text-primary-foreground/65">{pillar.description}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          className="relative flex items-center gap-2 text-xs text-primary-foreground/60"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          SOC 2 aligned controls · Encryption in transit and at rest
        </motion.div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end">
          <div className="lg:hidden">
            <Logo to="/" />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-14 sm:px-8">
          <PageTransition className="w-full max-w-md">
            <Suspense fallback={<PageLoader label="Loading page" />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
