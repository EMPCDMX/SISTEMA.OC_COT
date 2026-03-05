'use client'
import { useEffect, useState, useRef } from 'react'
import type { Empresa } from '@/lib/supabase'

export default function EmpresasPage() {
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<Empresa | null>(null)
  const [msg, setMsg]               = useState('')

  const fetchEmpresas = async () => {
    setLoading(true)
    const res = await fetch('/api/empresas')
    const data = await res.json()
    setEmpresas(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchEmpresas() }, [])

  const handleSaved = () => {
    setShowForm(false)
    setEditTarget(null)
    fetchEmpresas()
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('¿Desactivar esta empresa?')) return
    await fetch(`/api/empresas/${id}`, { method: 'DELETE' })
    fetchEmpresas()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Empresas Emisoras</h1>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setShowForm(true) }}>
          + Nueva empresa
        </button>
      </div>

      {msg && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">{msg}</div>}

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : empresas.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p>No hay empresas configuradas.</p>
          <button className="btn-primary mt-3" onClick={() => setShowForm(true)}>Crear primera empresa</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {empresas.map(e => (
            <EmpresaCard
              key={e.id}
              empresa={e}
              onEdit={() => { setEditTarget(e); setShowForm(true) }}
              onDeactivate={() => handleDeactivate(e.id)}
              onLogoUploaded={fetchEmpresas}
              setMsg={setMsg}
            />
          ))}
        </div>
      )}

      {showForm && (
        <EmpresaModal
          initial={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ── Card de empresa ────────────────────────────────────────────────────────

function EmpresaCard({
  empresa, onEdit, onDeactivate, onLogoUploaded, setMsg,
}: {
  empresa: Empresa
  onEdit: () => void
  onDeactivate: () => void
  onLogoUploaded: () => void
  setMsg: (m: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const branding = (empresa as any).empresa_branding
  const bancaria = (empresa as any).empresa_bancaria
  const theme    = branding?.theme_json

  const logoUrl = branding?.logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/${branding.logo_path}?t=${Date.now()}`
    : null

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch(`/api/empresas/${empresa.id}`, { method: 'PATCH', body: fd })
    const json = await res.json()
    setUploading(false)
    if (res.ok) {
      setMsg('Logo actualizado y colores extraídos automáticamente.')
      onLogoUploaded()
    } else {
      setMsg(`Error: ${json.error}`)
    }
    e.target.value = ''
  }

  return (
    <div className={`card border-2 ${empresa.activa ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="w-14 h-14 object-contain rounded border border-gray-200 bg-white p-1" />
        ) : (
          <div className="w-14 h-14 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center">
            Sin logo
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{empresa.nombre_comercial}</h3>
            <span className={empresa.activa ? 'badge-green' : 'badge-gray'}>
              {empresa.activa ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">RFC: {empresa.rfc}</p>
          <p className="text-xs text-gray-400 truncate">{empresa.direccion_fiscal}</p>
        </div>
      </div>

      {/* Paleta de colores */}
      {theme && theme.primary && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Tema:</span>
          {[theme.primary, theme.secondary, theme.accent].filter(Boolean).map((c: string, i: number) => (
            <span key={i} title={c} className="w-5 h-5 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}

      {/* Banco */}
      {bancaria?.banco && (
        <p className="mt-2 text-xs text-gray-500">Banco: {bancaria.banco} — CLABE: {bancaria.clabe}</p>
      )}

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-secondary text-xs" onClick={onEdit}>Editar datos</button>
        <button
          className="btn-secondary text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Subiendo...' : 'Subir logo'}
        </button>
        {empresa.activa && (
          <button className="btn-danger text-xs" onClick={onDeactivate}>Desactivar</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
      </div>
    </div>
  )
}

// ── Modal crear/editar empresa ─────────────────────────────────────────────

function EmpresaModal({
  initial, onClose, onSaved,
}: {
  initial: Empresa | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm]     = useState({
    nombre_comercial: initial?.nombre_comercial ?? '',
    razon_social:     initial?.razon_social ?? '',
    rfc:              initial?.rfc ?? '',
    direccion_fiscal: initial?.direccion_fiscal ?? '',
    banco:       (initial as any)?.empresa_bancaria?.banco ?? '',
    cuenta:      (initial as any)?.empresa_bancaria?.cuenta ?? '',
    clabe:       (initial as any)?.empresa_bancaria?.clabe ?? '',
    beneficiario:(initial as any)?.empresa_bancaria?.beneficiario ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      nombre_comercial: form.nombre_comercial,
      razon_social:     form.razon_social,
      rfc:              form.rfc,
      direccion_fiscal: form.direccion_fiscal,
      banco:            form.banco,
      cuenta:           form.cuenta,
      clabe:            form.clabe,
      beneficiario:     form.beneficiario,
    }

    const res = initial
      ? await fetch(`/api/empresas/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/empresas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error ?? 'Error guardando')
      return
    }
    onSaved()
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{initial ? 'Editar empresa' : 'Nueva empresa'}</h2>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre comercial *</label>
                <input className="input" value={form.nombre_comercial} onChange={f('nombre_comercial')} required />
              </div>
              <div>
                <label className="label">Razón social *</label>
                <input className="input" value={form.razon_social} onChange={f('razon_social')} required />
              </div>
              <div>
                <label className="label">RFC *</label>
                <input className="input" value={form.rfc} onChange={f('rfc')} required />
              </div>
              <div>
                <label className="label">Banco</label>
                <input className="input" value={form.banco} onChange={f('banco')} />
              </div>
            </div>

            <div>
              <label className="label">Dirección fiscal *</label>
              <textarea className="input resize-none" rows={2} value={form.direccion_fiscal} onChange={f('direccion_fiscal')} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Cuenta bancaria</label>
                <input className="input" value={form.cuenta} onChange={f('cuenta')} />
              </div>
              <div>
                <label className="label">CLABE interbancaria</label>
                <input className="input" value={form.clabe} onChange={f('clabe')} maxLength={18} />
              </div>
              <div className="col-span-2">
                <label className="label">Beneficiario</label>
                <input className="input" value={form.beneficiario} onChange={f('beneficiario')} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
