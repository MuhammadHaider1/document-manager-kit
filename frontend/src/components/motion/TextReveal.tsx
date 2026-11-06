import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE } from './Reveal'

interface TextRevealProps {
  text: string
  className?: string
  delay?: number
  once?: boolean
  amount?: number
  inView?: boolean
}

/** Reveals a heading word by word as it scrolls into view. */
export function TextReveal({
  text,
  className,
  delay = 0,
  once = true,
  amount = 0.4,
  inView = true,
}: TextRevealProps) {
  const reduce = useReducedMotion()
  const words = text.split(' ')

  if (reduce) return <span className={className}>{text}</span>

  if (!inView) {
    return (
      <span className={cn('inline', className)}>
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className="-mb-[0.1em] inline-block overflow-hidden pb-[0.1em] align-bottom"
          >
            <motion.span
              className="inline-block"
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{ duration: 0.62, delay: delay + index * 0.055, ease: EASE }}
            >
              {word}
              {index < words.length - 1 ? '\u00A0' : ''}
            </motion.span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <motion.span
      className={cn('inline', className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.055, delayChildren: delay } },
      }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="-mb-[0.1em] inline-block overflow-hidden pb-[0.1em] align-bottom"
        >
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '110%', opacity: 0 },
              show: { y: '0%', opacity: 1, transition: { duration: 0.62, ease: EASE } },
            }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}
