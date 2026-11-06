import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { EASE } from './Reveal'

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/** Fades each route in when the pathname changes. */
export function PageTransition({ children, className }: PageTransitionProps) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
