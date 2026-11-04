export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Docuflow'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '')

/** RAG is mounted at /api/v1/query on the running backend (see Backend gaps). */
export const RAG_PATH = '/query'
export const RAG_STREAM_PATH = '/query-stream'

export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 25)
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

export const ACCEPTED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}

export const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_MIME_TYPES).flat()

export const DOCUMENT_STATUS_META: Record<
  string,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'danger'; description: string }
> = {
  pending: {
    label: 'Queued',
    tone: 'neutral',
    description: 'Waiting for the processing worker.',
  },
  processing: {
    label: 'Processing',
    tone: 'info',
    description: 'Text is being extracted and indexed.',
  },
  completed: {
    label: 'Indexed',
    tone: 'success',
    description: 'Searchable and available to Ask AI.',
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    description: 'Processing failed. Upload a new version to retry.',
  },
}

export const POLLING_STATUSES = new Set(['pending', 'processing'])

export const DOCUMENT_PAGE_SIZE = 10

export const STORAGE_KEYS = {
  refreshToken: 'docuflow.refresh',
  activeOrganization: 'docuflow.organization',
  ui: 'docuflow-ui',
} as const

export const SUGGESTED_QUESTIONS = [
  'Which contracts expire in the next 90 days?',
  'Summarize the termination clause in the Acme agreement.',
  'Which agreements have unlimited liability exposure?',
  'List every document that mentions governing law.',
  'What are our standard payment terms across vendor contracts?',
] as const
