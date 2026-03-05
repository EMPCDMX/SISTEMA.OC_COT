import { calcularTotales, formatCurrency } from '@/lib/utils/totales'

describe('calcularTotales', () => {
  it('calcula correctamente con IVA 16%', () => {
    const partidas = [
      { concepto: 'Servicio A', cantidad: 2,  precio_unitario: 100 },
      { concepto: 'Servicio B', cantidad: 5,  precio_unitario: 50  },
    ]
    const { partidas: conImporte, totales } = calcularTotales(partidas, 0.16)

    expect(conImporte[0].importe).toBe(200)
    expect(conImporte[1].importe).toBe(250)
    expect(totales.subtotal).toBe(450)
    expect(totales.iva).toBe(72)
    expect(totales.total).toBe(522)
  })

  it('maneja 0% de IVA', () => {
    const partidas = [{ concepto: 'Exento', cantidad: 1, precio_unitario: 1000 }]
    const { totales } = calcularTotales(partidas, 0)
    expect(totales.iva).toBe(0)
    expect(totales.total).toBe(1000)
  })

  it('redondea a 2 decimales', () => {
    const partidas = [{ concepto: 'Item', cantidad: 3, precio_unitario: 33.33 }]
    const { totales } = calcularTotales(partidas, 0.16)
    expect(totales.subtotal).toBe(99.99)
    expect(totales.iva).toBe(16)
    expect(totales.total).toBe(115.99)
  })

  it('lista vacía devuelve ceros', () => {
    const { totales } = calcularTotales([], 0.16)
    expect(totales.subtotal).toBe(0)
    expect(totales.iva).toBe(0)
    expect(totales.total).toBe(0)
  })

  it('muchos conceptos (>6) no modifica la lógica', () => {
    const partidas = Array.from({ length: 20 }, (_, i) => ({
      concepto:        `Concepto ${i + 1}`,
      cantidad:        1,
      precio_unitario: 100,
    }))
    const { partidas: withImporte, totales } = calcularTotales(partidas, 0.16)
    expect(withImporte).toHaveLength(20)
    expect(totales.subtotal).toBe(2000)
    expect(totales.total).toBe(2320)
  })
})

describe('formatCurrency', () => {
  it('formatea en MXN', () => {
    const result = formatCurrency(1234.56)
    expect(result).toMatch(/1[,.]234/)
    expect(result).toContain('56')
  })

  it('formatea cero', () => {
    expect(formatCurrency(0)).toMatch(/0\.00|0,00/)
  })
})
