import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { MessageSquare, Reply, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/shared/Field'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { commentsApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/queryClient'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useAuthStore } from '@/store/auth'
import type { Comment } from '@/types/domain'

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write a comment before posting.')
    .max(2000, 'Keep comments under 2,000 characters.'),
})

type CommentValues = z.infer<typeof commentSchema>

function CommentItem({
  comment,
  currentUserId,
  canWrite,
  onReply,
  onDelete,
}: {
  comment: Comment
  currentUserId: string | undefined
  canWrite: boolean
  onReply: (comment: Comment) => void
  onDelete: (comment: Comment) => void
}) {
  const isOwn = currentUserId === comment.user.id
  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <UserAvatar name={comment.user.full_name} email={comment.user.email} className="h-8 w-8" />
        <div className="min-w-0 flex-1 rounded-lg border border-border/70 bg-muted/20 px-3.5 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-[0.8125rem] font-medium">
              {comment.user.full_name ?? comment.user.email}
            </p>
            <RelativeTime value={comment.created_at} className="text-2xs text-muted-foreground" />
            {canWrite && (
              <button
                type="button"
                onClick={() => onReply(comment)}
                className="ml-auto inline-flex items-center gap-1 rounded text-2xs text-muted-foreground hover:text-foreground"
              >
                <Reply className="h-3 w-3" aria-hidden="true" />
                Reply
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className="inline-flex items-center gap-1 rounded text-2xs text-muted-foreground hover:text-destructive"
                aria-label="Delete your comment"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {comment.content}
          </p>
        </div>
      </div>
      {comment.replies.length > 0 && (
        <ul className="ml-11 space-y-3 border-l border-border/70 pl-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              canWrite={false}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function DocumentComments({
  documentId,
  canWrite,
}: {
  documentId: string
  canWrite: boolean
}) {
  const { activeOrganizationId } = useActiveOrganization()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null)

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments(activeOrganizationId, documentId),
    queryFn: () => commentsApi.list(documentId),
    enabled: Boolean(activeOrganizationId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '' },
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.comments(activeOrganizationId, documentId),
    })
  }

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.remove(commentId),
    onSuccess: () => {
      toast.success('Comment deleted.')
      setCommentToDelete(null)
      invalidate()
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the comment.')
    },
  })

  const onSubmit = async (values: CommentValues) => {
    try {
      await commentsApi.create(documentId, {
        content: values.content.trim(),
        parent_id: replyTo?.id ?? null,
      })
      toast.success(replyTo ? 'Reply posted.' : 'Comment posted.')
      reset({ content: '' })
      setReplyTo(null)
      invalidate()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.content) {
        setError('content', { message: error.fieldErrors.content })
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not post the comment.')
    }
  }

  const comments = commentsQuery.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Discussion</h2>
          <p className="text-sm text-muted-foreground">
            Review notes attached to this document, visible to everyone in the organization.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {comments.length} {comments.length === 1 ? 'thread' : 'threads'}
        </span>
      </div>

      {canWrite ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2" noValidate>
          {replyTo && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-1.5 text-xs">
              <span className="truncate text-muted-foreground">
                Replying to {replyTo.user.full_name ?? replyTo.user.email}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-medium text-accent hover:underline"
              >
                Cancel reply
              </button>
            </div>
          )}
          <Field
            label={replyTo ? 'Your reply' : 'Add a comment'}
            htmlFor="comment-content"
            error={errors.content?.message}
          >
            <Textarea
              id="comment-content"
              placeholder="Note a review point, a deviation from precedent, or a follow-up for the matter team…"
              aria-invalid={Boolean(errors.content)}
              {...register('content')}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="accent" size="sm" loading={isSubmitting}>
              <MessageSquare />
              {replyTo ? 'Post reply' : 'Post comment'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          Your role can read the discussion but not post to it.
        </p>
      )}

      {commentsQuery.isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : commentsQuery.isError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm">
          Could not load the discussion.
          <Button variant="link" size="sm" onClick={() => void commentsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No discussion yet"
          description="Comments keep review decisions next to the document instead of in email threads."
          action={
            canWrite ? (
              <Button
                variant="outline"
                onClick={() => document.getElementById('comment-content')?.focus()}
              >
                Write the first comment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              canWrite={canWrite}
              onReply={setReplyTo}
              onDelete={setCommentToDelete}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(commentToDelete)}
        onOpenChange={(open) => {
          if (!open) setCommentToDelete(null)
        }}
        title="Delete this comment?"
        description="The comment will be removed for everyone in the organization. This cannot be undone."
        confirmLabel="Delete comment"
        destructive
        onConfirm={async () => {
          if (commentToDelete) await deleteMutation.mutateAsync(commentToDelete.id)
        }}
      />
    </div>
  )
}
