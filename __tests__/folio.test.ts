import { extractFolioNumber } from '@/lib/utils/safeSlug'

describe('extractFolioNumber — casos de negocio', () => {
  const cases: [string, number][] = [
    ['H00039719',    39719],
    ['H00001',          1],
    ['FAC-2024-0042',  20240042],
    ['0042',           42],
    ['00042',          42],
    ['COT-000001',      1],
    ['INV2024001',  2024001],
  ]

  test.each(cases)('extractFolioNumber("%s") === %d', (folio, expected) => {
    expect(extractFolioNumber(folio)).toBe(expected)
  })

  it('devuelve 0 si no hay dígitos', () => {
    expect(extractFolioNumber('ABCXYZ')).toBe(0)
    expect(extractFolioNumber('')).toBe(0)
  })
})
