/**
 * Normaliza un nombre para usarlo como carpeta/nombre de archivo en el ZIP.
 * - Quita acentos (NFD → ASCII)
 * - Reemplaza caracteres inválidos /\:*?"<>| por -
 * - Espacios múltiples → _
 * - Recorta a 80 chars
 * - Vacío → SIN_NOMBRE
 */
export function safeSlug(name: string): string {
  if (!name || !name.trim()) return 'SIN_NOMBRE'

  let s = name.trim()

  // Quitar acentos via NFD decomposition
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Reemplazar caracteres inválidos en nombres de archivo/carpeta
  s = s.replace(/[/\\:*?"<>|]/g, '-')

  // Múltiples espacios/tabs → _
  s = s.replace(/\s+/g, '_')

  // Caracteres de control y no ASCII problemáticos
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1f\x7f]/g, '')

  // Recortar
  s = s.slice(0, 80)

  // Si después de limpiar queda vacío
  if (!s) return 'SIN_NOMBRE'

  return s
}

/**
 * Normaliza nombre para upsert en catálogos (lower, sin acentos, sin extras)
 */
export function normalizeForCatalog(name: string): string {
  return safeSlug(name).toLowerCase()
}

/**
 * Extrae la parte numérica de un folio para el número interno de la COT.
 * Ej: "H00039719" → 39719, "COT-2024-001" → 2024001 (toma todos los dígitos)
 */
export function extractFolioNumber(folio: string): number {
  const digits = folio.replace(/\D/g, '')
  if (!digits) return 0
  // Quitar ceros a la izquierda y parsear
  return parseInt(digits, 10)
}
