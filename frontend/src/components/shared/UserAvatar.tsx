import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { initials } from '@/lib/utils'

export function UserAvatar({
  name,
  email,
  className,
}: {
  name?: string | null
  email?: string | null
  className?: string
}) {
  const label = name || email || 'Unknown user'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={className} aria-label={label}>
          <AvatarFallback>{initials(name || email)}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>
        <span className="block font-medium">{label}</span>
        {name && email && <span className="block opacity-80">{email}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
