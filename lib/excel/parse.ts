import * as XLSX from 'xlsx'
import { normalizeForCatalog } from '@/lib/utils/safeSlug'

// ── Aliases de columnas ────────────────────────────────────────────────────

const COL_ALIASES: Record<string, string[]> = {
  folio_factura:    ['folio', 'folio solicitud', 'folio de fac', 'folio de factura', 'num solicitud'],
  fecha_solicitud:  ['fecha', 'fecha solicitud', 'fecha de solicitud', 'fecha de fac'],
  cliente:          ['cliente', 'nombre cliente'],
  proveedor:        ['proveedor', 'nombre proveedor', 'vendor'],
  concepto:         ['concepto', 'descripcion', 'descripción', 'detalle', 'item'],
  cantidad:         ['cantidad', 'qty', 'cant', 'piezas'],
  precio_unitario:  ['precio unitario', 'p unitario', 'unit price', 'precio', 'p.u.', 'pu'],
  iva_tasa:         ['iva', 'tasa iva', 'iva%'],
}

// ── Tipos ─────────────────────────────────────────────────────────────────

export type RawRow = {
  folio_factura:   string
  fecha_solicitud: string    // ISO YYYY-MM-DD
  cliente:         string
  proveedor:       string
  concepto:        string
  cantidad:        number
  precio_unitario: number
  iva_tasa:        number
  rowIndex:        number    // para mensajes de error
}

export type ParseError = {
  row: number
  folio?: string
  field: string
  message: string
}

export type ParseResult = {
  rows:   RawRow[]
  errors: ParseError[]
}

// ── Función principal ─────────────────────────────────────────────────────

/**
 * Parsea un Buffer de archivo .xlsx/.xlsm y devuelve filas validadas + errores.
 * @param buffer          Contenido del archivo
 * @param sheetName       Nombre de hoja (opcional; usa la primera si no se especifica)
 */
export function parseExcelSolicitudes(
  buffer: Buffer,
  sheetName?: string,
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0]

  const sheet = workbook.Sheets[targetSheet]
  if (!sheet) {
    return {
      rows:   [],
      errors: [{ row: 0, field: 'sheet', message: `Hoja "${targetSheet}" no encontrada` }],
    }
  }

  // Convertir a array de objetos; raw:false → valores formateados
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  })

  if (raw.length === 0) {
    return {
      rows:   [],
      errors: [{ row: 0, field: 'sheet', message: 'La hoja está vacía' }],
    }
  }

  // Mapear nombres de columna reales → campo canónico
  const headers = Object.keys(raw[0])
  const colMap  = buildColMap(headers)

  const rows:   RawRow[]    = []
  const errors: ParseError[] = []

  raw.forEach((rawRow, idx) => {
    const rowNum = idx + 2 // +2 porque fila 1 es header

    const get = (field: string): string => {
      const col = colMap[field]
      if (!col) return ''
      const val = rawRow[col]
      return val !== null && val !== undefined ? String(val).trim() : ''
    }

    const folio    = get('folio_factura')
    const fechaRaw = get('fecha_solicitud')
    const cliente  = get('cliente')
    const proveedor= get('proveedor')
    const concepto = get('concepto')
    const cantStr  = get('cantidad')
    const precioStr= get('precio_unitario')
    const ivaStr   = get('iva_tasa')

    const rowErrors: ParseError[] = []

    // Validar folio
    if (!folio) {
      rowErrors.push({ row: rowNum, field: 'folio_factura', message: 'Folio vacío' })
    }

    // Validar fecha
    let fecha = ''
    if (!fechaRaw) {
      rowErrors.push({ row: rowNum, folio, field: 'fecha_solicitud', message: 'Fecha vacía' })
    } else {
      fecha = parseDate(fechaRaw)
      if (!fecha) {
        rowErrors.push({ row: rowNum, folio, field: 'fecha_solicitud', message: `Fecha no parseable: "${fechaRaw}"` })
      }
    }

    // Validar cliente
    if (!cliente) {
      rowErrors.push({ row: rowNum, folio, field: 'cliente', message: 'Cliente vacío' })
    }

    // Proveedor puede estar vacío (log warning, no error fatal)
    if (!proveedor) {
      errors.push({ row: rowNum, folio, field: 'proveedor', message: 'Proveedor vacío — no se generará OC para esta fila' })
    }

    // Validar concepto
    if (!concepto) {
      rowErrors.push({ row: rowNum, folio, field: 'concepto', message: 'Concepto vacío' })
    }

    // Validar cantidad
    const cantidad = parseFloat(cantStr.replace(',', '.'))
    if (isNaN(cantidad) || cantidad <= 0) {
      rowErrors.push({ row: rowNum, folio, field: 'cantidad', message: `Cantidad inválida: "${cantStr}"` })
    }

    // Validar precio
    const precio = parseFloat(precioStr.replace(',', '.'))
    if (isNaN(precio) || precio < 0) {
      rowErrors.push({ row: rowNum, folio, field: 'precio_unitario', message: `Precio inválido: "${precioStr}"` })
    }

    // IVA opcional (default 0.16)
    let ivaTasa = 0.16
    if (ivaStr) {
      const parsed = parseFloat(ivaStr.replace('%', '').replace(',', '.'))
      if (!isNaN(parsed)) {
        ivaTasa = parsed > 1 ? parsed / 100 : parsed
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      return // saltar fila con errores críticos
    }

    rows.push({
      folio_factura:   folio,
      fecha_solicitud: fecha,
      cliente:         cliente,
      proveedor:       proveedor,
      concepto:        concepto,
      cantidad:        cantidad,
      precio_unitario: precio,
      iva_tasa:        ivaTasa,
      rowIndex:        rowNum,
    })
  })

  return { rows, errors }
}

