import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getAdminClient()

  const [{ data: sol, error: solErr }, { data: partidas }, { data: docs }] = await Promise.all([
    db.from('solicitudes_factura')
      .select(`*, empresas!empresa_emisora_id ( nombre_comercial, razon_social, rfc )`)
      .eq('id', id)
      .single(),
    db.from('solicitud_partidas')
      .select('*, proveedores(nombre)')
      .eq('solicitud_id', id)
      .order('orden'),
    db.from('documentos_generados')
      .select('*, proveedores(nombre)')
      .eq('solicitud_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (solErr || !sol) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  return NextResponse.json({ solicitud: sol, partidas: partidas ?? [], documentos: docs ?? [] })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getAdminClient()

  const { error } = await db.from('solicitudes_factura').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
