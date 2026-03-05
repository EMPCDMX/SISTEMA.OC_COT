import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { extractThemeFromBuffer, FALLBACK_THEME } from '@/lib/branding/extractTheme'

export const runtime = 'nodejs'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('empresas')
    .select(`
      *,
      empresa_branding ( logo_path, theme_json, theme_source, updated_at ),
      empresa_bancaria ( banco, cuenta, clabe, beneficiario )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getAdminClient()
  const contentType = req.headers.get('content-type') ?? ''

  // Actualización de datos generales (JSON)
  if (contentType.includes('application/json')) {
    const body = await req.json()
    const { banco, cuenta, clabe, beneficiario, ...empresaFields } = body

    if (Object.keys(empresaFields).length > 0) {
      const allowed = ['nombre_comercial', 'razon_social', 'rfc', 'direccion_fiscal', 'activa']
      const update: Record<string, unknown> = {}
      allowed.forEach(k => { if (empresaFields[k] !== undefined) update[k] = empresaFields[k] })

      if (Object.keys(update).length > 0) {
        const { error } = await db.from('empresas').update(update).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // Datos bancarios
    if (banco !== undefined || cuenta !== undefined || clabe !== undefined || beneficiario !== undefined) {
      const { error } = await db.from('empresa_bancaria').upsert({
        empresa_id: id,
        ...(banco       !== undefined && { banco }),
        ...(cuenta      !== undefined && { cuenta }),
        ...(clabe       !== undefined && { clabe }),
        ...(beneficiario!== undefined && { beneficiario }),
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  // Subida de logo (multipart)
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const logoFile = formData.get('logo') as File | null
    const themeOverride = formData.get('theme_json') as string | null

    if (!logoFile) return NextResponse.json({ error: 'Campo "logo" requerido' }, { status: 400 })

    const buffer   = Buffer.from(await logoFile.arrayBuffer())
    const ext      = logoFile.name.split('.').pop()?.toLowerCase() ?? 'png'
    const logoPath = `${id}/logo.${ext}`

    // Subir a storage
    const { error: upErr } = await db.storage
      .from('logos')
      .upload(logoPath, buffer, { contentType: logoFile.type || `image/${ext}`, upsert: true })

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // Extraer tema
    let theme = FALLBACK_THEME
    let source = 'auto_from_logo'

    if (themeOverride) {
      try {
        theme  = JSON.parse(themeOverride)
        source = 'manual'
      } catch { /* usar auto */ }
    } else {
      theme = await extractThemeFromBuffer(buffer)
    }

    // Guardar branding
    const { error: brandErr } = await db.from('empresa_branding').upsert({
      empresa_id:   id,
      logo_path:    logoPath,
      theme_json:   theme,
      theme_source: source,
      updated_at:   new Date().toISOString(),
    })

    if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, logo_path: logoPath, theme })
  }

  return NextResponse.json({ error: 'Content-Type no soportado' }, { status: 415 })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getAdminClient()

  const { error } = await db.from('empresas').update({ activa: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
