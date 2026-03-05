'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Solicitud = {
  id:               string
  folio_factura:    string
  fecha_solicitud:  string
  cliente_nombre:   string
  estatus:          string
  empresas?:        { nombre_comercial: string } | null
}

const ESTATUS_BADGE: Record<string, string> = {
  importada: 'badge-yellow',
  generada:  'badge-green',
  error:     'badge-red',
}

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [estatus, setEstatus]         = useState('')
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [generating, setGenerating]   = useState<string | null>(null)
  const [exporting, setExporting]     = useState(false)
  const [msg, setMsg]                 = useState('')

  const PAGE_SIZE = 25

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page:       String(page),
      page_size:  String(PAGE_SIZE),
      ...(search  ? { cliente: search } : {}),
      ...(estatus ? { estatus }         : {}),
    })
    const res = await fetch(`/api/solicitudes?${params}`)
    const json = await res.json()
    setSolicitudes(json.data ?? [])
    setTotal(json.count ?? 0)
    setLoading(false)
  }, [page, search, estatus])

  useEffect(() => { fetchSolicitudes() }, [fetchSolicitudes])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === solicitudes.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(solicitudes.map(s => s.id)))
    }
  }

  const handleGenerate = async (id: string) => {
    setGenerating(id)
    setMsg('')
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: id, flags: { cot: true, oc: true } }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg(json.message)
      fetchSolicitudes()
    } catch (err) {
      setMsg(`Error: ${String(err)}`)
    } finally {
      setGenerating(null)
    }
  }

  const handleExportZip = async () => {
    if (selected.size === 0) return
    setExporting(true)
    const ids = Array.from(selected).join(',')
    const res = await fetch(`/api/export-zip?solicitud_ids=${ids}`)
    if (!res.ok) {
      const json = await res.json()
      setMsg(`Error ZIP: ${json.error}`)
      setExporting(false)
      return
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `COT_OC_export_${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Solicitudes de Factura</h1>
        {selected.size > 0 && (
          <button
            className="btn-success"
            onClick={handleExportZip}
            disabled={exporting}
          >
            {exporting ? 'Generando ZIP...' : `Exportar ZIP (${selected.size})`}
          </button>
        )}
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded text-sm border ${msg.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {msg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          className="input max-w-xs"
          placeholder="Buscar por cliente..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="input w-40"
          value={estatus}
          onChange={e => { setEstatus(e.target.value); setPage(1) }}
        >
          <option value="">Todos</option>
          <option value="importada">Importada</option>
          <option value="generada">Generada</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input type="checkbox" checked={selected.size === solicitudes.length && solicitudes.length > 0} onChange={selectAll} />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Folio</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha solicitud</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Empresa emisora</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Estatus</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : solicitudes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin solicitudes</td></tr>
            ) : solicitudes.map(s => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                </td>
                <td className="px-4 py-3 font-mono font-medium">{s.folio_factura}</td>
                <td className="px-4 py-3 text-gray-600">{s.fecha_solicitud}</td>
                <td className="px-4 py-3">{s.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-500">{s.empresas?.nombre_comercial ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={ESTATUS_BADGE[s.estatus] ?? 'badge-gray'}>{s.estatus}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/solicitudes/${s.id}`} className="btn-secondary text-xs">Ver</Link>
                    <button
                      className="btn-primary text-xs"
                      disabled={generating === s.id}
                      onClick={() => handleGenerate(s.id)}
                    >
                      {generating === s.id ? '...' : 'Generar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>{total} solicitudes · página {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
            <button className="btn-secondary text-xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  )
}
