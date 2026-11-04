import { formatDate } from '@/lib/utils'

export interface InviteMessageInput {
  organizationName: string
  inviteUrl: string
  roleName?: string | null
  inviterName?: string | null
  expiresAt?: string | null
}

/**
 * Builds the message an inviter can paste into their own email client. The
 * backend creates and tracks the invitation; email delivery is still manual.
 */
export function buildInviteMessage({
  organizationName,
  inviteUrl,
  roleName,
  inviterName,
  expiresAt,
}: InviteMessageInput): string {
  const organization = organizationName.trim() || 'our workspace'
  const role = roleName?.trim() || 'Member'
  const sender = inviterName?.trim()
  const expiry = expiresAt ? formatDate(expiresAt) : null

  return [
    'Hi,',
    '',
    `You're invited to join ${organization} on Docuflow, a document workspace for legal teams. You will join as ${role}.`,
    '',
    `Accept the invitation: ${inviteUrl}`,
    '',
    `Use this email address when you sign in or create your account. The link can be used once${
      expiry ? ` and expires on ${expiry}` : ''
    }.`,
    '',
    `If you were not expecting this invitation, you can ignore this message.`,
    '',
    sender ? `Thanks,\n${sender}` : 'Thanks,',
  ].join('\n')
}