// ── Agrupación por folio ──────────────────────────────────────────────────

export type SolicitudAgrupada = {
  folio_factura:   string
  fecha_solicitud: string
  cliente:         string
  cliente_normalizado: string
  iva_tasa:        number
  partidas: {
    proveedor:              string
    proveedor_normalizado:  string
    concepto:               string
    cantidad:               number
    precio_unitario:        number
    orden:                  number
  }[]
}

export function agruparSolicitudes(rows: RawRow[]): SolicitudAgrupada[] {
  const map = new Map<string, SolicitudAgrupada>()

  rows.forEach((row) => {
    const key = row.folio_factura

    if (!map.has(key)) {
      map.set(key, {
        folio_factura:        row.folio_factura,
        fecha_solicitud:      row.fecha_solicitud,
        cliente:              row.cliente,
        cliente_normalizado:  normalizeForCatalog(row.cliente),
        iva_tasa:             row.iva_tasa,
        partidas:             [],
      })
    }

    const sol = map.get(key)!

    sol.partidas.push({
      proveedor:             row.proveedor,
      proveedor_normalizado: normalizeForCatalog(row.proveedor || ''),
      concepto:              row.concepto,
      cantidad:              row.cantidad,
      precio_unitario:       row.precio_unitario,
      orden:                 sol.partidas.length,
    })
  })

  return Array.from(map.values())
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildColMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}

  for (const header of headers) {
    const lower = header.toLowerCase().trim()
    for (const [canonical, aliases] of Object.entries(COL_ALIASES)) {
      if (aliases.includes(lower) && !map[canonical]) {
        map[canonical] = header
        break
      }
    }
  }

  return map
}

function parseDate(raw: string): string {
  // XLSX con cellDates:true puede devolver objetos Date serializados como string
  // O strings como "2024-03-15", "15/03/2024", "15-Mar-24", etc.

  if (!raw) return ''

  // Intento directo ISO
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // Intento con Date.parse (inglés)
  const parsed = new Date(raw)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return ''
}
