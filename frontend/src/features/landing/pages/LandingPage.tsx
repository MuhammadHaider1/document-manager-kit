import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  FileCheck2,
  FolderTree,
  History,
  Lock,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/shared/Logo'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { EASE, Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { Typewriter } from '@/components/motion/Typewriter'
import { TextReveal } from '@/components/motion/TextReveal'
import { ScrollProgress } from '@/components/motion/ScrollProgress'
import { TiltCard } from '@/components/motion/TiltCard'
import { LandingHeader } from '@/features/landing/components/LandingHeader'
import { ProductPreview } from '@/features/landing/components/ProductPreview'
import { PricingSection } from '@/features/landing/components/PricingSection'
import { FaqSection } from '@/features/landing/components/FaqSection'

const HERO_PHRASES = ['Ask across every matter.', 'Trace every version.', 'Prove every change.']

const STEPS = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload once',
    description:
      'Drop in contracts, pleadings, leases and correspondence. Text is extracted, chunked and indexed in the background.',
  },
  {
    icon: Search,
    step: '02',
    title: 'Search in plain language',
    description:
      'Ask “which indemnities are uncapped?” and get a grounded answer with source titles from your firm’s documents.',
  },
  {
    icon: FileCheck2,
    step: '03',
    title: 'Prove every change',
    description:
      'Versions are immutable and every action is recorded with who, what, when and from where.',
  },
]

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI search with sources',
    description:
      'Document answers are grounded in retrieved passages and scoped to one organization; general knowledge is clearly labelled.',
  },
  {
    icon: History,
    title: 'Version lineage',
    description:
      'Every upload creates an immutable version. Compare, download or restore any point in a document’s history.',
  },
  {
    icon: ScrollText,
    title: 'Complete audit trail',
    description:
      'Actor, action, entity, IP address and JSON detail for every operation, retained for as long as you need it.',
  },
  {
    icon: Users,
    title: 'Role-based access',
    description:
      'Seven roles from Viewer to Organization Owner. The server enforces permissions on every request.',
  },
  {
    icon: FolderTree,
    title: 'Hierarchical folders',
    description:
      'Mirror your matter structure with nested folders and cascade-safe deletes that never orphan a record.',
  },
  {
    icon: Lock,
    title: 'Tenant isolation',
    description:
      'Every query is filtered by organization at the database layer. One firm can never see another’s files.',
  },
]

const SECURITY_POINTS = [
  'Organization-scoped queries enforced server-side, not in the UI',
  'JWT access and refresh tokens with short access lifetimes',
  'Encrypted object storage with expiring download links',
  'Immutable version history and append-only audit records',
  'Rate limiting on authentication and AI endpoints',
  'Least-privilege roles, validated on every request',
]

