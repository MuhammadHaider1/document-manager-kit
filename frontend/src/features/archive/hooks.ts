import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi, documentsApi } from '@/lib/api/endpoints'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useAuthStore } from '@/store/auth'
import type { AuditLog, Document } from '@/types/domain'
import { deriveArchivedCandidates, type ArchivedCandidate } from './utils'

const AUDIT_PAGE_SIZE = 100
const AUDIT_MAX_EVENTS = 300

export interface ArchivedDocumentEntry {
  candidate: ArchivedCandidate
  document: Document
}

export interface ArchivedDocumentList {
  items: ArchivedDocumentEntry[]
  /** Audit candidates whose document details could not be loaded. */
  failed: number
}

const DETAIL_CONCURRENCY = 8

async function loadArchivedDocuments(
  candidates: ArchivedCandidate[]
): Promise<ArchivedDocumentList> {
  const items: ArchivedDocumentEntry[] = []
  let failed = 0

  // Verify in small batches: the audit log can yield many candidates and the
  // API has no bulk lookup, so firing every GET at once would be abusive.
  for (let index = 0; index < candidates.length; index += DETAIL_CONCURRENCY) {
    const batch = candidates.slice(index, index + DETAIL_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (candidate) => ({
        candidate,
        document: await documentsApi.get(candidate.id),
      }))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.document.is_archived) items.push(result.value)
      } else {
        failed += 1
      }
    }
  }

  return { items, failed }
}

async function fetchDocumentAuditEvents(organizationId: string): Promise<AuditLog[]> {
  const events: AuditLog[] = []

  for (let offset = 0; offset < AUDIT_MAX_EVENTS; offset += AUDIT_PAGE_SIZE) {
    const page = await auditApi.list({
      organization_id: organizationId,
      limit: AUDIT_PAGE_SIZE,
      offset,
      entity_type: 'DOCUMENT',
    })
    events.push(...page)
    if (page.length < AUDIT_PAGE_SIZE) break
  }

  return events
}

/**
 * Lists archived documents by replaying the most recent document audit events
 * and then verifying each candidate with `GET /documents/{id}`. This is a
 * best-effort reconstruction of a capability the API does not expose; see the
 * Archive screen for the user-facing explanation.
 */
export function useArchivedDocuments() {
  const organizationId = useAuthStore((state) => state.activeOrganizationId)
  const { can, isLoading: roleLoading } = useCapabilities()
  const canReadAudit = can('audit:read')

  const auditQuery = useQuery({
    queryKey: ['archive', organizationId, 'audit'],
    queryFn: () => fetchDocumentAuditEvents(organizationId!),
    enabled: Boolean(organizationId) && !roleLoading && canReadAudit,
    staleTime: 30_000,
  })

  const candidates = useMemo(
    () => deriveArchivedCandidates(auditQuery.data ?? []),
    [auditQuery.data]
  )

  const candidateKey = candidates.map((candidate) => candidate.id).join(',')

  const documentsQuery = useQuery({
    queryKey: ['archive', organizationId, 'documents', candidateKey],
    queryFn: () => loadArchivedDocuments(candidates),
    enabled: Boolean(organizationId) && candidates.length > 0,
    staleTime: 15_000,
  })

  return {
    canReadAudit,
    roleLoading,
    auditQuery,
    documentsQuery,
    candidates,
    items: documentsQuery.data?.items ?? [],
    failed: documentsQuery.data?.failed ?? 0,
    scannedEvents: auditQuery.data?.length ?? 0,
    isLoading: auditQuery.isLoading || (candidates.length > 0 && documentsQuery.isLoading),
  }
}
