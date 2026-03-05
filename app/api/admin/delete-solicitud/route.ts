import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) return false
  return req.headers.get('x-admin-token') === adminToken
}

/**
 * DELETE /api/admin/delete-solicitud
 * Body: { solicitud_id: string } | { folio_factura: string }
 *
 * Elimina en cascada:
 *   - solicitud_partidas  (FK cascade desde solicitudes_factura)
 *   - documentos_generados (FK cascade)
 *   - PDFs en bucket "documents"
 *   - solicitudes_factura
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json() as { solicitud_id?: string; folio_factura?: string }

  if (!body.solicitud_id && !body.folio_factura) {
    return NextResponse.json(
      { error: 'Se requiere solicitud_id o folio_factura' },
      { status: 400 },
    )
  }

  const db = getAdminClient()

  // Resolver solicitud_id
  let solicitudId = body.solicitud_id ?? null

  if (!solicitudId && body.folio_factura) {
    const { data } = await db
      .from('solicitudes_factura')
      .select('id')
      .eq('folio_factura', body.folio_factura)
      .maybeSingle()

    if (!data) {
      return NextResponse.json(
        { error: `Folio "${body.folio_factura}" no encontrado` },
        { status: 404 },
      )
    }
    solicitudId = data.id
  }

  return deleteSolicitud(db, solicitudId!)
}

export async function deleteSolicitud(db: ReturnType<typeof getAdminClient>, solicitudId: string) {
  // Recolectar pdf_paths antes de borrar
  const { data: docs } = await db
    .from('documentos_generados')
    .select('pdf_path')
    .eq('solicitud_id', solicitudId)

  const pdfPaths = (docs ?? []).map(d => d.pdf_path).filter(Boolean)

  // Borrar PDFs en storage
  let filesDeleted = 0
  if (pdfPaths.length > 0) {
    const { data: removed } = await db.storage.from('documents').remove(pdfPaths)
    filesDeleted = removed?.length ?? 0
  }

  // Borrar solicitud (cascade elimina partidas y documentos_generados)
  const { error } = await db
    .from('solicitudes_factura')
    .delete()
    .eq('id', solicitudId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deleted: {
      solicitud:    true,
      docs:         pdfPaths.length,
      filesDeleted,
    },
  })
}
