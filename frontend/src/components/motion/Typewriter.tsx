import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TypewriterProps {
  phrases: string[]
  className?: string
  typingSpeed?: number
  deletingSpeed?: number
  pause?: number
  showCaret?: boolean
}

/**
 * Cycles through phrases with a typewriter effect. The animated text is hidden
 * from assistive technology, which reads a stable phrase instead.
 */
export function Typewriter({
  phrases,
  className,
  typingSpeed = 55,
  deletingSpeed = 26,
  pause = 1700,
  showCaret = true,
}: TypewriterProps) {
  const reduce = useReducedMotion()
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [text, setText] = useState(reduce ? (phrases[0] ?? '') : '')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (reduce) {
      setText(phrases[0] ?? '')
      return
    }

    const current = phrases[phraseIndex] ?? ''

    if (!deleting && text === current) {
      const timeout = window.setTimeout(() => setDeleting(true), pause)
      return () => window.clearTimeout(timeout)
    }

    if (deleting && text === '') {
      setDeleting(false)
      setPhraseIndex((index) => (index + 1) % Math.max(phrases.length, 1))
      return
    }

    const timeout = window.setTimeout(
      () => {
        setText(current.slice(0, deleting ? text.length - 1 : text.length + 1))
      },
      deleting ? deletingSpeed : typingSpeed
    )

    return () => window.clearTimeout(timeout)
  }, [deleting, deletingSpeed, pause, phraseIndex, phrases, reduce, text, typingSpeed])

  return (
    <span className={cn('inline-flex items-baseline', className)}>
      <span aria-hidden="true">{text}</span>
      {showCaret && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.08em] animate-caret-blink bg-current"
        />
      )}
      <span className="sr-only">{phrases[0]}</span>
    </span>
  )
}
