import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TiltCardProps {
  children: ReactNode
  className?: string
  max?: number
}

/** A subtle pointer-tracked 3D tilt that settles back to flat on leave. */
export function TiltCard({ children, className, max = 4.5 }: TiltCardProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)

  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [max, -max]), {
    stiffness: 180,
    damping: 22,
  })
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-max, max]), {
    stiffness: 180,
    damping: 22,
  })

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduce) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  const reset = () => {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 1400 }}
      whileHover={reduce ? undefined : { scale: 1.006 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    >
      {children}
    </motion.div>
  )
}
