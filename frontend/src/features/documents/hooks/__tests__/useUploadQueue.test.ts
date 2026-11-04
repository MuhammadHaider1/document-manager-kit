import { describe, expect, it } from 'vitest'
import { titleFromFile, validateFile } from '@/features/documents/hooks/useUploadQueue'

function makeFile(name: string, size = 1024, type = 'text/plain'): File {
  const file = new File(['x'], name, { type })
  if (size !== file.size) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('validateFile', () => {
  it('accepts supported document types', () => {
    expect(validateFile(makeFile('contract.pdf', 1024, 'application/pdf'))).toBeNull()
    expect(validateFile(makeFile('lease.docx'))).toBeNull()
    expect(validateFile(makeFile('notes.txt'))).toBeNull()
    expect(validateFile(makeFile('scan.png', 1024, 'image/png'))).toBeNull()
  })

  it('rejects unsupported extensions case-insensitively', () => {
    expect(validateFile(makeFile('archive.zip'))).toMatch(/unsupported file type/i)
    expect(validateFile(makeFile('macro.exe'))).toMatch(/unsupported file type/i)
  })

  it('rejects empty files', () => {
    expect(validateFile(makeFile('empty.txt', 0))).toMatch(/empty/i)
  })

  it('rejects files above the configured limit', () => {
    expect(validateFile(makeFile('huge.pdf', 26 * 1024 * 1024, 'application/pdf'))).toMatch(
      /25 MB or smaller/i
    )
  })
})

describe('titleFromFile', () => {
  it('turns separators into spaces and capitalises words', () => {
    expect(titleFromFile(makeFile('acme-vendor-agreement.txt'))).toBe('Acme Vendor Agreement')
    expect(titleFromFile(makeFile('2026_lease_agreement.pdf'))).toBe('2026 Lease Agreement')
  })

  it('preserves existing capitals for acronyms', () => {
    expect(titleFromFile(makeFile('NDA-acme-2026.docx'))).toBe('NDA Acme 2026')
    expect(titleFromFile(makeFile('MSA.pdf'))).toBe('MSA')
  })

  it('falls back to the raw file name when nothing remains', () => {
    expect(titleFromFile(makeFile('.txt'))).toBe('.txt')
  })
})
