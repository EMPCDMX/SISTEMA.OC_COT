import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { buildHtml, renderPdfFromHtml } from '@/lib/pdf/render'
import { calcularTotales } from '@/lib/utils/totales'
import { calcCotDate, parseLocalDate } from '@/lib/dates/businessDays'
import { extractFolioNumber } from '@/lib/utils/safeSlug'
import { FALLBACK_THEME } from '@/lib/branding/extractTheme'
import type { ThemeTokens } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { solicitud_id, flags = { cot: true, oc: true } } = await req.json() as {
      solicitud_id: string
      flags?: { cot?: boolean; oc?: boolean }
    }

    if (!solicitud_id) return NextResponse.json({ error: 'solicitud_id requerido' }, { status: 400 })

    const db = getAdminClient()

    // Cargar solicitud completa
    const { data: sol, error: solErr } = await db
      .from('solicitudes_factura')
      .select(`
        *,
        empresas!empresa_emisora_id (
          id, razon_social, rfc, direccion_fiscal, nombre_comercial,
          empresa_branding ( logo_path, theme_json ),
          empresa_bancaria ( banco, cuenta, clabe, beneficiario )
        )
      `)
      .eq('id', solicitud_id)
      .single()

    if (solErr || !sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

    // Cargar partidas
    const { data: partidas } = await db
      .from('solicitud_partidas')
      .select('*')
      .eq('solicitud_id', solicitud_id)
      .order('orden')

    if (!partidas || partidas.length === 0) {
      return NextResponse.json({ error: 'La solicitud no tiene partidas' }, { status: 400 })
    }

    const empresa    = (sol as any).empresas
    const branding   = empresa?.empresa_branding
    const bancaria   = empresa?.empresa_bancaria
    const theme: ThemeTokens = branding?.theme_json ?? FALLBACK_THEME

    // Obtener logo como data URL
    let logoDataUrl: string | undefined
    if (branding?.logo_path) {
      const { data: logoData } = await db.storage.from('logos').download(branding.logo_path)
      if (logoData) {
        const logoBuffer = Buffer.from(await logoData.arrayBuffer())
        const ext = branding.logo_path.split('.').pop()?.toLowerCase() ?? 'png'
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
        logoDataUrl = `data:${mime};base64,${logoBuffer.toString('base64')}`
      }
    }

    // Cargar días inhábiles
    const { data: diasRows } = await db
      .from('dias_inhabiles')
      .select('fecha')
      .eq('activo', true)
      .eq('pais', 'MX')

    const holidays = new Set<string>((diasRows ?? []).map((r: any) => r.fecha as string))

    const generados: string[] = []

    // ── Generar COT ──────────────────────────────────────────────────
    if (flags.cot !== false) {
      const fechaSolicitud = parseLocalDate(sol.fecha_solicitud)
      const fechaCot       = calcCotDate(fechaSolicitud, holidays)
      const numInterno     = extractFolioNumber(sol.folio_factura)
      const folioVisible   = `COT-${sol.folio_factura}`

      const { partidas: conImporte, totales } = calcularTotales(
        partidas.map((p: any) => ({
          concepto:        p.concepto,
          cantidad:        p.cantidad,
          precio_unitario: p.precio_unitario,
        })),
        sol.iva_tasa,
      )

      const condiciones = [
        'Precios en Pesos Mexicanos (MXN) más IVA.',
        'Vigencia de cotización: 15 días hábiles a partir de la fecha de emisión.',
        'Forma de pago: Transferencia bancaria.',
        'Los tiempos de entrega se confirmarán al momento de formalizar el pedido.',
        'Precios sujetos a cambio sin previo aviso después de la fecha de vigencia.',
      ].join('\n')

      const html = buildHtml({
        tipo: 'COT',
        empresa: {
          razon_social:     empresa.razon_social,
          rfc:              empresa.rfc,
          direccion_fiscal: empresa.direccion_fiscal,
        },
        branding: { logoDataUrl, theme },
        documento: {
          folio_visible:   folioVisible,
          numero_interno:  numInterno,
          fecha_documento: fechaCot,
          cliente:         sol.cliente_nombre,
          moneda:          sol.moneda ?? 'MXN',
        },
        partidas:    conImporte,
        totales:     { ...totales, ivaTasa: sol.iva_tasa },
        condiciones,
      })

      const pdfBuffer = await renderPdfFromHtml(html)
      const pdfPath   = `${solicitud_id}/COT_${sol.folio_factura}.pdf`

      await db.storage.from('documents').upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

      await db.from('documentos_generados').upsert({
        solicitud_id:    solicitud_id,
        tipo:            'COT',
        folio_visible:   folioVisible,
        numero_interno:  numInterno,
        fecha_documento: fechaCot.toISOString().slice(0, 10),
        subtotal:        totales.subtotal,
        iva:             totales.iva,
        total:           totales.total,
        pdf_path:        pdfPath,
      }, { onConflict: 'solicitud_id,tipo,proveedor_id' })

      generados.push(pdfPath)
    }

    // ── Generar OC(s) por proveedor ──────────────────────────────────
    if (flags.oc !== false) {
      const fechaOC = parseLocalDate(sol.fecha_solicitud)

      // Agrupar partidas por proveedor
      const byProveedor = new Map<string, typeof partidas>()
      for (const p of partidas as any[]) {
        if (!p.proveedor_id) continue
        const key = p.proveedor_id
        if (!byProveedor.has(key)) byProveedor.set(key, [])
        byProveedor.get(key)!.push(p)
      }

      for (const [proveedorId, provPartidas] of Array.from(byProveedor.entries())) {
        const provNombre = (provPartidas[0] as any).proveedor_nombre ?? 'PROVEEDOR'

        const { partidas: conImporte, totales } = calcularTotales(
          provPartidas.map((p: any) => ({
            concepto:        p.concepto,
            cantidad:        p.cantidad,
            precio_unitario: p.precio_unitario,
          })),
          sol.iva_tasa,
        )

        const folioVisible = `OC-${sol.folio_factura}`

        const html = buildHtml({
          tipo: 'OC',
          empresa: {
            razon_social:     empresa.razon_social,
            rfc:              empresa.rfc,
            direccion_fiscal: empresa.direccion_fiscal,
          },
          branding: { logoDataUrl, theme },
          documento: {
            folio_visible:   folioVisible,
            fecha_documento: fechaOC,
            cliente:         sol.cliente_nombre,
            proveedor:       provNombre,
            moneda:          sol.moneda ?? 'MXN',
          },
          partidas:    conImporte,
          totales:     { ...totales, ivaTasa: sol.iva_tasa },
          banco:       bancaria ?? null,
        })

        const pdfBuffer = await renderPdfFromHtml(html)
        const pdfPath   = `${solicitud_id}/OC_${sol.folio_factura}_${proveedorId}.pdf`

        await db.storage.from('documents').upload(pdfPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

        await db.from('documentos_generados').upsert({
          solicitud_id:    solicitud_id,
          tipo:            'OC',
          proveedor_id:    proveedorId,
          folio_visible:   folioVisible,
          fecha_documento: fechaOC.toISOString().slice(0, 10),
          subtotal:        totales.subtotal,
          iva:             totales.iva,
          total:           totales.total,
          pdf_path:        pdfPath,
        }, { onConflict: 'solicitud_id,tipo,proveedor_id' })

        generados.push(pdfPath)
      }
    }

    // Actualizar estatus
    await db.from('solicitudes_factura').update({ estatus: 'generada' }).eq('id', solicitud_id)

    return NextResponse.json({
      ok:       true,
      generados,
      message:  `${generados.length} documentos generados`,
    })
  } catch (err) {
    console.error('[generate]', err)
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
