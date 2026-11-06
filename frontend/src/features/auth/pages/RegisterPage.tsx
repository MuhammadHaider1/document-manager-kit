import { zodResolver } from '@hookform/resolvers/zod'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
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
import { PasswordStrength } from '../components/PasswordStrength'
import { registerSchema, type RegisterValues } from '../schemas'

interface LocationState {
  from?: string
}

export function RegisterPage() {
  useDocumentTitle('Create an account')
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const registerUser = useAuthStore((state) => state.register)

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const password = watch('password')

  const onSubmit = async (values: RegisterValues) => {
    try {
      await registerUser({
        email: values.email.trim(),
        password: values.password,
        full_name: values.fullName.trim(),
      })
      const from = (location.state as LocationState | null)?.from
      if (from && from.startsWith('/invite/')) {
        toast.success('Your account is ready. Accept the invitation to join your team.')
        navigate(from, { replace: true })
        return
      }
      toast.success('Your workspace is ready. Create your first organization to begin.')
      navigate('/app', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors.email) {
          setError('email', { message: error.fieldErrors.email })
          return
        }
        if (error.fieldErrors.password) {
          setError('password', { message: error.fieldErrors.password })
          return
        }
        toast.error(error.message)
        return
      }
      toast.error('Could not create your account. Please try again.')
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
        <p className="label-caps">Get started</p>
        <h1 className="font-display text-[2rem] leading-tight tracking-tight">
          <TextReveal text="Create your firm's workspace" inView={false} />
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Free to start. Upload your first agreement in minutes — no card required.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stagger className="space-y-5" stagger={0.06} inView={false}>
          <StaggerItem>
            <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Alex Morgan"
                aria-invalid={Boolean(errors.fullName)}
                {...register('fullName')}
              />
            </Field>
          </StaggerItem>

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
            <Field
              label="Password"
              htmlFor="password"
              error={errors.password?.message}
              hint="8+ characters"
              required
            >
              <PasswordInput
                id="password"
                autoComplete="new-password"
                placeholder="Create a password"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              <PasswordStrength password={password} />
            </Field>
          </StaggerItem>

          <StaggerItem>
            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              error={errors.confirmPassword?.message}
              required
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat your password"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
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
                Create account
                {!isSubmitting && <ArrowRight />}
              </Button>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <p className="text-xs leading-relaxed text-muted-foreground">
              By creating an account you agree to your firm&apos;s data-handling policy and to
              Docuflow&apos;s acceptable use terms. Documents remain the property of your
              organization.
            </p>
          </StaggerItem>
        </Stagger>
      </form>

      <motion.p
        className="text-sm text-muted-foreground"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </motion.p>
    </div>
  )
}
