import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useRestoreDocument } from '@/features/documents/hooks'
import { useArchivedDocuments } from '../hooks'
import { ArchivedDocumentsPage } from '../pages/ArchivedDocumentsPage'
import type { Document, Organization } from '@/types/domain'

vi.mock('@/features/archive/hooks', () => ({
  useArchivedDocuments: vi.fn(),
}))

vi.mock('@/features/documents/hooks', () => ({
  useRestoreDocument: vi.fn(),
}))

vi.mock('@/hooks/useCapabilities', () => ({
  useCapabilities: vi.fn(),
}))

vi.mock('@/hooks/useActiveOrganization', () => ({
  useActiveOrganization: vi.fn(),
}))

const organization: Organization = {
  id: 'org-1',
  name: 'Northwind Legal',
  slug: 'northwind-legal',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const archivedDocument: Document = {
  id: 'doc-1',
  title: 'Old NDA',
  description: null,
  organization_id: organization.id,
  processing_status: 'completed',
  is_archived: true,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
  versions: [
    {
      id: 'version-1',
      version_number: 1,
      storage_key: 'documents/doc-1/v1_nda.pdf',
      file_name: 'nda.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      created_at: '2026-09-01T10:00:00.000Z',
    },
  ],
}

const candidate = { id: archivedDocument.id, archivedAt: '2026-09-03T10:00:00.000Z' }

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter>
          <ArchivedDocumentsPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    canReadAudit: true,
    roleLoading: false,
    auditQuery: {
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    documentsQuery: {
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    },
    candidates: [candidate],
    items: [{ candidate, document: archivedDocument }],
    failed: 0,
    scannedEvents: 12,
    isLoading: false,
    ...overrides,
  }
}

describe('ArchivedDocumentsPage', () => {
  beforeEach(() => {
    vi.mocked(useCapabilities).mockReturnValue({
      role: null,
      roleName: 'Organization Owner',
      isLoading: false,
      capabilities: new Set(),
      can: () => true,
    })
    vi.mocked(useActiveOrganization).mockReturnValue({
      organizations: [organization],
      activeOrganization: organization,
      activeOrganizationId: organization.id,
    })
    vi.mocked(useRestoreDocument).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(archivedDocument),
      isPending: false,
    } as unknown as ReturnType<typeof useRestoreDocument>)
  })

  it('lists archived documents and restores one after confirmation', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(archivedDocument)
    vi.mocked(useRestoreDocument).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRestoreDocument>)
    vi.mocked(useArchivedDocuments).mockReturnValue(
      baseHookState() as unknown as ReturnType<typeof useArchivedDocuments>
    )

    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('link', { name: 'Old NDA' })).toHaveAttribute(
      'href',
      '/app/documents/doc-1'
    )
    expect(screen.getByText(/1 archived document found/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore Old NDA' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore document' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('doc-1'))
  })

  it('explains the audit requirement when the list is unavailable', () => {
    vi.mocked(useArchivedDocuments).mockReturnValue(
      baseHookState({
        canReadAudit: false,
        candidates: [],
        items: [],
        scannedEvents: 0,
      }) as unknown as ReturnType<typeof useArchivedDocuments>
    )

    renderPage()

    expect(screen.getByText(/your role cannot read the audit log/i)).toBeInTheDocument()
    expect(screen.getByText(/archive list unavailable to your role/i)).toBeInTheDocument()
  })
})
