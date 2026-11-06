import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { EASE } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#security', label: 'Security' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export function LandingHeader() {
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      className={cn(
        'sticky top-0 z-40 border-b transition-colors duration-300',
        scrolled
          ? 'border-border/80 bg-background/85 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      )}
      initial={reduce ? false : { y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="container flex h-[4.5rem] items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Landing navigation">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHovered(link.href)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(link.href)}
              onBlur={() => setHovered(null)}
              className="relative py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
              {hovered === link.href && (
                <motion.span
                  layoutId="landing-nav-underline"
                  className="absolute inset-x-0 -bottom-0.5 h-px bg-accent"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.03 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            <Button asChild variant="accent" size="sm">
              <Link to="/register">Start free</Link>
            </Button>
          </motion.div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={open ? 'close' : 'open'}
                initial={reduce ? false : { rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={reduce ? undefined : { rotate: 45, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {open ? <X /> : <Menu />}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="mobile-menu"
            className="overflow-hidden md:hidden"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
          >
            <nav
              className="container flex flex-col border-t border-border bg-background py-3"
              aria-label="Mobile landing navigation"
            >
              {LINKS.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * index, duration: 0.22 }}
                  className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </motion.a>
              ))}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Sign in
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
