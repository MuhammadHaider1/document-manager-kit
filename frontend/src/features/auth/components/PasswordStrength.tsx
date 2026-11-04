import { cn } from '@/lib/utils'
import { passwordScore } from '../schemas'

const LABELS = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const
const COLORS = [
  'bg-destructive',
  'bg-destructive',
  'bg-warning',
  'bg-success',
  'bg-success',
] as const

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password)
  if (!password) return null

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              index < score ? COLORS[score] : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className="text-2xs text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{LABELS[score]}</span>
        {score < 3 && ' — add length, numbers and a symbol.'}
      </p>
    </div>
  )
}
