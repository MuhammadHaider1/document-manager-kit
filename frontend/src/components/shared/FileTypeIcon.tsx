import { FileText, FileType2, Image as ImageIcon, Sheet } from 'lucide-react'
import { cn } from '@/lib/utils'

const EXTENSION_ICONS = {
  pdf: FileText,
  doc: FileType2,
  docx: FileType2,
  txt: Sheet,
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  webp: ImageIcon,
} as const

export function fileExtension(fileName: string | undefined): string {
  if (!fileName) return ''
  const parts = fileName.split('.')
  return parts.length > 1 ? (parts[parts.length - 1] ?? '').toLowerCase() : ''
}

export function FileTypeIcon({
  fileName,
  mimeType,
  className,
}: {
  fileName?: string
  mimeType?: string
  className?: string
}) {
  const extension = fileExtension(fileName)
  const Icon =
    EXTENSION_ICONS[extension as keyof typeof EXTENSION_ICONS] ??
    (mimeType?.startsWith('image/') ? ImageIcon : FileText)

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground',
        className
      )}
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}
