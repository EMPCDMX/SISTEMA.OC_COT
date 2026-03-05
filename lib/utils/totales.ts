export type Partida = {
  concepto: string
  cantidad: number
  precio_unitario: number
}

export type PartidaConImporte = Partida & {
  importe: number
}

export type Totales = {
  subtotal: number
  iva: number
  total: number
}

/**
 * Calcula importe por partida y totales del documento.
 * @param partidas  Lista de partidas con cantidad y precio_unitario
 * @param ivaTasa   Tasa IVA (default 0.16)
 */
export function calcularTotales(
  partidas: Partida[],
  ivaTasa: number = 0.16,
): { partidas: PartidaConImporte[]; totales: Totales } {
  const conImporte: PartidaConImporte[] = partidas.map((p) => ({
    ...p,
    importe: round2(p.cantidad * p.precio_unitario),
  }))

  const subtotal = round2(conImporte.reduce((acc, p) => acc + p.importe, 0))
  const iva      = round2(subtotal * ivaTasa)
  const total    = round2(subtotal + iva)

  return { partidas: conImporte, totales: { subtotal, iva, total } }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Formatea un número como moneda MXN: "$1,234.56"
 */
export function formatCurrency(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
