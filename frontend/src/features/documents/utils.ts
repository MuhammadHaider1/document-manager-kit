import type { Document, DocumentVersion, Folder } from '@/types/domain'

export function latestVersion(document: Document | undefined): DocumentVersion | null {
  if (!document?.versions?.length) return null
  return [...document.versions].sort((a, b) => b.version_number - a.version_number)[0] ?? null
}

export function documentFileLabel(document: Document): string {
  const version = latestVersion(document)
  if (!version) return 'No file attached'
  return version.file_name
}

export function documentSize(document: Document): number {
  return latestVersion(document)?.file_size ?? 0
}

export function flattenFolders(folders: Folder[], depth = 0): Array<Folder & { depth: number }> {
  return folders.flatMap((folder) => [
    { ...folder, depth },
    ...flattenFolders(folder.children ?? [], depth + 1),
  ])
}

export function countFolders(folders: Folder[]): number {
  return folders.reduce((total, folder) => total + 1 + countFolders(folder.children ?? []), 0)
}

/** Finds the folder path for a folder id, used in breadcrumb-style labels. */
export function folderPath(folders: Folder[], folderId: string): Folder[] {
  for (const folder of folders) {
    if (folder.id === folderId) return [folder]
    const childPath = folderPath(folder.children ?? [], folderId)
    if (childPath.length > 0) return [folder, ...childPath]
  }
  return []
}
