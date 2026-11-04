import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  return (
    <section id="pricing" className="scroll-mt-24 py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="label-caps">Pricing</p>
          <h2 className="mt-3 font-display text-display-sm">Priced per lawyer, not per document</h2>
          <p className="mt-4 text-muted-foreground">
            Every plan includes document indexing, version history and the audit trail. Upgrade when
            your team grows — your record stays intact.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'relative flex flex-col rounded-xl border bg-card p-6 shadow-card',
                tier.highlight ? 'border-accent/45 ring-1 ring-accent/20' : 'border-border/80'
              )}
            >
              {tier.highlight && (
                <Badge tone="gold" className="absolute -top-2.5 left-6">
                  Most chosen
                </Badge>
              )}
              <div className="space-y-1.5">
                <h3 className="font-display text-xl">{tier.name}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-4xl tracking-tight">{tier.price}</span>
                <span className="text-xs text-muted-foreground">{tier.cadence}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="text-foreground/85">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-7"
                variant={tier.highlight ? 'accent' : 'outline'}
                size="lg"
              >
                {tier.cta === 'Book a demo' ? (
                  <a href="mailto:sales@docuflow.app?subject=Docuflow%20demo">Book a demo</a>
                ) : (
                  <Link to="/register">{tier.cta}</Link>
                )}
              </Button>
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
