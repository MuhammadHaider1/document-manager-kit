import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { EASE, Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { TextReveal } from '@/components/motion/TextReveal'

const FAQS = [
  {
    question: 'Where are our documents stored?',
    answer:
      'Documents are stored in object storage inside your organization’s namespace, encrypted in transit and at rest. Every retrieval is scoped to your organization at the database level — a query cannot cross into another firm’s data.',
  },
  {
    question: 'Does Ask AI ever use our documents to train a model?',
    answer:
      'No. Questions are answered using retrieval over your own indexed content, and answers are generated per request. Your documents are never used to train third-party models.',
  },
  {
    question: 'What does “grounded” mean?',
    answer:
      'The assistant retrieves the most relevant passages from your documents and answers only from those passages. If nothing relevant exists, it says so instead of guessing.',
  },
  {
    question: 'Can we prove who changed a document?',
    answer:
      'Yes. Every upload, version, archive and restore is written to an append-only audit trail with the actor, action, entity, IP address and timestamp. Versions themselves are immutable.',
  },
  {
    question: 'How is access controlled?',
    answer:
      'Organizations are fully isolated. Within an organization, members are assigned one of seven roles — from Viewer to Organization Owner — and the server enforces the corresponding permissions on every request.',
  },
  {
    question: 'Can we import an existing folder structure?',
    answer:
      'Yes. Folders are hierarchical and can be created through the app or the API before or after documents are uploaded. Uploads can target any folder in the tree.',
  },
]

export function FaqSection() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<string | null>(FAQS[0]?.question ?? null)

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-border/70 bg-sidebar/50 py-20 sm:py-24"
    >
      <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal className="space-y-3">
          <p className="label-caps">Questions</p>
          <h2 className="font-display text-display-sm">
            <TextReveal text="Answered plainly" />
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            If your question is about procurement, data residency or a security review, talk to us
            directly at{' '}
            <a
              href="mailto:security@docuflow.app"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              security@docuflow.app
            </a>
            .
          </p>
        </Reveal>

        <Stagger className="divide-y divide-border/70 border-y border-border/70" stagger={0.06}>
          {FAQS.map((faq, index) => {
            const isOpen = open === faq.question
            return (
              <StaggerItem key={faq.question} className="py-1" y={14}>
                <motion.button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : faq.question)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${index}`}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  whileHover={reduce ? undefined : { x: 3 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                >
                  <span className="text-sm font-medium sm:text-[0.9375rem]">{faq.question}</span>
                  <motion.span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground"
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </motion.span>
                </motion.button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${index}`}
                      key="content"
                      className="overflow-hidden"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: EASE }}
                    >
                      <p className="pb-4 pr-8 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}
