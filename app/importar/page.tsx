'use client'
import { useEffect, useState, useRef } from 'react'
import type { Empresa } from '@/lib/supabase'

type ImportResult = {
  created:      number
  skipped:      number
  failed:       number
  results:      { folio: string; status: string; reason?: string }[]
  parseErrors:  { row: number; folio?: string; field: string; message: string }[]
  message:      string
}

export default function ImportarPage() {
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [empresaId, setEmpresaId]   = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [error, setError]           = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/empresas')
      .then(r => r.json())
      .then(d => {
        const activas = (Array.isArray(d) ? d : []).filter((e: Empresa) => e.activa)
        setEmpresas(activas)
        if (activas.length === 1) setEmpresaId(activas[0].id)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !empresaId) return

    setLoading(true)
    setError('')
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('empresa_emisora_id', empresaId)

    try {
      const res  = await fetch('/api/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en importación')
      setResult(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Importar Excel</h1>

      <div className="card mb-6">
        <h2 className="font-semibold mb-3 text-gray-700">Instrucciones</h2>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Sube un archivo <strong>.xlsx</strong> o <strong>.xlsm</strong>.</li>
          <li>Columnas requeridas (por nombre, flexible): <code>Folio</code>, <code>Fecha</code>, <code>Cliente</code>, <code>Proveedor</code>, <code>Concepto</code>, <code>Cantidad</code>, <code>Precio unitario</code>.</li>
          <li>Puede haber múltiples filas por folio (multi-concepto).</li>
          <li>Los folios duplicados se omiten sin error.</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Empresa emisora *</label>
          {empresas.length === 0 ? (
            <p className="text-sm text-red-600">No hay empresas activas. <a href="/empresas" className="underline">Crear empresa</a></p>
          ) : (
            <select
              className="input"
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
              required
            >
              <option value="">Seleccionar empresa...</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre_comercial}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">Archivo Excel (.xlsx / .xlsm) *</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div>
                <p className="font-medium text-indigo-700">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">Haz clic para seleccionar o arrastra el archivo aquí</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx o .xlsm</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">{error}</div>
        )}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={loading || !file || !empresaId}>
            {loading ? 'Procesando...' : 'Importar'}
          </button>
        </div>
      </form>

      {/* Resultado */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="card border-2 border-green-200 bg-green-50">
            <p className="font-semibold text-green-800">{result.message}</p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="badge-green">✓ {result.created} creadas</span>
              <span className="badge-yellow">⊘ {result.skipped} omitidas</span>
              {result.failed > 0 && <span className="badge-red">✗ {result.failed} con error</span>}
            </div>
          </div>

          {result.parseErrors.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-amber-700 mb-3">Advertencias del archivo ({result.parseErrors.length})</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.parseErrors.map((e, i) => (
                  <div key={i} className="text-xs p-2 bg-amber-50 rounded border border-amber-200">
                    <span className="font-medium">Fila {e.row}</span>
                    {e.folio && <span> · {e.folio}</span>}
                    <span className="text-amber-600"> [{e.field}]</span>: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.results.filter(r => r.status === 'error').length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-red-700 mb-3">Errores de importación</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.results.filter(r => r.status === 'error').map((r, i) => (
                  <div key={i} className="text-xs p-2 bg-red-50 rounded border border-red-200">
                    <span className="font-medium">{r.folio}</span>: {r.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.created > 0 && (
            <div className="flex justify-end">
              <a href="/solicitudes" className="btn-primary">Ver solicitudes importadas →</a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
