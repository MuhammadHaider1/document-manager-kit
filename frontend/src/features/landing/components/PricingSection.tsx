import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EASE, Reveal } from '@/components/motion/Reveal'
import { TextReveal } from '@/components/motion/TextReveal'
import { TiltCard } from '@/components/motion/TiltCard'
import { cn } from '@/lib/utils'

const TIERS = [
  {
    name: 'Chambers',
    price: '$39',
    cadence: 'per user / month',
    description: 'For solo practitioners and small teams building a searchable record.',
    features: [
      'Up to 5 members',
      '500 indexed documents',
      'Full version history',
      'Ask AI over your documents',
      '90-day audit retention',
    ],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Firm',
    price: '$79',
    cadence: 'per user / month',
    description: 'For growing firms that need role controls and a complete audit trail.',
    features: [
      'Unlimited members',
      '10,000 indexed documents',
      'Role-based access (7 roles)',
      'Unlimited audit retention',
      'Document comments and review',
      'Priority support',
    ],
    cta: 'Start free',
    highlight: true,
  },
  {
    name: 'In-house',
    price: 'Custom',
    cadence: 'annual agreement',
    description: 'For legal and compliance teams with procurement and security review.',
    features: [
      'Unlimited everything',
      'SAML SSO and SCIM (roadmap)',
      'Custom retention policy',
      'Dedicated environment',
      'Security review support',
      'Named success manager',
    ],
    cta: 'Book a demo',
    highlight: false,
  },
]

export function PricingSection() {
  const reduce = useReducedMotion()

  return (
    <section id="pricing" className="scroll-mt-24 py-20 sm:py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="label-caps">Pricing</p>
          <h2 className="mt-3 font-display text-display-sm">
            <TextReveal text="Priced per lawyer, not per document" />
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every plan includes document indexing, version history and the audit trail. Upgrade when
            your team grows — your record stays intact.
          </p>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3 lg:py-5">
          {TIERS.map((tier, index) => (
            <div
              key={tier.name}
              className={cn(
                'relative h-full transition-transform duration-500 ease-out-soft',
                tier.highlight && 'lg:z-10 lg:scale-[1.045]'
              )}
            >
              <motion.div
                className="h-full"
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: EASE }}
              >
                <motion.div
                  className="h-full"
                  animate={tier.highlight && !reduce ? { y: [0, -5, 0] } : undefined}
                  transition={
                    tier.highlight && !reduce
                      ? { duration: 5, repeat: Infinity, ease: 'easeInOut' }
                      : undefined
                  }
                >
                  <TiltCard className="h-full" max={tier.highlight ? 6 : 4.5}>
                    <article
                      className={cn(
                        'group relative isolate flex h-full flex-col overflow-visible rounded-xl border bg-card p-6 shadow-card transition-[border-color,box-shadow] duration-500 [transform-style:preserve-3d]',
                        tier.highlight
                          ? 'border-accent/55 shadow-raised ring-1 ring-accent/25 hover:border-accent/80 hover:shadow-[0_30px_80px_-30px_hsl(var(--accent)/0.5)]'
                          : 'border-border/80 hover:border-accent/40 hover:shadow-raised'
                      )}
                    >
                      <div
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.13),transparent_52%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 [transform:translateZ(2px)]',
                          tier.highlight && 'opacity-100'
                        )}
                      />
                      {tier.highlight && (
                        <>
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-8 -bottom-5 -z-20 h-16 rounded-full bg-accent/25 blur-2xl [transform:translateZ(-30px)]"
                          />
                          <Badge
                            tone="gold"
                            className="absolute -top-2.5 left-6 shadow-sm [transform:translateZ(64px)]"
                          >
                            Most chosen
                          </Badge>
                        </>
                      )}

                      <div className="space-y-1.5 [transform:translateZ(34px)]">
                        <h3 className="font-display text-xl">{tier.name}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {tier.description}
                        </p>
                      </div>

                      <div className="mt-6 flex items-baseline gap-1.5 [transform:translateZ(46px)]">
                        <span className="font-display text-4xl tracking-tight">{tier.price}</span>
                        <span className="text-xs text-muted-foreground">{tier.cadence}</span>
                      </div>

                      <ul className="mt-6 flex-1 space-y-2.5 [transform:translateZ(26px)]">
                        {tier.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                              aria-hidden="true"
                            />
                            <span className="text-foreground/85">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-7 [transform:translateZ(40px)]">
                        <Button
                          asChild
                          className="w-full"
                          variant={tier.highlight ? 'accent' : 'outline'}
                          size="lg"
                        >
                          {tier.cta === 'Book a demo' ? (
                            <a href="mailto:sales@docuflow.app?subject=Docuflow%20demo">
                              Book a demo
                            </a>
                          ) : (
                            <Link to="/register">{tier.cta}</Link>
                          )}
                        </Button>
                      </div>
                    </article>
                  </TiltCard>
                </motion.div>
              </motion.div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prices exclude tax. Document limits apply to indexed documents; archived documents remain
          retrievable.
        </p>
      </div>
    </section>
  )
}
