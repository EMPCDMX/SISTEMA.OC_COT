import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) return false
  return req.headers.get('x-admin-token') === adminToken
}

/**
 * DELETE /api/admin/delete-import-batch
 * Body: { import_job_id: string }
 *
 * Elimina todo lo creado en un lote de importación:
 *   - PDFs en bucket "documents" de todas las solicitudes del lote
 *   - documentos_generados (FK cascade)
 *   - solicitud_partidas   (FK cascade)
 *   - solicitudes_factura  del lote
 *   - Archivo de import en bucket "imports" (source_file_path)
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json() as { import_job_id?: string }

  if (!body.import_job_id) {
    return NextResponse.json({ error: 'import_job_id requerido' }, { status: 400 })
  }

  const db = getAdminClient()

  // Cargar todas las solicitudes del lote
  const { data: solicitudes } = await db
    .from('solicitudes_factura')
    .select('id, source_file_path')
    .eq('import_job_id', body.import_job_id)

  if (!solicitudes || solicitudes.length === 0) {
    return NextResponse.json(
      { error: `No se encontraron solicitudes con import_job_id "${body.import_job_id}"` },
      { status: 404 },
    )
  }

  const solicitudIds  = solicitudes.map(s => s.id)
  const sourceFilePath = solicitudes[0].source_file_path  // todas comparten el mismo archivo

  // Recolectar todos los pdf_paths del lote
  const { data: docs } = await db
    .from('documentos_generados')
    .select('pdf_path')
    .in('solicitud_id', solicitudIds)

  const pdfPaths = (docs ?? []).map(d => d.pdf_path).filter(Boolean)

  // Borrar PDFs en storage
  let pdfFilesDeleted = 0
  if (pdfPaths.length > 0) {
    const { data: removed } = await db.storage.from('documents').remove(pdfPaths)
    pdfFilesDeleted = removed?.length ?? 0
  }

  // Borrar archivo de import original
  let importFileDeleted = false
  if (sourceFilePath) {
    const { error: rmErr } = await db.storage.from('imports').remove([sourceFilePath])
    importFileDeleted = !rmErr
  }

  // Borrar solicitudes (cascade elimina partidas y documentos_generados)
  const { error } = await db
    .from('solicitudes_factura')
    .delete()
    .eq('import_job_id', body.import_job_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deleted: {
      solicitudes:       solicitudIds.length,
      docs:              pdfPaths.length,
      pdfFilesDeleted,
      importFileDeleted,
    },
  })
}
