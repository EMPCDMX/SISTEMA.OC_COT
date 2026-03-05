/**
 * Utilidades para días hábiles (MX).
 * Los días hábiles son lunes–viernes, excluyendo días inhábiles registrados.
 */

/** Retorna true si el día de la semana es sábado o domingo */
function isWeekend(date: Date): boolean {
  const dow = date.getDay() // 0=Dom, 6=Sáb
  return dow === 0 || dow === 6
}

/**
 * Suma/resta N días hábiles a una fecha dada.
 * @param date        Fecha base
 * @param days        Número de días hábiles (positivo = adelante, negativo = atrás)
 * @param holidays    Set de fechas inhabilitadas en formato 'YYYY-MM-DD'
 */
export function addBusinessDays(
  date: Date,
  days: number,
  holidays: Set<string> = new Set(),
): Date {
  const direction = days < 0 ? -1 : 1
  let remaining = Math.abs(days)
  const current = new Date(date)
  current.setHours(0, 0, 0, 0)

  while (remaining > 0) {
    current.setDate(current.getDate() + direction)
    const iso = toISODate(current)
    if (!isWeekend(current) && !holidays.has(iso)) {
      remaining--
    }
  }
  return new Date(current)
}

/**
 * Calcula la fecha de la cotización: 2 días hábiles ANTES de fecha_solicitud.
 */
export function calcCotDate(
  fechaSolicitud: Date,
  holidays: Set<string> = new Set(),
): Date {
  return addBusinessDays(fechaSolicitud, -2, holidays)
}

/**
 * Convierte una Date a string 'YYYY-MM-DD' (zona local, sin UTC offset).
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parsea un string 'YYYY-MM-DD' a Date (medianoche local).
 */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0)
}

/**
 * Formatea una fecha para mostrar en PDF: "DD de MMMM de YYYY" en español.
 */
export function formatDateES(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
