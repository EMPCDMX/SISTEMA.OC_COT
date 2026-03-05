import fs from 'fs'
import path from 'path'
import type { ThemeTokens, EmpresaBancaria } from '@/lib/supabase'
import { formatDateES } from '@/lib/dates/businessDays'
import { formatCurrency } from '@/lib/utils/totales'

// ── Tipos del modelo de renderizado ──────────────────────────────────────

export type RenderPartida = {
  concepto:        string
  cantidad:        number
  precio_unitario: number
  importe:         number
}

export type RenderTotales = {
  subtotal: number
  iva:      number
  total:    number
  ivaTasa:  number
}

export type RenderModelCOT = {
  tipo:         'COT'
  empresa: {
    razon_social:     string
    rfc:              string
    direccion_fiscal: string
  }
  branding: {
    logoDataUrl?: string
    theme:        ThemeTokens
  }
  documento: {
    folio_visible:     string
    numero_interno:    number
    fecha_documento:   Date
    cliente:           string
    moneda:            string
  }
  partidas:    RenderPartida[]
  totales:     RenderTotales
  condiciones: string
}

export type RenderModelOC = {
  tipo:         'OC'
  empresa: {
    razon_social:     string
    rfc:              string
    direccion_fiscal: string
  }
  branding: {
    logoDataUrl?: string
    theme:        ThemeTokens
  }
  documento: {
    folio_visible:   string
    fecha_documento: Date
    cliente:         string
    proveedor:       string
    moneda:          string
  }
  partidas:  RenderPartida[]
  totales:   RenderTotales
  banco?:    EmpresaBancaria | null
}

export type RenderModel = RenderModelCOT | RenderModelOC

// ── Template loader ───────────────────────────────────────────────────────

function loadTemplate(name: 'cot' | 'oc'): string {
  // En dev: leer desde disco. En producción serverless, se bundlea como string.
  const templatePath = path.join(process.cwd(), 'templates', `${name}.html`)
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8')
  }
  throw new Error(`Template no encontrado: ${templatePath}`)
}

// ── Renderer HTML ─────────────────────────────────────────────────────────

