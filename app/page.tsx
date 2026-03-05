import Link from 'next/link'

const cards = [
  {
    href:  '/empresas',
    title: 'Empresas Emisoras',
    desc:  'Administra empresas, logos, colores y datos bancarios.',
    icon:  '🏢',
    color: 'bg-indigo-50 border-indigo-200',
  },
  {
    href:  '/importar',
    title: 'Importar Excel',
    desc:  'Carga solicitudes de factura desde archivo .xlsx o .xlsm.',
    icon:  '📊',
    color: 'bg-green-50 border-green-200',
  },
  {
    href:  '/solicitudes',
    title: 'Solicitudes',
    desc:  'Consulta, genera COT/OC y exporta ZIPs.',
    icon:  '📋',
    color: 'bg-blue-50 border-blue-200',
  },
]

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Sistema COT/OC</h1>
        <p className="mt-2 text-gray-600">
          Generación automática de Cotizaciones y Órdenes de Compra a partir de solicitudes de factura.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map(c => (
          <Link
            key={c.href}
            href={c.href}
            className={`card border-2 ${c.color} hover:shadow-md transition-shadow block`}
          >
            <div className="text-4xl mb-3">{c.icon}</div>
            <h2 className="text-lg font-semibold text-gray-900">{c.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 card bg-amber-50 border border-amber-200">
        <h3 className="font-semibold text-amber-800">Flujo recomendado</h3>
        <ol className="mt-2 text-sm text-amber-700 space-y-1 list-decimal list-inside">
          <li>Configura al menos una <strong>Empresa Emisora</strong> con logo y datos bancarios.</li>
          <li>Ve a <strong>Importar Excel</strong>, selecciona la empresa y sube tu archivo de solicitudes.</li>
          <li>En <strong>Solicitudes</strong>, selecciona las que quieres procesar y genera COT/OC.</li>
          <li>Descarga los PDFs individualmente o en <strong>ZIP</strong> con estructura de carpetas.</li>
        </ol>
      </div>
    </div>
  )
}
