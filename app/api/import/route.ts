import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { parseExcelSolicitudes, agruparSolicitudes } from '@/lib/excel/parse'
import { normalizeForCatalog } from '@/lib/utils/safeSlug'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file             = formData.get('file') as File | null
    const empresaIdFallback= formData.get('empresa_emisora_id') as string | null

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const db = getAdminClient()

    // Leer buffer del archivo
    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    // Subir a storage (registro histórico)
    const timestamp  = Date.now()
    const storePath  = `imports/${timestamp}_${file.name.replace(/\s+/g, '_')}`
    await db.storage.from('imports').upload(storePath, buffer, { contentType: file.type || 'application/octet-stream' })

    // Parsear Excel
    const { rows, errors: parseErrors } = parseExcelSolicitudes(buffer)

    if (rows.length === 0) {
      return NextResponse.json({
        created:  0,
        skipped:  0,
        errors:   parseErrors,
        message:  'No se encontraron filas válidas en el archivo',
      })
    }

    // Agrupar por (empresa_emisora, folio)
    const solicitudes = agruparSolicitudes(rows)

    // Recolectar nombres únicos de empresas que vienen del Excel
    const nombresEmpresa = Array.from(
      new Set(solicitudes.map(s => s.empresa_emisora).filter(Boolean))
    )

    // Construir mapa nombre_comercial → id
    const empresaIdMap: Record<string, string> = {}

    if (nombresEmpresa.length > 0) {
      const { data: empresasDB } = await db
        .from('empresas')
        .select('id, nombre_comercial')
        .in('nombre_comercial', nombresEmpresa)

      if (empresasDB) {
        for (const e of empresasDB) {
          empresaIdMap[e.nombre_comercial] = e.id
        }
      }
    }

    // Verificar fallback si se proporcionó empresa_emisora_id
    if (empresaIdFallback) {
      const { data: empresaFallback } = await db
        .from('empresas')
        .select('id')
        .eq('id', empresaIdFallback)
        .single()
      if (!empresaFallback) {
        return NextResponse.json({ error: 'empresa_emisora_id de fallback no encontrada' }, { status: 404 })
      }
    }

    const results: { folio: string; empresa: string; status: 'created' | 'skipped' | 'error'; reason?: string }[] = []

    for (const sol of solicitudes) {
      // Resolver empresa: columna del Excel primero, luego fallback del form
      const empresaId = (sol.empresa_emisora && empresaIdMap[sol.empresa_emisora])
        ? empresaIdMap[sol.empresa_emisora]
        : (empresaIdFallback ?? null)

      if (!empresaId) {
        results.push({
          folio:   sol.folio_factura,
          empresa: sol.empresa_emisora || '(sin empresa)',
          status:  'error',
          reason:  sol.empresa_emisora
            ? `Empresa "${sol.empresa_emisora}" no encontrada en el catálogo`
            : 'No se proporcionó empresa_emisora en el Excel ni como parámetro del form',
        })
        continue
      }

      try {
        // Upsert cliente
        const clienteNorm = normalizeForCatalog(sol.cliente)
        const { data: clienteRow } = await db
          .from('clientes')
          .upsert({ nombre: sol.cliente, nombre_normalizado: clienteNorm }, { onConflict: 'nombre_normalizado' })
          .select('id')
          .single()

        const clienteId = clienteRow?.id

        // Upsert proveedores únicos de esta solicitud
        const proveedoresUnicos = Array.from(new Set(
          sol.partidas
            .filter(p => p.proveedor && p.proveedor_normalizado !== '')
            .map(p => JSON.stringify({ nombre: p.proveedor, norm: p.proveedor_normalizado }))
        )).map(s => JSON.parse(s) as { nombre: string; norm: string })

        const proveedorIdMap: Record<string, string> = {}

        for (const prov of proveedoresUnicos) {
          const { data: provRow } = await db
            .from('proveedores')
            .upsert({ nombre: prov.nombre, nombre_normalizado: prov.norm }, { onConflict: 'nombre_normalizado' })
            .select('id')
            .single()
          if (provRow) proveedorIdMap[prov.norm] = provRow.id
        }

        // Verificar si (empresa_emisora_id, folio_factura) ya existe
        const { data: existing } = await db
          .from('solicitudes_factura')
          .select('id')
          .eq('folio_factura', sol.folio_factura)
          .eq('empresa_emisora_id', empresaId)
          .maybeSingle()

        if (existing) {
          results.push({ folio: sol.folio_factura, empresa: sol.empresa_emisora, status: 'skipped', reason: 'Folio ya existe para esta empresa' })
          continue
        }

        // Insertar solicitud
        const { data: nuevaSol, error: solError } = await db
          .from('solicitudes_factura')
          .insert({
            folio_factura:       sol.folio_factura,
            fecha_solicitud:     sol.fecha_solicitud,
            cliente_id:          clienteId ?? null,
            cliente_nombre:      sol.cliente,
            empresa_emisora_id:  empresaId,
            iva_tasa:            sol.iva_tasa,
            source_file_path:    storePath,
          })
          .select('id')
          .single()

        if (solError || !nuevaSol) {
          results.push({ folio: sol.folio_factura, empresa: sol.empresa_emisora, status: 'error', reason: solError?.message ?? 'Error insertando solicitud' })
          continue
        }

        // Insertar partidas
        const partidas = sol.partidas.map((p, i) => ({
          solicitud_id:     nuevaSol.id,
          proveedor_id:     p.proveedor_normalizado ? (proveedorIdMap[p.proveedor_normalizado] ?? null) : null,
          proveedor_nombre: p.proveedor || null,
          concepto:         p.concepto,
          cantidad:         p.cantidad,
          precio_unitario:  p.precio_unitario,
          orden:            i,
        }))

        const { error: partidasError } = await db.from('solicitud_partidas').insert(partidas)
        if (partidasError) {
          results.push({ folio: sol.folio_factura, empresa: sol.empresa_emisora, status: 'error', reason: partidasError.message })
          // Rollback manual de la solicitud
          await db.from('solicitudes_factura').delete().eq('id', nuevaSol.id)
          continue
        }

        results.push({ folio: sol.folio_factura, empresa: sol.empresa_emisora, status: 'created' })
      } catch (err) {
        results.push({ folio: sol.folio_factura, empresa: sol.empresa_emisora, status: 'error', reason: String(err) })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed  = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      created,
      skipped,
      failed,
      results,
      parseErrors,
      message: `Importación completada: ${created} creadas, ${skipped} omitidas, ${failed} errores`,
    })
  } catch (err) {
    console.error('[import]', err)
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
