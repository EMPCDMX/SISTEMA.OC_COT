import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cliente  = searchParams.get('cliente')
  const estatus  = searchParams.get('estatus')
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('page_size') ?? '50')
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  const db = getAdminClient()

  let q = db
    .from('solicitudes_factura')
    .select(`
      *,
      empresas!empresa_emisora_id ( nombre_comercial )
    `, { count: 'exact' })
    .order('fecha_solicitud', { ascending: false })
    .range(from, to)

  if (cliente) q = q.ilike('cliente_nombre', `%${cliente}%`)
  if (estatus) q = q.eq('estatus', estatus)

  const { data, error, count } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, pageSize })
}
