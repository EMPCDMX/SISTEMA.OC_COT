import archiver from 'archiver'
import { PassThrough } from 'stream'
import { safeSlug } from '@/lib/utils/safeSlug'

export type ZipEntry = {
  content:  Buffer
  zipPath:  string   // ruta dentro del ZIP
}

/**
 * Construye la ruta de una COT dentro del ZIP.
 * Clientes/<CLIENTE>/<FOLIO>/COT/COT_<EMPRESA>_<FOLIO>.pdf
 */
export function buildCotPath(params: {
  cliente:  string
  folio:    string
  empresa:  string
}): string {
  const c = safeSlug(params.cliente)
  const f = safeSlug(params.folio)
  const e = safeSlug(params.empresa)
  return `Clientes/${c}/${f}/COT/COT_${e}_${f}.pdf`
}

/**
 * Construye la ruta de una OC dentro del ZIP.
 * Clientes/<CLIENTE>/PROVEEDORES/<PROVEEDOR>/<FOLIO>/OC/OC_<EMPRESA>_<FOLIO>_<PROVEEDOR>.pdf
 */
export function buildOcPath(params: {
  cliente:    string
  proveedor:  string
  folio:      string
  empresa:    string
}): string {
  const c  = safeSlug(params.cliente)
  const pr = safeSlug(params.proveedor)
  const f  = safeSlug(params.folio)
  const e  = safeSlug(params.empresa)
  return `Clientes/${c}/PROVEEDORES/${pr}/${f}/OC/OC_${e}_${f}_${pr}.pdf`
}

/**
 * Genera un ZIP en memoria con las entradas dadas.
 * Devuelve Buffer del ZIP completo.
 */
export async function buildZipBuffer(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []
    const pt = new PassThrough()

    pt.on('data', (chunk: Buffer) => chunks.push(chunk))
    pt.on('end', () => resolve(Buffer.concat(chunks)))
    pt.on('error', reject)

    archive.on('error', reject)
    archive.pipe(pt)

    for (const entry of entries) {
      archive.append(entry.content, { name: entry.zipPath })
    }

    archive.finalize()
  })
}
