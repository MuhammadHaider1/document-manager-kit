import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Info } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/shared/Field'
import { Input } from '@/components/ui/input'
import { EASE, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { TextReveal } from '@/components/motion/TextReveal'
import { ApiError } from '@/lib/api/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'
import { PasswordInput } from '../components/PasswordInput'
import { loginSchema, type LoginValues } from '../schemas'

interface LocationState {
  from?: string
}

export function LoginPage() {
  useDocumentTitle('Sign in')
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  const notice = useAuthStore((state) => state.notice)
  const clearNotice = useAuthStore((state) => state.clearNotice)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values.email.trim(), values.password)
      clearNotice()
      const from = (location.state as LocationState | null)?.from
      const target =
        from && (from.startsWith('/app') || from.startsWith('/invite/')) ? from : '/app'
      navigate(target, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.isUnauthorized || error.status === 400) {
          setError('password', { message: 'Invalid email or password.' })
          return
        }
        if (Object.keys(error.fieldErrors).length > 0) {
          for (const [field, message] of Object.entries(error.fieldErrors)) {
            if (field === 'email' || field === 'password') setError(field, { message })
          }
          return
        }
        toast.error(error.message)
        return
      }
      toast.error('Could not sign in. Please try again.')
    }
  }

  return (
    <div className="space-y-8">
      <motion.div
        className="space-y-2"
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <p className="label-caps">Welcome back</p>
        <h1 className="font-display text-[2rem] leading-tight tracking-tight">
          <TextReveal text="Sign in to your workspace" inView={false} />
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Access your firm&apos;s documents, matter history and AI search.
        </p>
      </motion.div>

      <AnimatePresence initial={false}>
        {notice && (
          <motion.div
            key="notice"
            className="overflow-hidden"
            initial={reduce ? false : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={reduce ? undefined : { opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.26, ease: EASE }}
          >
            <div
              className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/10 px-3.5 py-3 text-sm"
              role="status"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
              <p>{notice}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stagger className="space-y-5" stagger={0.07} inView={false}>
          <StaggerItem>
            <Field label="Work email" htmlFor="email" error={errors.email?.message} required>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@firm.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>
          </StaggerItem>

          <StaggerItem>
            <Field label="Password" htmlFor="password" error={errors.password?.message} required>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            >
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                loading={isSubmitting}
              >
                Sign in
                {!isSubmitting && <ArrowRight />}
              </Button>
            </motion.div>
          </StaggerItem>
        </Stagger>
      </form>

      <motion.p
        className="text-sm text-muted-foreground"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        New to Docuflow?{' '}
        <Link
          to="/register"
          state={location.state}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </motion.p>
    </div>
  )
}