function renderFilas(partidas: RenderPartida[]): string {
  return partidas.map((p, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-num">${i + 1}</td>
      <td class="td-concepto">${escapeHtml(p.concepto)}</td>
      <td class="td-right">${formatNum(p.cantidad)}</td>
      <td class="td-right">${formatCurrency(p.precio_unitario)}</td>
      <td class="td-right">${formatCurrency(p.importe)}</td>
    </tr>
  `).join('')
}

function renderBanco(banco: EmpresaBancaria | null | undefined): string {
  if (!banco) return ''
  const items = [
    banco.banco        ? `<tr><th>Banco</th><td>${escapeHtml(banco.banco)}</td></tr>`          : '',
    banco.beneficiario ? `<tr><th>Beneficiario</th><td>${escapeHtml(banco.beneficiario)}</td></tr>` : '',
    banco.cuenta       ? `<tr><th>No. Cuenta</th><td>${escapeHtml(banco.cuenta)}</td></tr>`    : '',
    banco.clabe        ? `<tr><th>CLABE</th><td>${escapeHtml(banco.clabe)}</td></tr>`           : '',
  ].filter(Boolean).join('')

  if (!items) return ''

  return `
    <div class="banco-section">
      <h3 class="banco-title">Datos Bancarios para Pago</h3>
      <table class="banco-table">
        <tbody>${items}</tbody>
      </table>
    </div>
  `
}

/**
 * Construye el HTML final para COT u OC inyectando el modelo en el template.
 */
export function buildHtml(model: RenderModel): string {
  const template = loadTemplate(model.tipo === 'COT' ? 'cot' : 'oc')
  const t = model.branding.theme

  const logoHtml = model.branding.logoDataUrl
    ? `<img src="${model.branding.logoDataUrl}" class="logo" alt="Logo" />`
    : ''

  const filasHtml = renderFilas(model.partidas)

  const totalesHtml = `
    <tr>
      <td colspan="4" class="td-label">Subtotal</td>
      <td class="td-right td-total">${formatCurrency(model.totales.subtotal)}</td>
    </tr>
    <tr>
      <td colspan="4" class="td-label">IVA (${(model.totales.ivaTasa * 100).toFixed(0)}%)</td>
      <td class="td-right td-total">${formatCurrency(model.totales.iva)}</td>
    </tr>
    <tr class="tr-total-final">
      <td colspan="4" class="td-label td-grand-label">TOTAL</td>
      <td class="td-right td-grand-total">${formatCurrency(model.totales.total)}</td>
    </tr>
  `

  let html = template
    // Tokens de color
    .replace(/\{\{primary\}\}/g, t.primary)
    .replace(/\{\{secondary\}\}/g, t.secondary)
    .replace(/\{\{accent\}\}/g, t.accent ?? t.primary)
    .replace(/\{\{headerBg\}\}/g, t.headerBg)
    .replace(/\{\{headerText\}\}/g, t.headerText)
    .replace(/\{\{tableHeaderBg\}\}/g, t.tableHeaderBg)
    .replace(/\{\{tableBorder\}\}/g, t.tableBorder)
    // Logo
    .replace('{{logo}}', logoHtml)
    // Empresa
    .replace('{{razon_social}}', escapeHtml(model.empresa.razon_social))
    .replace('{{rfc}}', escapeHtml(model.empresa.rfc))
    .replace('{{direccion_fiscal}}', escapeHtml(model.empresa.direccion_fiscal))
    // Documento común
    .replace('{{fecha_documento}}', formatDateES(model.documento.fecha_documento))
    .replace('{{cliente}}', escapeHtml(model.documento.cliente))
    .replace('{{moneda}}', escapeHtml(model.documento.moneda))
    // Partidas y totales
    .replace('{{filas}}', filasHtml)
    .replace('{{totales}}', totalesHtml)

  if (model.tipo === 'COT') {
    html = html
      .replace('{{folio_visible}}', escapeHtml(model.documento.folio_visible))
      .replace('{{numero_interno}}', String(model.documento.numero_interno))
      .replace('{{condiciones}}', escapeHtml(model.condiciones).replace(/\n/g, '<br/>'))
  } else {
    html = html
      .replace('{{folio_visible}}', escapeHtml(model.documento.folio_visible))
      .replace('{{proveedor}}', escapeHtml(model.documento.proveedor))
      .replace('{{banco}}', renderBanco(model.banco))
  }

  return html
}

// ── Puppeteer renderer ────────────────────────────────────────────────────

/**
 * Convierte HTML a PDF Buffer usando puppeteer + chromium serverless.
 * En entornos serverless (Vercel) usa @sparticuz/chromium.
 * En local usa la instalación de chromium del sistema si existe.
 */
export async function renderPdfFromHtml(
  html: string,
  options: { landscape?: boolean } = {},
): Promise<Buffer> {
  // Importación dinámica para evitar que webpack lo bundle en client
  const puppeteer = (await import('puppeteer-core')).default

  let executablePath: string
  let args: string[]

  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    executablePath = await chromium.executablePath()
    args = chromium.args
  } else {
    // Desarrollo local: buscar chrome/chromium instalado
    executablePath = findLocalChrome()
    args = ['--no-sandbox', '--disable-setuid-sandbox']
  }

  const browser = await puppeteer.launch({
    executablePath,
    args,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      landscape: options.landscape ?? false,
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatNum(n: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(n)
}

function findLocalChrome(): string {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const c of candidates) {
    try {
      fs.accessSync(c)
      return c
    } catch { /* not found */ }
  }
  throw new Error(
    'No se encontró Chrome/Chromium. Instálalo o configura PUPPETEER_EXECUTABLE_PATH.',
  )
}
