import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  type HTMLMotionProps,
} from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE } from './Reveal'

interface MotionCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: ReactNode
  /** Delay the entrance animation, useful for staggered grids. */
  delay?: number
  /** Lift and highlight the card on hover. */
  interactive?: boolean
  /** Follow the pointer with a soft accent spotlight. */
  glow?: boolean
}

/**
 * A card surface that fades in on mount and reacts gently to the pointer.
 * Built on the same tokens as the shared Card component so spacing and
 * borders stay consistent across the app.
 */
export function MotionCard({
  children,
  className,
  delay = 0,
  interactive = true,
  glow = true,
  onPointerMove,
  ...props
}: MotionCardProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const pointerX = useMotionValue(50)
  const pointerY = useMotionValue(50)
  const spotlight = useMotionTemplate`radial-gradient(20rem circle at ${pointerX}% ${pointerY}%, hsl(var(--accent) / 0.13), transparent 68%)`
  const showGlow = glow && !reduce

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event)
    if (!showGlow) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    pointerX.set(((event.clientX - rect.left) / rect.width) * 100)
    pointerY.set(((event.clientY - rect.top) / rect.height) * 100)
  }

  return (
    <motion.div
      ref={ref}
      className={cn(
        'surface group/card relative isolate',
        interactive &&
          'transition-[border-color,box-shadow] duration-300 ease-out-soft hover:border-accent/35 hover:shadow-raised',
        className
      )}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      whileHover={
        reduce || !interactive
          ? undefined
          : { y: -3, transition: { type: 'spring', stiffness: 320, damping: 26 } }
      }
      whileTap={reduce || !interactive ? undefined : { scale: 0.997 }}
      onPointerMove={handlePointerMove}
      {...props}
    >
      {showGlow && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          style={{ background: spotlight }}
        />
      )}
      {children}
    </motion.div>
  )
}
