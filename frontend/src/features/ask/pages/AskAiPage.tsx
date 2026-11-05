import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowUp,
  Bot,
  Copy,
  FileSearch,
  Info,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotionCard } from '@/components/motion/MotionCard'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MarkdownAnswer } from '@/components/shared/MarkdownAnswer'
import { PageHeader } from '@/components/shared/PageHeader'
import { streamRequest } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { RAG_STREAM_PATH, SUGGESTED_QUESTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'

const NO_CONTEXT_PREFIX = 'No relevant information found in documents'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  stopped?: boolean
}

let messageCounter = 0
function nextId(): string {
  messageCounter += 1
  return `msg-${Date.now()}-${messageCounter}`
}

export function AskAiPage() {
  useDocumentTitle('Ask AI')
  const reduce = useReducedMotion()
  const user = useAuthStore((state) => state.user)
  const { activeOrganization } = useActiveOrganization()
  const { roleName } = useCapabilities()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !stickToBottomRef.current) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const controller = abortRef.current
    return () => {
      controller?.abort()
    }
  }, [])

  const updateAssistant = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...update } : message))
    )
  }, [])

  const runQuery = useCallback(
    async (rawQuestion: string, mode: 'new' | 'regenerate' = 'new') => {
      const question = rawQuestion.trim()
      if (!question || streaming) return

      const assistantId = nextId()
      stickToBottomRef.current = true
      setMessages((current) => {
        const base =
          mode === 'regenerate' && current[current.length - 1]?.role === 'assistant'
            ? current.slice(0, -1)
            : current
        const withUser =
          mode === 'regenerate'
            ? base
            : [...base, { id: nextId(), role: 'user' as const, content: question }]
        return [...withUser, { id: assistantId, role: 'assistant', content: '' }]
      })
      setInput('')
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      let accumulated = ''

      try {
        const response = await streamRequest(RAG_STREAM_PATH, {
          method: 'POST',
          body: { query: question },
          organization: true,
          signal: controller.signal,
        })

        const contentType = response.headers.get('content-type') ?? ''
        const isSse = contentType.includes('text/event-stream')

        if (!response.body) {
          throw new Error('The server returned an empty response.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const append = (text: string) => {
          if (!text) return
          accumulated += text
          updateAssistant(assistantId, { content: accumulated })
        }

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          if (!isSse) {
            append(chunk)
            continue
          }
          // Some deployments wrap chunks as SSE frames. Parse them defensively.
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('data:')) append(line.slice(5).trimStart())
          }
        }

        if (isSse && buffer.startsWith('data:')) append(buffer.slice(5).trimStart())
        if (!isSse) append(decoder.decode())

        if (!accumulated.trim()) {
          updateAssistant(assistantId, {
            content: 'The assistant returned an empty answer. Try rephrasing the question.',
            error: true,
          })
        } else {
          updateAssistant(assistantId, { content: accumulated })
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          updateAssistant(assistantId, {
            content: accumulated,
            stopped: true,
          })
        } else {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'The question could not be answered.'
          updateAssistant(assistantId, {
            content: accumulated || message,
            error: true,
          })
          if (!accumulated) toast.error(message)
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
        textareaRef.current?.focus()
      }
    },
    [streaming, updateAssistant]
  )

  const stop = () => {
    abortRef.current?.abort()
  }

  const reset = () => {
    abortRef.current?.abort()
    stickToBottomRef.current = true
    setMessages([])
    setStreaming(false)
    setInput('')
  }

  const copy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Answer copied.')
    } catch {
      toast.error('This browser would not allow copying.')
    }
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  const canRegenerate = Boolean(lastUser && lastAssistant && !streaming)
  const suggestions = SUGGESTED_QUESTIONS.slice(0, 4)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={activeOrganization?.name ?? 'Workspace'}
        title="Ask AI"
        description="Ask questions in plain language. Answers are generated from passages retrieved from this organization's indexed documents."
        context={
          <Badge tone="gold">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {roleName ? `Retrieval as ${roleName}` : 'Organization index'}
          </Badge>
        }
        actions={
          messages.length > 0 ? (
            <Button variant="outline" onClick={reset} disabled={streaming}>
              <Trash2 />
              New conversation
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="flex h-[calc(100dvh-19rem)] min-h-[26rem] flex-col overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={(event) => {
              const node = event.currentTarget
              stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96
            }}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
            aria-live="polite"
            aria-busy={streaming}
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="max-w-md space-y-1.5">
                  <h2 className="font-display text-xl">What would you like to know?</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Ask about clauses, obligations, dates or defined terms. Retrieval covers every
                    indexed document in {activeOrganization?.name ?? 'this organization'}.
                  </p>
                </div>
                <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <motion.button
                      key={suggestion}
                      type="button"
                      onClick={() => void runQuery(suggestion)}
                      className="rounded-lg border border-border/70 bg-card px-3.5 py-2.5 text-left text-xs leading-relaxed text-muted-foreground shadow-sm transition-[color,background-color,border-color,box-shadow] duration-200 hover:border-accent/50 hover:bg-muted/30 hover:text-foreground hover:shadow-card"
                      whileHover={reduce ? undefined : { y: -2 }}
                      whileTap={reduce ? undefined : { scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-5">
                {messages.map((message, index) =>
                  message.role === 'user' ? (
                    <li key={message.id} className="flex justify-end">
                      <div className="flex max-w-[85%] items-start gap-2.5">
                        <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                          {message.content}
                        </div>
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <User className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                    </li>
                  ) : (
                    <li key={message.id} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'rounded-2xl rounded-tl-sm border px-4 py-3',
                            message.error
                              ? 'border-destructive/25 bg-destructive/5'
                              : 'border-border/80 bg-muted/25'
                          )}
                        >
                          {message.content ? (
                            message.content.trim().startsWith(NO_CONTEXT_PREFIX) ? (
                              <div className="space-y-1">
                                <p className="text-sm font-medium">No relevant content found</p>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                  {message.content}
                                </p>
                              </div>
                            ) : (
                              <MarkdownAnswer content={message.content} />
                            )
                          ) : (
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex gap-1" aria-hidden="true">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                              </span>
                              Searching the organization index…
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {message.stopped && (
                            <span className="text-2xs text-muted-foreground">Stopped</span>
                          )}
                          {message.error && (
                            <span className="text-2xs font-medium text-destructive">
                              Incomplete answer
                            </span>
                          )}
                          {message.content && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-1.5 text-2xs"
                              onClick={() => void copy(message.content)}
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          )}
                          {index === messages.length - 1 && canRegenerate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-1.5 text-2xs"
                              onClick={() => {
                                if (lastUser) void runQuery(lastUser.content, 'regenerate')
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Regenerate
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          <div className="border-t border-border/70 bg-card px-4 py-3 sm:px-5">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void runQuery(input)
              }}
              className="flex items-end gap-2"
            >
              <label htmlFor="ask-input" className="sr-only">
                Ask a question about this organization&apos;s documents
              </label>
              <Textarea
                id="ask-input"
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void runQuery(input)
                  }
                }}
                placeholder="e.g. What notice periods apply to termination for convenience?"
                rows={2}
                maxLength={1000}
                disabled={streaming}
                className="min-h-[3rem] resize-none"
              />
              {streaming ? (
                <Button type="button" variant="outline" onClick={stop} aria-label="Stop generating">
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="accent"
                  disabled={!input.trim()}
                  aria-label="Send question"
                >
                  <ArrowUp />
                  Ask
                </Button>
              )}
            </form>
            <p className="mt-2 text-2xs text-muted-foreground">
              Enter to send · Shift + Enter for a new line · {input.length}/1000
            </p>
          </div>
        </Card>

        <aside className="space-y-4">
          <MotionCard interactive={false} delay={0.08}>
            <CardHeader>
              <CardTitle className="text-base">How retrieval works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Your question is matched against text extracted from processed documents in{' '}
                <span className="font-medium text-foreground">{activeOrganization?.name}</span>.
              </p>
              <p>
                Each question is answered independently; the assistant does not remember earlier
                turns in this conversation.
              </p>
              <p>
                Answers come from document passages, so Ask AI cannot enumerate the document
                register. Use <span className="font-medium text-foreground">Documents</span> for
                titles and versions.
              </p>
              <p>
                Only documents with status{' '}
                <span className="font-medium text-foreground">Indexed</span> contribute reliable
                passages. Documents still processing may not appear.
              </p>
            </CardContent>
          </MotionCard>

          <div className="rounded-xl border border-info/25 bg-info/5 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="h-3.5 w-3.5 text-info" aria-hidden="true" />
              Verify before relying
            </p>
            <p className="mt-1.5">
              Answers are generated text, not legal advice. The API does not return citation
              metadata, so open the source document to confirm the quoted terms.
            </p>
          </div>

          <MotionCard interactive={false} delay={0.14}>
            <CardHeader>
              <CardTitle className="text-base">Suggested questions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {SUGGESTED_QUESTIONS.map((suggestion) => (
                <motion.button
                  key={suggestion}
                  type="button"
                  disabled={streaming}
                  onClick={() => void runQuery(suggestion)}
                  className="rounded-md px-2 py-1.5 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-50"
                  whileHover={reduce || streaming ? undefined : { x: 3 }}
                  whileTap={reduce || streaming ? undefined : { scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                >
                  {suggestion}
                </motion.button>
              ))}
            </CardContent>
          </MotionCard>

          {user && (
            <MotionCard interactive={false} delay={0.2}>
              <CardHeader>
                <CardTitle className="text-base">Index scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Queries are scoped to the active organization and use your own access token. Data
                  is never mixed between organizations.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/app/documents">
                    <FileSearch />
                    Browse indexed documents
                  </Link>
                </Button>
              </CardContent>
            </MotionCard>
          )}
        </aside>
      </div>
    </div>
  )
}
