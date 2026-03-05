import { addBusinessDays, calcCotDate, toISODate, parseLocalDate } from '@/lib/dates/businessDays'

// Días inhábiles de prueba
const HOLIDAYS = new Set(['2025-04-17', '2025-04-18'])  // Semana Santa 2025

describe('addBusinessDays', () => {
  it('avanza 2 días hábiles en semana normal (lunes)', () => {
    const base   = parseLocalDate('2025-03-10') // lunes
    const result = addBusinessDays(base, 2)
    expect(toISODate(result)).toBe('2025-03-12')   // miércoles
  })

  it('salta fin de semana al avanzar', () => {
    const base   = parseLocalDate('2025-03-13') // jueves
    const result = addBusinessDays(base, 2)
    // jueves+1=viernes, jueves+2=lunes(saltó sábado y domingo)
    expect(toISODate(result)).toBe('2025-03-17')
  })

  it('resta 2 días hábiles (calc COT)', () => {
    const base   = parseLocalDate('2025-03-12') // miércoles
    const result = addBusinessDays(base, -2)
    expect(toISODate(result)).toBe('2025-03-10')   // lunes
  })

  it('salta fin de semana al restar', () => {
    const base   = parseLocalDate('2025-03-17') // lunes
    const result = addBusinessDays(base, -2)
    // lunes-1=viernes, lunes-2=jueves
    expect(toISODate(result)).toBe('2025-03-13')
  })

  it('salta días inhábiles al restar', () => {
    // Si la solicitud es martes 22 abril 2025, -2 días hábiles debe saltar Jueves/Viernes Santo (17/18)
    const base   = parseLocalDate('2025-04-22') // martes
    const result = addBusinessDays(base, -2, HOLIDAYS)
    // martes-1=lunes 21, martes-2=viernes 11 (salta 18, 17, fin de semana)
    // martes 22 → lunes 21 (hábil) → lunes 14 (salta semana santa y fds)
    // En realidad: desde 22 atrás: 21 (lunes=ok), 20 (domingo=skip), 19 (sábado=skip), 18 (inhábil=skip), 17 (inhábil=skip), 16 (miércoles=ok) → resultado: 16
    expect(toISODate(result)).toBe('2025-04-16')
  })
})

describe('calcCotDate', () => {
  it('calcula COT date = 2 hábiles antes de solicitud', () => {
    const solicitud = parseLocalDate('2025-05-07') // miércoles
    const cot       = calcCotDate(solicitud)
    expect(toISODate(cot)).toBe('2025-05-05')   // lunes
  })

  it('respeta días inhábiles al calcular COT', () => {
    const solicitud = parseLocalDate('2025-04-22')
    const cot       = calcCotDate(solicitud, HOLIDAYS)
    expect(toISODate(cot)).toBe('2025-04-16')
  })
})

describe('toISODate y parseLocalDate', () => {
  it('roundtrip fecha', () => {
    const iso    = '2025-12-25'
    const parsed = parseLocalDate(iso)
    expect(toISODate(parsed)).toBe(iso)
  })
})
