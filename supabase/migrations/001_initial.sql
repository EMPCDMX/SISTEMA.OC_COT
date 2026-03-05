-- ============================================================
-- SISTEMA COT/OC - Migración inicial
-- ============================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLA: empresas
-- ============================================================
create table if not exists empresas (
  id               uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social     text not null,
  rfc              text not null,
  direccion_fiscal text not null,
  activa           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- TABLA: empresa_branding
-- ============================================================
create table if not exists empresa_branding (
  empresa_id    uuid primary key references empresas(id) on delete cascade,
  logo_path     text,
  theme_json    jsonb not null default '{}',
  theme_source  text not null default 'auto_from_logo',
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- TABLA: empresa_bancaria
-- ============================================================
create table if not exists empresa_bancaria (
  empresa_id   uuid primary key references empresas(id) on delete cascade,
  banco        text,
  cuenta       text,
  clabe        text,
  beneficiario text
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
create table if not exists clientes (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_normalizado  text not null unique,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- TABLA: proveedores
-- ============================================================
create table if not exists proveedores (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_normalizado  text not null unique,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- TABLA: solicitudes_factura
-- ============================================================
create table if not exists solicitudes_factura (
  id                  uuid primary key default gen_random_uuid(),
  folio_factura       text not null unique,
  fecha_solicitud     date not null,
  cliente_id          uuid references clientes(id),
  cliente_nombre      text not null,
  empresa_emisora_id  uuid references empresas(id),
  moneda              text not null default 'MXN',
  iva_tasa            numeric not null default 0.16,
  estatus             text not null default 'importada',
  source_file_path    text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- TABLA: solicitud_partidas
-- ============================================================
create table if not exists solicitud_partidas (
  id               uuid primary key default gen_random_uuid(),
  solicitud_id     uuid not null references solicitudes_factura(id) on delete cascade,
  proveedor_id     uuid references proveedores(id),
  proveedor_nombre text,
  concepto         text not null,
  cantidad         numeric not null,
  precio_unitario  numeric not null,
  orden            int not null default 0,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- TABLA: dias_inhabiles (México)
-- ============================================================
create table if not exists dias_inhabiles (
  fecha        date primary key,
  descripcion  text,
  pais         text not null default 'MX',
  activo       boolean not null default true
);

-- Días inhábiles MX 2024-2026 (federales oficiales)
insert into dias_inhabiles (fecha, descripcion, pais) values
  ('2024-01-01', 'Año Nuevo',                          'MX'),
  ('2024-02-05', 'Día de la Constitución',             'MX'),
  ('2024-03-18', 'Natalicio de Benito Juárez',         'MX'),
  ('2024-03-28', 'Jueves Santo',                       'MX'),
  ('2024-03-29', 'Viernes Santo',                      'MX'),
  ('2024-05-01', 'Día del Trabajo',                    'MX'),
  ('2024-09-16', 'Día de la Independencia',            'MX'),
  ('2024-11-18', 'Revolución Mexicana',                'MX'),
  ('2024-12-25', 'Navidad',                            'MX'),
  ('2025-01-01', 'Año Nuevo',                          'MX'),
  ('2025-02-03', 'Día de la Constitución',             'MX'),
  ('2025-03-17', 'Natalicio de Benito Juárez',         'MX'),
  ('2025-04-17', 'Jueves Santo',                       'MX'),
  ('2025-04-18', 'Viernes Santo',                      'MX'),
  ('2025-05-01', 'Día del Trabajo',                    'MX'),
  ('2025-09-16', 'Día de la Independencia',            'MX'),
  ('2025-11-17', 'Revolución Mexicana',                'MX'),
  ('2025-12-25', 'Navidad',                            'MX'),
  ('2026-01-01', 'Año Nuevo',                          'MX'),
  ('2026-02-02', 'Día de la Constitución',             'MX'),
  ('2026-03-16', 'Natalicio de Benito Juárez',         'MX'),
  ('2026-04-02', 'Jueves Santo',                       'MX'),
  ('2026-04-03', 'Viernes Santo',                      'MX'),
  ('2026-05-01', 'Día del Trabajo',                    'MX'),
  ('2026-09-16', 'Día de la Independencia',            'MX'),
  ('2026-11-16', 'Revolución Mexicana',                'MX'),
  ('2026-12-25', 'Navidad',                            'MX')
on conflict (fecha) do nothing;

-- ============================================================
-- TABLA: documentos_generados
-- ============================================================
create table if not exists documentos_generados (
  id               uuid primary key default gen_random_uuid(),
  solicitud_id     uuid not null references solicitudes_factura(id) on delete cascade,
  tipo             text not null check (tipo in ('COT','OC')),
  proveedor_id     uuid references proveedores(id),
  folio_visible    text not null,
  numero_interno   int,
  fecha_documento  date not null,
  subtotal         numeric not null,
  iva              numeric not null,
  total            numeric not null,
  pdf_path         text not null,
  version          int not null default 1,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_solicitudes_cliente    on solicitudes_factura(cliente_id);
create index if not exists idx_solicitudes_empresa    on solicitudes_factura(empresa_emisora_id);
create index if not exists idx_solicitudes_estatus    on solicitudes_factura(estatus);
create index if not exists idx_partidas_solicitud     on solicitud_partidas(solicitud_id);
create index if not exists idx_partidas_proveedor     on solicitud_partidas(proveedor_id);
create index if not exists idx_docs_solicitud         on documentos_generados(solicitud_id);
create index if not exists idx_dias_inhabiles_activo  on dias_inhabiles(activo, pais);

-- ============================================================
-- RLS  (habilitar; políticas MVP: solo authenticated)
-- ============================================================
alter table empresas             enable row level security;
alter table empresa_branding     enable row level security;
alter table empresa_bancaria     enable row level security;
alter table clientes             enable row level security;
alter table proveedores          enable row level security;
alter table solicitudes_factura  enable row level security;
alter table solicitud_partidas   enable row level security;
alter table dias_inhabiles       enable row level security;
alter table documentos_generados enable row level security;

-- Políticas permisivas para rol authenticated (MVP)
-- Se usa DROP + CREATE para evitar error si ya existen
do $$
declare
  tbl text;
  tbls text[] := array[
    'empresas','empresa_branding','empresa_bancaria',
    'clientes','proveedores','solicitudes_factura',
    'solicitud_partidas','dias_inhabiles','documentos_generados'
  ];
begin
  foreach tbl in array tbls loop
    execute format('drop policy if exists "authenticated_all" on %I', tbl);
    execute format(
      'create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)',
      tbl
    );
  end loop;
end $$;

-- Días inhábiles: lectura pública (no requiere login para consultar fechas)
drop policy if exists "public_read_dias" on dias_inhabiles;
create policy "public_read_dias" on dias_inhabiles for select using (true);

-- ============================================================
-- STORAGE: crear buckets via SQL helper (si se usa Supabase CLI)
-- Nota: si usas Dashboard, créalos manualmente con estos nombres:
--   logos     (public: true  — para servir logos en PDFs)
--   imports   (public: false)
--   documents (public: false)
-- ============================================================
insert into storage.buckets (id, name, public)
  values
    ('logos',     'logos',     true),
    ('imports',   'imports',   false),
    ('documents', 'documents', false)
on conflict (id) do nothing;

-- Políticas Storage (drop primero para idempotencia)
drop policy if exists "logos_public_read"  on storage.objects;
drop policy if exists "logos_auth_write"   on storage.objects;
drop policy if exists "logos_auth_update"  on storage.objects;
drop policy if exists "imports_auth_all"   on storage.objects;
drop policy if exists "documents_auth_all" on storage.objects;

create policy "logos_public_read"   on storage.objects for select            using (bucket_id = 'logos');
create policy "logos_auth_write"    on storage.objects for insert to authenticated with check (bucket_id = 'logos');
create policy "logos_auth_update"   on storage.objects for update to authenticated using (bucket_id = 'logos');
create policy "imports_auth_all"    on storage.objects for all    to authenticated using (bucket_id = 'imports')   with check (bucket_id = 'imports');
create policy "documents_auth_all"  on storage.objects for all    to authenticated using (bucket_id = 'documents') with check (bucket_id = 'documents');
