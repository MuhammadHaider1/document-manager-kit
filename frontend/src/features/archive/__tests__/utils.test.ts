import { describe, expect, it } from 'vitest'
import type { AuditLog } from '@/types/domain'
import { deriveArchivedCandidates } from '../utils'

let sequence = 0

function event(action: string, createdAt: string, overrides: Partial<AuditLog> = {}): AuditLog {
  sequence += 1
  return {
    id: `event-${sequence}`,
    organization_id: 'org-1',
    action,
    entity_type: 'DOCUMENT',
    entity_id: `document-${sequence}`,
    created_at: createdAt,
    ...overrides,
  }
}

describe('deriveArchivedCandidates', () => {
  it('keeps documents whose latest archive event has no later restore', () => {
    const candidates = deriveArchivedCandidates([
      event('ARCHIVE_DOCUMENT', '2026-10-01T10:00:00.000Z', {
        entity_id: 'doc-archived',
      }),
      event('CREATE_DOCUMENT', '2026-10-02T10:00:00.000Z', {
        entity_id: 'doc-active',
      }),
      event('ARCHIVE_DOCUMENT', '2026-10-03T10:00:00.000Z', {
        entity_id: 'doc-restored',
      }),
      event('RESTORE_DOCUMENT', '2026-10-04T10:00:00.000Z', {
        entity_id: 'doc-restored',
      }),
    ])

    expect(candidates).toEqual([{ id: 'doc-archived', archivedAt: '2026-10-01T10:00:00.000Z' }])
  })

  it('uses the last event when a document is restored and archived again', () => {
    const candidates = deriveArchivedCandidates([
      event('ARCHIVE_DOCUMENT', '2026-09-01T10:00:00.000Z', { entity_id: 'doc-1' }),
      event('RESTORE_DOCUMENT', '2026-09-02T10:00:00.000Z', { entity_id: 'doc-1' }),
      event('ARCHIVE_DOCUMENT', '2026-09-03T10:00:00.000Z', { entity_id: 'doc-1' }),
    ])

    expect(candidates).toEqual([{ id: 'doc-1', archivedAt: '2026-09-03T10:00:00.000Z' }])
  })

  it('ignores non-document events and events without an entity id', () => {
    const candidates = deriveArchivedCandidates([
      event('ARCHIVE_DOCUMENT', '2026-10-01T10:00:00.000Z', {
        entity_type: 'FOLDER',
        entity_id: 'folder-1',
      }),
      event('ARCHIVE_DOCUMENT', '2026-10-02T10:00:00.000Z', {
        entity_id: null,
      }),
    ])

    expect(candidates).toEqual([])
  })

  it('sorts the most recently archived documents first', () => {
    const candidates = deriveArchivedCandidates([
      event('ARCHIVE_DOCUMENT', '2026-10-01T10:00:00.000Z', { entity_id: 'older' }),
      event('ARCHIVE_DOCUMENT', '2026-10-05T10:00:00.000Z', { entity_id: 'newer' }),
    ])

    expect(candidates.map((candidate) => candidate.id)).toEqual(['newer', 'older'])
  })
})
