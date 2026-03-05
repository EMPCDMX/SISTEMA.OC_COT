import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/** Cliente público (browser + server components) */
export const supabase = createClient(supabaseUrl, supabaseAnon)

/** Cliente admin con service role (solo en API routes / server actions).
 *  Si SUPABASE_SERVICE_ROLE_KEY no está definida, devuelve el cliente anon.
 */
export function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
  }
  return supabase
}

// ── Tipos derivados de la BD ─────────────────────────────────────────────────

export type Empresa = {
  id: string
  nombre_comercial: string
  razon_social: string
  rfc: string
  direccion_fiscal: string
  activa: boolean
  created_at: string
  empresa_branding?: EmpresaBranding | null
  empresa_bancaria?: EmpresaBancaria | null
}

export type EmpresaBranding = {
  empresa_id: string
  logo_path: string | null
  theme_json: ThemeTokens
  theme_source: string
  updated_at: string
}

export type ThemeTokens = {
  primary: string
  secondary: string
  accent?: string
  headerBg: string
  headerText: string
  tableHeaderBg: string
  tableBorder: string
}

export type EmpresaBancaria = {
  empresa_id: string
  banco: string | null
  cuenta: string | null
  clabe: string | null
  beneficiario: string | null
}

export type Cliente = {
  id: string
  nombre: string
  nombre_normalizado: string
  created_at: string
}

export type Proveedor = {
  id: string
  nombre: string
  nombre_normalizado: string
  created_at: string
}

export type SolicitudFactura = {
  id: string
  folio_factura: string
  fecha_solicitud: string
  cliente_id: string | null
  cliente_nombre: string
  empresa_emisora_id: string | null
  moneda: string
  iva_tasa: number
  estatus: string
  source_file_path: string | null
  import_job_id: string | null
  created_at: string
}

export type SolicitudPartida = {
  id: string
  solicitud_id: string
  proveedor_id: string | null
  proveedor_nombre: string | null
  concepto: string
  cantidad: number
  precio_unitario: number
  orden: number
  created_at: string
}

export type DocumentoGenerado = {
  id: string
  solicitud_id: string
  tipo: 'COT' | 'OC'
  proveedor_id: string | null
  folio_visible: string
  numero_interno: number | null
  fecha_documento: string
  subtotal: number
  iva: number
  total: number
  pdf_path: string
  version: number
  created_at: string
}
