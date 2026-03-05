import fs from 'fs'
import path from 'path'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
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
 * Convierte HTML a PDF Buffer usando puppeteer-core + @sparticuz/chromium.
 * En Vercel usa el binario serverless de chromium.
 * En local requiere Chrome/Chromium instalado o PUPPETEER_EXECUTABLE_PATH.
 */
export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  const isVercel = !!process.env.VERCEL

  const browser = await puppeteer.launch({
    args:           isVercel ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: isVercel ? await chromium.executablePath() : (process.env.PUPPETEER_EXECUTABLE_PATH ?? undefined),
    headless:       isVercel ? chromium.headless : true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
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

