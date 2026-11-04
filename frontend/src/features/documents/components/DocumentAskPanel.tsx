import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Copy, Info, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/shared/Field'
import { Input } from '@/components/ui/input'
import { MarkdownAnswer } from '@/components/shared/MarkdownAnswer'
import { ragApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import type { Document } from '@/types/domain'

const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(4, 'Ask a question about this document.')
    .max(500, 'Keep the question under 500 characters.'),
})

type QuestionValues = z.infer<typeof questionSchema>

const NO_CONTEXT_PREFIX = 'No relevant information found in documents'

export function DocumentAskPanel({ document }: { document: Document }) {
  const [result, setResult] = useState<{ question: string; answer: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<QuestionValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: { question: '' },
  })

  const mutation = useMutation({
    mutationFn: (question: string) => ragApi.query(question),
    onSuccess: (data) => setResult({ question: data.query, answer: data.answer }),
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'The question could not be answered.')
    },
  })

  const ask = (values: QuestionValues) => {
    setError('question', {})
    mutation.mutate(values.question.trim())
  }

  const question = watch('question')
  const noContext = result?.answer.trim().startsWith(NO_CONTEXT_PREFIX) ?? false

  const copyAnswer = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.answer)
      toast.success('Answer copied.')
    } catch {
      toast.error('Could not copy the answer in this browser.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg">Ask about this document</h2>
        <p className="text-sm text-muted-foreground">
          Ask a focused question about “{document.title}”.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <p>
          The API answers from the whole organization index; document-scoped retrieval is not
          exposed yet. Questions about this file work best when its title or subject is included.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(ask)}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        noValidate
      >
        <Field
          label="Your question"
          htmlFor="document-question"
          error={errors.question?.message}
          className="flex-1"
        >
          <Input
            id="document-question"
            placeholder="What are the termination and renewal terms?"
            aria-invalid={Boolean(errors.question)}
            {...register('question')}
          />
        </Field>
        <Button type="submit" variant="accent" loading={mutation.isPending}>
          <Sparkles />
          Ask
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {[
          'Summarise the key obligations.',
          'What are the notice periods?',
          'Identify any unusual clauses.',
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setValue('question', suggestion, { shouldValidate: true })
              mutation.mutate(suggestion)
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1 text-2xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
          >
            <Wand2 className="h-3 w-3" aria-hidden="true" />
            {suggestion}
          </button>
        ))}
      </div>

      {mutation.isPending && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
          </span>
          Searching this organization&apos;s indexed documents…
        </div>
      )}

      {mutation.isError && !mutation.isPending && (
        <div
          className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-4 text-sm"
          role="alert"
        >
          <p className="font-medium text-destructive">The question could not be answered</p>
          <p className="mt-1 text-muted-foreground">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Please try again in a moment.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              if (question.trim()) mutation.mutate(question.trim())
            }}
            disabled={!question.trim()}
          >
            Try again
          </Button>
        </div>
      )}

      {result && !mutation.isPending && (
        <article className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-card">
          <header className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">You asked:</span> {result.question}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-2xs"
              onClick={() => void copyAnswer()}
            >
              <Copy />
              Copy
            </Button>
          </header>

          {noContext ? (
            <div className="rounded-lg border border-warning/25 bg-warning/5 px-3.5 py-3">
              <p className="text-sm font-medium">No relevant content found</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                This document may still be processing, or it does not contain content that answers
                the question. Check the document status and try again once it is indexed.
              </p>
            </div>
          ) : (
            <MarkdownAnswer content={result.answer} />
          )}

          <p className="border-t border-border/60 pt-2.5 text-2xs text-muted-foreground">
            Generated from your organization&apos;s indexed documents. Verify against the source
            before relying on it.
          </p>
        </article>
      )}
    </div>
  )
}
