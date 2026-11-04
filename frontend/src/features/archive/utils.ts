import type { AuditLog } from '@/types/domain'

export interface ArchivedCandidate {
  id: string
  archivedAt: string
}

/**
 * Reconstructs the current archive state from audit events.
 *
 * `GET /documents/search` deliberately excludes archived documents and the API
 * has no archived-listing endpoint, so the audit log is the only read model
 * available. Events are replayed in chronological order; the last archive or
 * restore event for a document wins. Lacking an event therefore means "not
 * known to be archived", not necessarily "active".
 */
export function deriveArchivedCandidates(logs: AuditLog[]): ArchivedCandidate[] {
  const byDocument = new Map<string, ArchivedCandidate>()

  const ordered = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  for (const log of ordered) {
    if ((log.entity_type ?? '').toUpperCase() !== 'DOCUMENT') continue
    if (!log.entity_id) continue

    switch (log.action.toUpperCase()) {
      case 'ARCHIVE_DOCUMENT':
        byDocument.set(log.entity_id, {
          id: log.entity_id,
          archivedAt: log.created_at,
        })
        break
      case 'RESTORE_DOCUMENT':
        byDocument.delete(log.entity_id)
        break
      default:
        break
    }
  }

  return [...byDocument.values()].sort(
    (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  )
}
