import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { buildCotPath, buildOcPath, buildZipBuffer } from '@/lib/zip/exportZip'
import type { ZipEntry } from '@/lib/zip/exportZip'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ids = searchParams.get('solicitud_ids')?.split(',').filter(Boolean) ?? []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'solicitud_ids requerido' }, { status: 400 })
  }

  const db = getAdminClient()

  const entries: ZipEntry[] = []
  const errores: string[]    = []

  for (const solId of ids) {
    // Cargar solicitud
    const { data: sol } = await db
      .from('solicitudes_factura')
      .select(`
        folio_factura, cliente_nombre,
        empresas!empresa_emisora_id ( nombre_comercial )
      `)
      .eq('id', solId)
      .single()

    if (!sol) {
      errores.push(`Solicitud ${solId} no encontrada`)
      continue
    }

    const empresa = (sol as any).empresas?.nombre_comercial ?? 'EMPRESA'

    // Cargar documentos generados
    const { data: docs } = await db
      .from('documentos_generados')
      .select('*, proveedores(nombre)')
      .eq('solicitud_id', solId)

    if (!docs || docs.length === 0) {
      errores.push(`Sin documentos generados para folio ${sol.folio_factura}`)
      continue
    }

    for (const doc of docs as any[]) {
      // Descargar PDF de storage
      const { data: pdfBlob, error: dlErr } = await db.storage
        .from('documents')
        .download(doc.pdf_path)

      if (dlErr || !pdfBlob) {
        errores.push(`No se pudo descargar PDF ${doc.pdf_path}: ${dlErr?.message ?? 'blob null'}`)
        continue
      }

      const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

      let zipPath: string

      if (doc.tipo === 'COT') {
        zipPath = buildCotPath({
          cliente: sol.cliente_nombre,
          folio:   sol.folio_factura,
          empresa,
        })
      } else {
        const provNombre = doc.proveedores?.nombre ?? 'PROVEEDOR'
        zipPath = buildOcPath({
          cliente:   sol.cliente_nombre,
          proveedor: provNombre,
          folio:     sol.folio_factura,
          empresa,
        })
      }

      entries.push({ content: pdfBuffer, zipPath })
    }
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'No se encontraron PDFs para exportar', errores },
      { status: 404 },
    )
  }

  const zipBuffer = await buildZipBuffer(entries)

  const foliosStr = ids.length === 1
    ? (await db.from('solicitudes_factura').select('folio_factura').eq('id', ids[0]).single()).data?.folio_factura ?? ids[0]
    : `${ids.length}_solicitudes`

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="COT_OC_${foliosStr}_${Date.now()}.zip"`,
      'Content-Length':      String(zipBuffer.length),
    },
  })
}
