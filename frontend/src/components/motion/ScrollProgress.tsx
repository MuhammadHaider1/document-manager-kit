import { motion, useScroll, useSpring } from 'framer-motion'

/** Thin gold progress bar pinned to the top of the landing page. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-accent"
      style={{ scaleX }}
    />
  )
}
