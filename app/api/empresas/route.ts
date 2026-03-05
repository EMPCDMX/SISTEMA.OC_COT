import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const db = getAdminClient()
  const { data, error } = await db
    .from('empresas')
    .select(`
      *,
      empresa_branding ( logo_path, theme_json, theme_source, updated_at ),
      empresa_bancaria ( banco, cuenta, clabe, beneficiario )
    `)
    .order('nombre_comercial')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const db = getAdminClient()
  const body = await req.json()

  const { nombre_comercial, razon_social, rfc, direccion_fiscal } = body

  if (!nombre_comercial || !razon_social || !rfc || !direccion_fiscal) {
    return NextResponse.json({ error: 'Campos requeridos: nombre_comercial, razon_social, rfc, direccion_fiscal' }, { status: 400 })
  }

  const { data: empresa, error } = await db
    .from('empresas')
    .insert({ nombre_comercial, razon_social, rfc, direccion_fiscal })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Crear registros de branding y bancaria vacíos
  await db.from('empresa_branding').insert({ empresa_id: empresa.id, theme_json: {} })
  await db.from('empresa_bancaria').insert({ empresa_id: empresa.id })

  return NextResponse.json(empresa, { status: 201 })
}
