import { Plus } from 'lucide-react'

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
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-border/70 bg-sidebar/50 py-20 sm:py-24"
    >
      <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          <p className="label-caps">Questions</p>
          <h2 className="font-display text-display-sm">Answered plainly</h2>
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
        </div>

        <div className="divide-y divide-border/70 border-y border-border/70">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left">
                <span className="text-sm font-medium sm:text-[0.9375rem]">{faq.question}</span>
                <Plus
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-4 pr-8 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
