# Sistema COT/OC — Empire CDMX

Generación automática de **Cotizaciones (COT)** y **Órdenes de Compra (OC)** a partir de solicitudes de factura.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Auth / DB / Storage | Supabase |
| Excel parsing | xlsx (SheetJS) |
| PDF generation | puppeteer-core + @sparticuz/chromium |
| ZIP export | archiver |
| UI | Tailwind CSS |

---

## Setup local

### 1. Prerrequisitos
- Node.js ≥ 18
- Cuenta en [Supabase](https://supabase.com) con proyecto creado

### 2. Variables de entorno

Copia `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gciwndajkhqlrvofsnaa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu anon key>
SUPABASE_SERVICE_ROLE_KEY=<tu service role key>   # solo backend
```

> Obtén las claves en: Supabase Dashboard → Settings → API

### 3. Crear base de datos

Ejecuta la migración en tu proyecto Supabase:

1. Ve a **SQL Editor** en el Dashboard.
2. Pega y ejecuta el contenido de `supabase/migrations/001_initial.sql`.

O usa Supabase CLI:
```bash
supabase db push
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Arrancar en desarrollo

```bash
npm run dev
```

Accede a [http://localhost:3000](http://localhost:3000)

> **Nota de desarrollo local:** La generación de PDFs requiere **Google Chrome** instalado.
> En Windows se busca automáticamente en `C:\Program Files\Google\Chrome\Application\chrome.exe`.

---

## Deploy en Vercel

### 1. Variables de entorno

En Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### 2. Configuración especial para PDFs serverless

El proyecto usa `@sparticuz/chromium` que detecta automáticamente el entorno Vercel:

```typescript
// lib/pdf/render.ts — auto-detecta VERCEL env var
if (process.env.VERCEL) {
  executablePath = await chromium.executablePath()
  args = chromium.args
}
```

### 3. Límite de tamaño de función

En `vercel.json` (ya incluido), las funciones de generación tienen `maxDuration: 120` segundos.
Vercel Pro/Enterprise soporta hasta 300s. En plan Hobby es 60s — si tienes muchos PDFs, usa plan Pro.

### 4. Deploy

```bash
git push origin main
# Vercel detecta Next.js automáticamente
```

---

## Flujo de uso

```
1. Empresas → Crear empresa → Subir logo (colores auto-extraídos) → Datos bancarios

2. Importar Excel → Seleccionar empresa → Subir .xlsx
   Layout flexible: Folio | Fecha | Cliente | Proveedor | Concepto | Cantidad | P.Unitario

3. Solicitudes → Ver lista → Generar COT/OC → Descargar ZIP
```

---

## Estructura ZIP exportado

```
COT_OC_export.zip
└── Clientes/
    └── <CLIENTE>/
        ├── <FOLIO>/
        │   └── COT/
        │       └── COT_<EMPRESA>_<FOLIO>.pdf
        └── PROVEEDORES/
            └── <PROVEEDOR>/
                └── <FOLIO>/
                    └── OC/
                        └── OC_<EMPRESA>_<FOLIO>_<PROVEEDOR>.pdf
```

---

## Reglas de negocio

| Documento | Fecha | Folio |
|-----------|-------|-------|
| **COT** | 2 días hábiles ANTES de fecha_solicitud | `COT-<folio>` · Número = parte numérica del folio |
| **OC** | = fecha_solicitud | `OC-<folio>` · 1 OC por proveedor |

- **Días hábiles**: lunes–viernes, excluyendo tabla `dias_inhabiles` (MX precargada 2024-2026)
- **IVA**: configurable por solicitud (default 16%)
- **Multi-concepto**: sin límite de renglones, PDF pagina automáticamente con header repetible

---

## Tests

```bash
npm test
```

Tests unitarios para:
- `safeSlug` / `extractFolioNumber` — normalización de nombres y folios
- `businessDays` — cálculo de días hábiles con inhábiles
- `calcularTotales` — cálculo subtotal/IVA/total
- Casos edge de folios numéricos

---

## Estructura de archivos

```
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Home
│   ├── empresas/page.tsx               # CRUD empresas + logo
│   ├── importar/page.tsx               # Upload Excel
│   ├── solicitudes/
│   │   ├── page.tsx                    # Lista + filtros + selección
│   │   └── [id]/page.tsx               # Detalle + generar + descargar
│   └── api/
│       ├── empresas/route.ts           # GET/POST empresas
│       ├── empresas/[id]/route.ts      # GET/PATCH/DELETE empresa
│       ├── solicitudes/route.ts        # GET solicitudes
│       ├── solicitudes/[id]/route.ts   # GET/DELETE solicitud
│       ├── import/route.ts             # POST importar Excel
│       ├── generate/route.ts           # POST generar COT/OC PDFs
│       └── export-zip/route.ts         # GET exportar ZIP
├── lib/
│   ├── supabase.ts                     # Cliente Supabase + tipos
│   ├── excel/parse.ts                  # Parser Excel flexible
│   ├── branding/extractTheme.ts        # Extracción de colores de logo
│   ├── dates/businessDays.ts           # Cálculo días hábiles MX
│   ├── pdf/render.ts                   # HTML → PDF con Puppeteer
│   ├── zip/exportZip.ts                # Generación ZIP con archiver
│   └── utils/
│       ├── safeSlug.ts                 # Normalización nombres/folios
│       └── totales.ts                  # Cálculos financieros
├── templates/
│   ├── cot.html                        # Template HTML cotización
│   └── oc.html                         # Template HTML orden de compra
├── components/
│   └── NavBar.tsx
├── supabase/migrations/
│   └── 001_initial.sql                 # Schema completo + días inhábiles
├── __tests__/                          # Tests unitarios Jest
└── .env.local
```

---

## Agregar empresa nueva

Todo está en la BD — **cero código nuevo** para agregar empresas:

1. Ir a `/empresas` → "Nueva empresa"
2. Llenar datos fiscales y bancarios
3. Subir logo → colores se extraen automáticamente con `node-vibrant`
4. La empresa ya está disponible en la importación de Excel

---

## Días inhábiles adicionales

Para agregar más días inhábiles (ej: días puente de tu empresa):

```sql
INSERT INTO dias_inhabiles (fecha, descripcion, pais)
VALUES ('2025-11-03', 'Día de puente', 'MX');
```

---

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` **nunca** se expone al cliente (solo en API routes)
- RLS habilitado en todas las tablas
- Políticas MVP: `authenticated` puede hacer todo → endurecer por `auth.uid()` para multiusuario
- Storage buckets: `logos` público, `imports` y `documents` privados
