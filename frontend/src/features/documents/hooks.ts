import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, foldersApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { POLLING_STATUSES } from '@/lib/constants'
import { useAuthStore } from '@/store/auth'
import type { Document, DocumentSearchParams } from '@/types/domain'

function useOrganizationId() {
  return useAuthStore((state) => state.activeOrganizationId)
}

export function useDocuments(params: DocumentSearchParams) {
  const organizationId = useOrganizationId()

  return useQuery({
    queryKey: queryKeys.documents(organizationId, params),
    queryFn: () => documentsApi.search(params),
    enabled: Boolean(organizationId),
    placeholderData: (previous) => previous,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((document) => POLLING_STATUSES.has(document.processing_status))
        ? 4000
        : false
    },
  })
}

export function useDocument(documentId: string | undefined) {
  const organizationId = useOrganizationId()

  return useQuery({
    queryKey: queryKeys.document(organizationId, documentId ?? 'none'),
    queryFn: () => documentsApi.get(documentId!),
    enabled: Boolean(organizationId && documentId),
    refetchInterval: (query) => {
      const status = query.state.data?.processing_status
      return status && POLLING_STATUSES.has(status) ? 3000 : false
    },
  })
}

export function useDocumentVersions(documentId: string | undefined) {
  const organizationId = useOrganizationId()

  return useQuery({
    queryKey: queryKeys.versions(organizationId, documentId ?? 'none'),
    queryFn: () => documentsApi.versions(documentId!),
    enabled: Boolean(organizationId && documentId),
  })
}

export function useFolderTree() {
  const organizationId = useOrganizationId()

  return useQuery({
    queryKey: queryKeys.folders(organizationId),
    queryFn: () => foldersApi.tree(),
    enabled: Boolean(organizationId),
  })
}

export function useRemoveFolder() {
  const queryClient = useQueryClient()
  const organizationId = useOrganizationId()

  return useMutation({
    mutationFn: (folderId: string) => foldersApi.remove(folderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders(organizationId) })
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useArchiveDocument() {
  const queryClient = useQueryClient()
  const organizationId = useOrganizationId()

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.archive(documentId),
    onSuccess: (document: Document) => {
      queryClient.setQueryData(queryKeys.document(organizationId, document.id), document)
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

export function useRestoreDocument() {
  const queryClient = useQueryClient()
  const organizationId = useOrganizationId()

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.restore(documentId),
    onSuccess: (document: Document) => {
      queryClient.setQueryData(queryKeys.document(organizationId, document.id), document)
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
