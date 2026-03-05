'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/totales'

type Partida = {
  id: string; concepto: string; cantidad: number; precio_unitario: number; proveedor_nombre: string | null; orden: number
  proveedores?: { nombre: string } | null
}
type Documento = {
  id: string; tipo: string; folio_visible: string; fecha_documento: string; total: number; subtotal: number; iva: number; pdf_path: string; version: number
  proveedores?: { nombre: string } | null
}
type Solicitud = {
  id: string; folio_factura: string; fecha_solicitud: string; cliente_nombre: string; estatus: string; iva_tasa: number; moneda: string
  empresas?: { nombre_comercial: string; razon_social: string; rfc: string } | null
}

export default function SolicitudDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [sol, setSol]         = useState<Solicitud | null>(null)
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [docs, setDocs]       = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg]         = useState('')
  const [flags, setFlags]     = useState({ cot: true, oc: true })

  const load = async () => {
    setLoading(true)
    const res  = await fetch(`/api/solicitudes/${id}`)
    const json = await res.json()
    setSol(json.solicitud)
    setPartidas(json.partidas ?? [])
    setDocs(json.documentos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleGenerate = async () => {
    setGenerating(true)
    setMsg('')
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: id, flags }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg(json.message)
      load()
    } catch (err) {
      setMsg(`Error: ${String(err)}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleExportZip = async () => {
    setMsg('')
    const res = await fetch(`/api/export-zip?solicitud_ids=${id}`)
    if (!res.ok) {
      const json = await res.json()
      setMsg(`Error: ${json.error}`)
      return
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `COT_OC_${sol?.folio_factura ?? id}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = async (pdfPath: string, filename: string) => {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(pdfPath, 60)
    if (error || !data) { setMsg(`Error al generar URL: ${error?.message}`); return }
    const a = document.createElement('a')
    a.href     = data.signedUrl
    a.download = filename
    a.target   = '_blank'
    a.click()
  }

  if (loading) return <p className="text-gray-400 p-8">Cargando...</p>
  if (!sol)    return <p className="text-red-600 p-8">Solicitud no encontrada.</p>

  const importe = partidas.reduce((acc, p) => acc + p.cantidad * p.precio_unitario, 0)
  const iva     = importe * sol.iva_tasa
  const total   = importe + iva

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-secondary text-xs" onClick={() => router.back()}>← Volver</button>
        <h1 className="text-2xl font-bold">Solicitud {sol.folio_factura}</h1>
        <span className={`badge ${sol.estatus === 'generada' ? 'badge-green' : 'badge-yellow'}`}>{sol.estatus}</span>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded text-sm border ${msg.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {msg}
        </div>
      )}

      {/* Cabecera */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Folio', value: sol.folio_factura },
          { label: 'Fecha solicitud', value: sol.fecha_solicitud },
          { label: 'Cliente', value: sol.cliente_nombre },
          { label: 'Empresa emisora', value: sol.empresas?.nombre_comercial ?? '—' },
          { label: 'Moneda', value: sol.moneda },
          { label: 'IVA', value: `${(sol.iva_tasa * 100).toFixed(0)}%` },
          { label: 'Subtotal', value: formatCurrency(importe) },
          { label: 'Total (con IVA)', value: formatCurrency(total) },
        ].map(f => (
          <div key={f.label} className="card py-3 px-4">
            <p className="text-xs text-gray-500">{f.label}</p>
            <p className="font-semibold mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Partidas */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3">Partidas ({partidas.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Concepto</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Proveedor</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cantidad</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">P. Unitario</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Importe</th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p, i) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2">{p.concepto}</td>
                  <td className="px-3 py-2 text-gray-500">{p.proveedores?.nombre ?? p.proveedor_nombre ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{p.cantidad}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(p.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.cantidad * p.precio_unitario)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(importe)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">IVA ({(sol.iva_tasa * 100).toFixed(0)}%)</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(iva)}</td>
              </tr>
              <tr className="bg-indigo-50">
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-bold text-indigo-700">TOTAL</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-indigo-700">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Generar */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3">Generar documentos</h2>
        <div className="flex items-center gap-6 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.cot} onChange={e => setFlags(f => ({ ...f, cot: e.target.checked }))} />
            Generar COT (Cotización)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.oc} onChange={e => setFlags(f => ({ ...f, oc: e.target.checked }))} />
            Generar OC (Órdenes de Compra)
          </label>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={handleGenerate} disabled={generating || (!flags.cot && !flags.oc)}>
            {generating ? 'Generando PDFs...' : 'Generar'}
          </button>
          {docs.length > 0 && (
            <button className="btn-success" onClick={handleExportZip}>
              Descargar ZIP
            </button>
          )}
        </div>
      </div>

      {/* Documentos generados */}
      {docs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3">Documentos generados ({docs.length})</h2>
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <span className={`badge mr-2 ${d.tipo === 'COT' ? 'badge-blue' : 'badge-green'}`}>{d.tipo}</span>
                  <span className="font-medium text-sm">{d.folio_visible}</span>
                  {d.proveedores?.nombre && (
                    <span className="text-xs text-gray-500 ml-2">· {d.proveedores.nombre}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-gray-500">
                    <div>{d.fecha_documento}</div>
                    <div className="font-semibold text-gray-700">{formatCurrency(d.total)}</div>
                  </div>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => handleDownloadPdf(d.pdf_path, `${d.folio_visible}_v${d.version}.pdf`)}
                  >
                    Descargar PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
