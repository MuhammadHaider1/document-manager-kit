import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { notificationsApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { cn, relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

const NOTIFICATION_TONE: Record<string, string> = {
  INFO: 'bg-info',
  SUCCESS: 'bg-success',
  WARNING: 'bg-warning',
  ERROR: 'bg-destructive',
}

export function NotificationMenu() {
  const queryClient = useQueryClient()

  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications(true),
    queryFn: () => notificationsApi.list({ unread_only: true, limit: 50 }),
    refetchInterval: 60_000,
  })

  const recentQuery = useQuery({
    queryKey: queryKeys.notifications(false),
    queryFn: () => notificationsApi.list({ limit: 8 }),
    refetchInterval: 60_000,
  })

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Could not update the notification.'),
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read.')
    },
    onError: () => toast.error('Could not mark notifications as read.'),
  })

  const unreadCount = unreadQuery.data?.length ?? 0
  const notifications = recentQuery.data ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold text-accent-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-2xs"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {recentQuery.isLoading && (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-14 w-full" />
              ))}
            </div>
          )}

          {!recentQuery.isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">
                Processing updates and review requests will appear here.
              </p>
            </div>
          )}

          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => {
                if (!notification.is_read) markRead.mutate(notification.id)
              }}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50',
                !notification.is_read && 'bg-accent-soft/40'
              )}
            >
              <span
                className={cn(
                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                  NOTIFICATION_TONE[notification.notification_type] ?? 'bg-muted-foreground',
                  notification.is_read && 'opacity-30'
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">{notification.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {notification.message}
                </span>
                <span className="mt-1 block text-2xs text-muted-foreground/80">
                  {relativeTime(notification.created_at)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
