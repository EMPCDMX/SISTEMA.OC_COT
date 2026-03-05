import Vibrant from 'node-vibrant'
import type { ThemeTokens } from '@/lib/supabase'

// ── Fallback theme ────────────────────────────────────────────────────────
const FALLBACK_THEME: ThemeTokens = {
  primary:        '#1F2937',
  secondary:      '#111827',
  accent:         '#2563EB',
  headerBg:       '#1F2937',
  headerText:     '#FFFFFF',
  tableHeaderBg:  '#F3F4F6',
  tableBorder:    '#D1D5DB',
}

/**
 * Extrae paleta de colores desde un Buffer de imagen (PNG/SVG→PNG/JPEG).
 * Usa node-vibrant para detectar colores dominantes.
 * Si no se detectan colores útiles, usa el fallback.
 */
export async function extractThemeFromBuffer(imageBuffer: Buffer): Promise<ThemeTokens> {
  try {
    const palette = await Vibrant.from(imageBuffer).getPalette()

    const swatches = [
      palette.Vibrant,
      palette.DarkVibrant,
      palette.Muted,
      palette.DarkMuted,
      palette.LightVibrant,
      palette.LightMuted,
    ].filter(Boolean)

    if (swatches.length === 0) return FALLBACK_THEME

    // Filtrar swatches "útiles" (no demasiado blancos/negros/grises)
    const useful = swatches.filter((s) => {
      if (!s) return false
      const [, saturation, lightness] = s.hsl
      return saturation > 0.1 && lightness > 0.05 && lightness < 0.95
    })

    const candidates = useful.length > 0 ? useful : swatches.filter(Boolean)

    const primary   = candidates[0]?.hex ?? FALLBACK_THEME.primary
    const secondary = candidates[1]?.hex ?? darken(primary, 0.15)
    const accent    = candidates[2]?.hex ?? FALLBACK_THEME.accent

    const headerBg    = ensureDarkEnough(primary)
    const headerText  = getContrastText(headerBg)
    const tableHeaderBg = lighten(primary, 0.88)
    const tableBorder   = '#D1D5DB'

    return {
      primary,
      secondary,
      accent,
      headerBg,
      headerText,
      tableHeaderBg,
      tableBorder,
    }
  } catch {
    return FALLBACK_THEME
  }
}

// ── Helpers de color ──────────────────────────────────────────────────────

/** Convierte hex a RGB [0,1] */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16) / 255
  const g = parseInt(cleaned.slice(2, 4), 16) / 255
  const b = parseInt(cleaned.slice(4, 6), 16) / 255
  return [r, g, b]
}

/** Luminancia relativa (WCAG) */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Devuelve '#FFFFFF' o '#000000' según el contraste con bg */
function getContrastText(bg: string): string {
  const lum = relativeLuminance(bg)
  // Fondo oscuro → texto blanco; fondo claro → texto negro
  return lum < 0.4 ? '#FFFFFF' : '#000000'
}

/** Oscurece un color hex por un factor (0–1) */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const factor = 1 - amount
  return toHex(r * factor, g * factor, b * factor)
}

/** Aclara un color hex (mezcla con blanco) */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return toHex(
    r + (1 - r) * amount,
    g + (1 - g) * amount,
    b + (1 - b) * amount,
  )
}

/** Asegura que el color sea suficientemente oscuro para header */
function ensureDarkEnough(hex: string): string {
  const lum = relativeLuminance(hex)
  if (lum > 0.4) return darken(hex, 0.4) // aclarar si es muy claro
  return hex
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const toInt = (v: number) => Math.round(clamp(v) * 255)
  return '#' + [toInt(r), toInt(g), toInt(b)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export { FALLBACK_THEME }
