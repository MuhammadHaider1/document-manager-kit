import { describe, expect, it } from 'vitest'
import { buildInviteMessage } from '../utils'

const inviteUrl = 'https://docuflow.example/invite/token-123'

describe('buildInviteMessage', () => {
  it('describes the invitation link, role and expiry', () => {
    const message = buildInviteMessage({
      organizationName: 'Northwind Legal',
      inviteUrl,
      roleName: 'Member',
      inviterName: 'Alex Morgan',
      expiresAt: '2026-11-08T01:06:22.856497Z',
    })

    expect(message).toContain('Northwind Legal')
    expect(message).toContain('join as Member')
    expect(message).toContain(inviteUrl)
    expect(message).toContain('can be used once and expires on')
    expect(message).toContain('Thanks,\nAlex Morgan')
  })

  it('falls back to a generic organization name, role and signature', () => {
    const message = buildInviteMessage({
      organizationName: '   ',
      inviteUrl,
      inviterName: null,
    })

    expect(message).toContain('join our workspace on Docuflow')
    expect(message).toContain('You will join as Member')
    expect(message.endsWith('Thanks,')).toBe(true)
  })
})
