import { Link } from 'react-router-dom'
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
import { LandingHeader } from '@/features/landing/components/LandingHeader'
import { ProductPreview } from '@/features/landing/components/ProductPreview'
import { PricingSection } from '@/features/landing/components/PricingSection'
import { FaqSection } from '@/features/landing/components/FaqSection'

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
      'Ask “which indemnities are uncapped?” and get an answer drawn only from your firm’s documents.',
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
    title: 'AI search with citations',
    description:
      'Answers are grounded in retrieved passages from your documents, scoped to one organization — never the open web.',
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

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_36rem_at_70%_-10%,hsl(var(--accent)/0.14),transparent_65%)]"
            aria-hidden="true"
          />
          <div className="container relative pb-16 pt-14 sm:pb-20 sm:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <Badge tone="gold" className="mx-auto mb-6 w-fit">
                Built for law firms and in-house counsel
              </Badge>
              <h1 className="font-display text-display">
                The record is the case.
                <span className="block text-accent">Keep it exact.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Docuflow turns a firm’s scattered contracts and case files into one searchable,
                versioned and fully auditable workspace — with AI that answers only from your own
                documents.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild variant="accent" size="lg">
                  <Link to="/register">
                    Start free
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="mailto:sales@docuflow.app?subject=Docuflow%20demo">Book a demo</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                No card required · Your documents stay in your organization
              </p>
            </div>

            <div className="mt-14 animate-fade-up sm:mt-16">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-t border-border/70 py-20 sm:py-24"
        >
          <div className="container">
            <div className="max-w-2xl">
              <p className="label-caps">How it works</p>
              <h2 className="mt-3 font-display text-display-sm">
                Three steps to a defensible record
              </h2>
              <p className="mt-4 text-muted-foreground">
                No migration project, no re-typing filenames. Start with one matter and grow into
                the whole practice.
              </p>
            </div>

            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.step} className="surface relative p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-2xl text-muted-foreground/35">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
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
              <div className="max-w-2xl">
                <p className="label-caps">Capabilities</p>
                <h2 className="mt-3 font-display text-display-sm">
                  Everything a legal record has to survive
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Built from the workflow outward: intake, retrieval, review, retention and proof.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="surface p-6 transition-shadow hover:shadow-raised"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background text-accent">
                    <feature.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-lg">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-24 py-20 sm:py-24">
          <div className="container">
            <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-raised">
              <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
                <div className="space-y-4">
                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent">
                    Security & trust
                  </p>
                  <h2 className="font-display text-[2rem] leading-tight tracking-tight text-primary-foreground">
                    Confidential by architecture, not by promise
                  </h2>
                  <p className="text-sm leading-relaxed text-primary-foreground/70">
                    Legal work is privileged by default. Docuflow is designed so that isolation,
                    access control and evidence are properties of the system — not settings someone
                    remembers to turn on.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      'Tenant isolation',
                      'Encrypted at rest',
                      'Expiring links',
                      'Full audit trail',
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-primary-foreground/20 px-3 py-1 text-2xs text-primary-foreground/80"
                      >
                        {chip}
                      </span>
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
          </div>
        </section>

        <PricingSection />
        <FaqSection />

        {/* Closing CTA */}
        <section className="py-20 sm:py-24">
          <div className="container">
            <div className="surface flex flex-col items-center gap-5 px-6 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-2xl font-display text-display-sm">
                Give your firm one version of the truth
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                Upload your first document today. Indexing, version history and the audit trail are
                included on every plan.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="accent" size="lg">
                  <Link to="/register">
                    Start free
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
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
