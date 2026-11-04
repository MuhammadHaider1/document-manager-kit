import { useEffect, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

const INTERACTIVE = 'a,button,[role="button"],input,textarea,select,summary,[data-cursor="hover"]'

/**
 * A soft accent glow and ring that trail the pointer. Native cursors are left
 * untouched. The effect is disabled for touch input and reduced-motion users.
 */
export function CursorGlow() {
  const reduce = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const [active, setActive] = useState(false)
  const x = useMotionValue(-500)
  const y = useMotionValue(-500)

  const glowX = useSpring(x, { stiffness: 120, damping: 22, mass: 0.5 })
  const glowY = useSpring(y, { stiffness: 120, damping: 22, mass: 0.5 })
  const ringX = useSpring(x, { stiffness: 550, damping: 38, mass: 0.18 })
  const ringY = useSpring(y, { stiffness: 550, damping: 38, mass: 0.18 })

  useEffect(() => {
    if (reduce) return

    const finePointer = window.matchMedia('(pointer: fine)')
    if (!finePointer.matches) return

    setEnabled(true)

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX)
      y.set(event.clientY)
      const target = event.target as HTMLElement | null
      setActive(Boolean(target?.closest(INTERACTIVE)))
    }

    const onLeave = () => {
      x.set(-500)
      y.set(-500)
      setActive(false)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, x, y])

  if (!enabled || reduce) return null

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[60] hidden md:block"
        style={{ x: glowX, y: glowY }}
      >
        <div
          className="h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--accent) / 0.11), hsl(var(--accent) / 0.035) 42%, transparent 68%)',
          }}
        />
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[61] hidden md:block"
        style={{ x: ringX, y: ringY }}
      >
        <motion.div
          className="h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60"
          animate={{ scale: active ? 1.9 : 1, opacity: active ? 0.9 : 0.4 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        />
      </motion.div>
    </>
  )
}
