import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/shared/Field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/errors'
import { slugify } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { Organization } from '@/types/domain'

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter your organization name.')
    .max(120, 'That name is too long.'),
  slug: z
    .string()
    .trim()
    .min(2, 'Enter a workspace URL.')
    .max(60, 'Keep the URL under 60 characters.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.'),
})

type Values = z.infer<typeof schema>

interface OrganizationFormProps {
  onCreated?: (organization: Organization) => void
  onCancel?: () => void
  submitLabel?: string
  autoFocus?: boolean
}

export function OrganizationForm({
  onCreated,
  onCancel,
  submitLabel = 'Create organization',
  autoFocus = false,
}: OrganizationFormProps) {
  const createOrganization = useAuthStore((state) => state.createOrganization)
  const [slugTouched, setSlugTouched] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '' },
  })

  const name = watch('name')

  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name ?? ''), { shouldValidate: false })
  }, [name, setValue, slugTouched])

  const onSubmit = async (values: Values) => {
    try {
      const organization = await createOrganization({
        name: values.name.trim(),
        slug: values.slug.trim(),
      })
      toast.success(`${organization.name} is ready.`)
      onCreated?.(organization)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors.slug) setError('slug', { message: error.fieldErrors.slug })
        else if (error.fieldErrors.name) setError('name', { message: error.fieldErrors.name })
        else toast.error(error.message)
        return
      }
      toast.error('Could not create the organization.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Organization name" htmlFor="org-name" error={errors.name?.message} required>
        <Input
          id="org-name"
          placeholder="Raman & Associates"
          aria-invalid={Boolean(errors.name)}
          autoFocus={autoFocus}
          {...register('name')}
        />
      </Field>
      <Field
        label="Workspace URL"
        htmlFor="org-slug"
        error={errors.slug?.message}
        hint="Lowercase, hyphens"
        required
      >
        <Input
          id="org-slug"
          placeholder="raman-associates"
          aria-invalid={Boolean(errors.slug)}
          {...register('slug', { onChange: () => setSlugTouched(true) })}
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="accent" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
