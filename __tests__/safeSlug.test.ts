import { safeSlug, extractFolioNumber, normalizeForCatalog } from '@/lib/utils/safeSlug'

describe('safeSlug', () => {
  it('quita acentos', () => {
    expect(safeSlug('Industrias Técnicas')).toBe('Industrias_Tecnicas')
  })

  it('reemplaza caracteres inválidos por guion', () => {
    expect(safeSlug('Empresa/División:A')).toBe('Empresa-Division-A')
  })

  it('espacios múltiples se convierten en _ único por grupo', () => {
    // \s+ reemplaza cada grupo de espacios con un único _
    expect(safeSlug('  Mi   Empresa  ')).toBe('Mi_Empresa')
  })

  it('devuelve SIN_NOMBRE para string vacío', () => {
    expect(safeSlug('')).toBe('SIN_NOMBRE')
    expect(safeSlug('   ')).toBe('SIN_NOMBRE')
  })

  it('recorta a 80 caracteres', () => {
    const long = 'A'.repeat(100)
    expect(safeSlug(long).length).toBeLessThanOrEqual(80)
  })

  it('maneja nombre normal sin cambios relevantes', () => {
    expect(safeSlug('ACME Corp')).toBe('ACME_Corp')
  })
})

describe('extractFolioNumber', () => {
  it('extrae número de folio con prefijo', () => {
    expect(extractFolioNumber('H00039719')).toBe(39719)
  })

  it('extrae número de folio COT-2024-001', () => {
    expect(extractFolioNumber('COT-2024-001')).toBe(2024001)
  })

  it('maneja folio solo numérico', () => {
    expect(extractFolioNumber('12345')).toBe(12345)
  })

  it('devuelve 0 para folio sin dígitos', () => {
    expect(extractFolioNumber('ABCD')).toBe(0)
  })

  it('extrae dígitos de formato complejo', () => {
    expect(extractFolioNumber('FAC-00042')).toBe(42)
  })
})

describe('normalizeForCatalog', () => {
  it('convierte a minúsculas', () => {
    expect(normalizeForCatalog('GRUPO ALFA')).toBe('grupo_alfa')
  })

  it('normaliza acentos y mayúsculas', () => {
    expect(normalizeForCatalog('Óptica México')).toBe('optica_mexico')
  })
})
