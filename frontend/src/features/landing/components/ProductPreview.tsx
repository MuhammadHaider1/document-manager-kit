import { motion, useReducedMotion } from 'framer-motion'
import { Check, FileText, Sparkles, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { EASE } from '@/components/motion/Reveal'
import { Typewriter } from '@/components/motion/Typewriter'

const QUESTION = ['Which contracts expire in the next 90 days?']

const ROWS = [
  {
    name: 'Acme — Master Services Agreement.pdf',
    size: '2.4 MB',
    status: 'completed',
    meta: 'v4 · Commercial',
  },
  {
    name: 'Northwind — Lease (executed).pdf',
    size: '1.1 MB',
    status: 'processing',
    meta: 'v2 · Real estate',
  },
  {
    name: 'Chen — Employment Contract.docx',
    size: '486 KB',
    status: 'pending',
    meta: 'v1 · Employment',
  },
]

/**
 * A product preview assembled from the real design-system components. No
 * screenshots and no live API calls — the landing page is public.
 */
export function ProductPreview() {
  const reduce = useReducedMotion()

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        className="absolute -inset-x-6 -bottom-8 -top-6 rounded-[2rem] bg-gradient-to-b from-accent/10 to-transparent blur-2xl"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-raised">
        <div className="flex items-center gap-2 border-b border-border/80 bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/50" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/50" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/50" aria-hidden="true" />
          <span className="ml-3 truncate rounded-md border border-border/70 bg-card px-2 py-0.5 text-2xs text-muted-foreground">
            app.docuflow.com/raman-associates/documents
          </span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.55fr_1fr]">
          <div className="border-b border-border/70 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg">Matter documents</p>
                <p className="text-xs text-muted-foreground">Raman & Associates · Commercial</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-2xs font-semibold text-accent-foreground">
                <Upload className="h-3 w-3" aria-hidden="true" /> Upload
              </span>
            </div>

            <ul className="space-y-2">
              {ROWS.map((row, index) => (
                <motion.li
                  key={row.name}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5"
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.5 + index * 0.12, ease: EASE }}
                  whileHover={
                    reduce ? undefined : { x: 4, borderColor: 'hsl(var(--accent) / 0.4)' }
                  }
                >
                  <FileTypeIcon fileName={row.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{row.name}</p>
                    <p className="text-2xs text-muted-foreground">
                      {row.size} · {row.meta}
                    </p>
                  </div>
                  <StatusBadge status={row.status} className="hidden sm:inline-flex" />
                </motion.li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2 text-2xs text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              1,284 documents indexed · every version retained
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">Ask AI</p>
              <Badge tone="gold" className="ml-auto">
                Grounded
              </Badge>
            </div>

            <div className="mt-3 min-h-[2.25rem] rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-[0.8125rem] text-muted-foreground">
              <Typewriter phrases={QUESTION} typingSpeed={42} deletingSpeed={18} pause={3400} />
            </div>

            <motion.div
              className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.5, ease: EASE }}
            >
              <p>
                Three agreements expire before <strong>31 January</strong>:
              </p>
              <ul className="space-y-1.5 pl-4 text-muted-foreground">
                <li className="list-disc">
                  <span className="text-foreground">Acme MSA</span> — 12 Dec, auto-renews for 12
                  months unless notice is given.
                </li>
                <li className="list-disc">
                  <span className="text-foreground">Northwind Lease</span> — 04 Jan, renewal option
                  at market rate.
                </li>
                <li className="list-disc">
                  <span className="text-foreground">Ortega SOW</span> — 19 Jan, no renewal clause.
                </li>
              </ul>
            </motion.div>

            <motion.div
              className="mt-4 border-t border-border/70 pt-3"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.9 }}
            >
              <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Acme MSA · p.14', 'Northwind Lease · p.3', 'Ortega SOW · p.1'].map((source) => (
                  <span
                    key={source}
                    className="inline-flex items-center gap-1 rounded border border-border/70 bg-card px-1.5 py-0.5 text-2xs text-muted-foreground"
                  >
                    <FileText className="h-2.5 w-2.5" aria-hidden="true" />
                    {source}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