export function LandingPage() {
  useDocumentTitle()
  const reduce = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const previewY = useTransform(scrollYProgress, [0, 1], [0, 48])

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <LandingHeader />

      <main>
        {/* Hero */}
        <section ref={heroRef} className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_36rem_at_70%_-10%,hsl(var(--accent)/0.14),transparent_65%)]"
            aria-hidden="true"
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
            animate={reduce ? undefined : { x: [0, 24, 0], y: [0, -20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-accent/[0.07] blur-3xl"
            animate={reduce ? undefined : { x: [0, -18, 0], y: [0, 26, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="container relative pb-16 pt-14 sm:pb-20 sm:pt-20">
            <Stagger className="mx-auto max-w-3xl text-center" stagger={0.1}>
              <StaggerItem>
                <Badge tone="gold" className="mx-auto mb-6 w-fit">
                  Built for law firms and in-house counsel
                </Badge>
              </StaggerItem>
              <StaggerItem>
                <h1 className="font-display text-display">
                  <TextReveal text="The record is the case." />
                  <span className="block bg-gradient-to-r from-accent via-accent to-accent/70 bg-clip-text text-transparent">
                    <TextReveal text="Keep it exact." delay={0.16} />
                  </span>
                </h1>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-5 font-mono text-xs uppercase tracking-[0.2em] text-accent sm:text-sm">
                  <Typewriter phrases={HERO_PHRASES} />
                </p>
              </StaggerItem>
              <StaggerItem>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Docuflow turns a firm’s scattered contracts and case files into one searchable,
                  versioned and fully auditable workspace — with AI that grounds document answers in
                  your files and clearly labels general knowledge.
                </p>
              </StaggerItem>
              <StaggerItem>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <motion.div
                    whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  >
                    <Button asChild variant="accent" size="lg">
                      <Link to="/register">
                        Start free
                        <ArrowRight />
                      </Link>
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={reduce ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  >
                    <Button asChild variant="outline" size="lg">
                      <a href="mailto:sales@docuflow.app?subject=Docuflow%20demo">Book a demo</a>
                    </Button>
                  </motion.div>
                </div>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-4 text-xs text-muted-foreground">
                  No card required · Your documents stay in your organization
                </p>
              </StaggerItem>
            </Stagger>

            <motion.div
              className="mt-14 sm:mt-16"
              style={reduce ? undefined : { y: previewY }}
              initial={reduce ? false : { opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
            >
              <TiltCard>
                <ProductPreview />
              </TiltCard>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-t border-border/70 py-20 sm:py-24"
        >
          <div className="container">
            <Reveal className="max-w-2xl">
              <p className="label-caps">How it works</p>
              <h2 className="mt-3 font-display text-display-sm">
                <TextReveal text="Three steps to a defensible record" />
              </h2>
              <p className="mt-4 text-muted-foreground">
                No migration project, no re-typing filenames. Start with one matter and grow into
                the whole practice.
              </p>
            </Reveal>

            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <motion.li
                  key={step.step}
                  className="surface group relative isolate overflow-hidden p-6 transition-[border-color,box-shadow] duration-500 hover:border-accent/40 hover:shadow-raised"
                  initial={reduce ? false : { opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.55, delay: index * 0.08, ease: EASE }}
                  style={
                    reduce
                      ? undefined
                      : { transformPerspective: 1200, transformStyle: 'preserve-3d' }
                  }
                  whileHover={
                    reduce
                      ? undefined
                      : {
                          y: -8,
                          scale: 1.015,
                          rotateX: 1.5,
                          rotateY: index === 1 ? 0 : index === 0 ? -1.8 : 1.8,
                        }
                  }
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--accent)/0.16),transparent_55%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-accent to-transparent transition-transform duration-700 ease-out-soft group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                  <div className="flex items-center justify-between [transform:translateZ(28px)]">
                    <motion.span
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/15 bg-accent-soft text-accent shadow-sm transition-shadow group-hover:shadow-[0_10px_30px_-12px_hsl(var(--accent)/0.7)]"
                      whileHover={reduce ? undefined : { rotate: -6, scale: 1.08 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    >
                      <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </motion.span>
                    <span className="font-display text-2xl text-muted-foreground/35 transition-[color,transform] duration-500 group-hover:-translate-y-1 group-hover:text-accent/70">
                      {step.step}
                    </span>
                  </div>
                  <div className="[transform:translateZ(18px)]">
                    <h3 className="mt-5 font-display text-lg transition-colors group-hover:text-accent">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-24 border-t border-border/70 bg-sidebar/50 py-20 sm:py-24"
        >
          <div className="container">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <Reveal className="max-w-2xl">
                <p className="label-caps">Capabilities</p>
                <h2 className="mt-3 font-display text-display-sm">
                  <TextReveal text="Everything a legal record has to survive" />
                </h2>
              </Reveal>
              <Reveal delay={0.08} className="max-w-sm">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Built from the workflow outward: intake, retrieval, review, retention and proof.
                </p>
              </Reveal>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <motion.article
                  key={feature.title}
                  className="surface group relative isolate overflow-hidden p-6 transition-[border-color,box-shadow] duration-500 hover:border-accent/40 hover:shadow-raised"
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: (index % 3) * 0.07, ease: EASE }}
                  style={
                    reduce
                      ? undefined
                      : { transformPerspective: 1100, transformStyle: 'preserve-3d' }
                  }
                  whileHover={
                    reduce
                      ? undefined
                      : {
                          y: -8,
                          scale: 1.015,
                          rotateX: -1.5,
                          rotateY: ((index % 3) - 1) * 1.6,
                        }
                  }
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.14),transparent_52%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -left-1/2 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-accent to-transparent transition-transform duration-700 group-hover:translate-x-[300%] motion-reduce:transition-none"
                  />
                  <motion.span
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background text-accent shadow-sm transition-[border-color,box-shadow] duration-300 group-hover:border-accent/35 group-hover:shadow-[0_10px_30px_-12px_hsl(var(--accent)/0.65)] [transform:translateZ(32px)]"
                    whileHover={reduce ? undefined : { rotate: 8, scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                  >
                    <feature.icon className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                  <div className="[transform:translateZ(20px)]">
                    <h3 className="mt-4 font-display text-lg transition-colors group-hover:text-accent">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-24 py-20 sm:py-24">
          <div className="container">
            <Reveal>
              <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-raised">
                <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
                  <div className="space-y-4">
                    <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent">
                      Security & trust
                    </p>
                    <h2 className="font-display text-[2rem] leading-tight tracking-tight text-primary-foreground">
                      <TextReveal text="Confidential by architecture, not by promise" />
                    </h2>
                    <p className="text-sm leading-relaxed text-primary-foreground/70">
                      Legal work is privileged by default. Docuflow is designed so that isolation,
                      access control and evidence are properties of the system — not settings
                      someone remembers to turn on.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {[
                        'Tenant isolation',
                        'Encrypted at rest',
                        'Expiring links',
                        'Full audit trail',
                      ].map((chip) => (
                        <motion.span
                          key={chip}
                          className="rounded-full border border-primary-foreground/20 px-3 py-1 text-2xs text-primary-foreground/80"
                          whileHover={
                            reduce
                              ? undefined
                              : {
                                  y: -2,
                                  scale: 1.05,
                                  borderColor: 'hsl(var(--accent) / 0.6)',
                                }
                          }
                          transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                        >
                          {chip}
                        </motion.span>
                      ))}
                    </div>
                  </div>

                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {SECURITY_POINTS.map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <ShieldCheck
                          className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <span className="text-sm leading-relaxed text-primary-foreground/80">
                          {point}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <PricingSection />
        <FaqSection />

        {/* Closing CTA */}
        <section className="py-20 sm:py-24">
          <div className="container">
            <Reveal>
              <motion.div
                className="surface flex flex-col items-center gap-5 px-6 py-14 text-center"
                whileHover={reduce ? undefined : { y: -4 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              >
                <motion.span
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent"
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </motion.span>
                <h2 className="max-w-2xl font-display text-display-sm">
                  <TextReveal text="Give your firm one version of the truth" />
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Upload your first document today. Indexing, version history and the audit trail
                  are included on every plan.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <motion.div
                    whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                  >
                    <Button asChild variant="accent" size="lg">
                      <Link to="/register">
                        Start free
                        <ArrowRight />
                      </Link>
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={reduce ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                  >
                    <Button asChild variant="outline" size="lg">
                      <Link to="/login">Sign in</Link>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-sidebar/60">
        <div className="container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Document workflow and grounded AI search for legal teams.
            </p>
          </div>

          <div>
            <p className="label-caps mb-3">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-foreground">
                  Security
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="label-caps mb-3">Company</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="mailto:sales@docuflow.app" className="hover:text-foreground">
                  Contact sales
                </a>
              </li>
              <li>
                <a href="mailto:security@docuflow.app" className="hover:text-foreground">
                  Security
                </a>
              </li>
              <li>
                <Link to="/login" className="hover:text-foreground">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="label-caps mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Privacy notice</li>
              <li>Terms of service</li>
              <li>Data processing addendum</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/70">
          <div className="container flex flex-col gap-2 py-5 text-2xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Docuflow. All rights reserved.</p>
            <p>Made for teams who keep the record.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
