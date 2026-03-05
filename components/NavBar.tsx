'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',            label: 'Inicio' },
  { href: '/empresas',    label: 'Empresas' },
  { href: '/importar',    label: 'Importar Excel' },
  { href: '/solicitudes', label: 'Solicitudes' },
]

export default function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="bg-indigo-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
        <span className="font-bold text-lg tracking-wide">COT/OC</span>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium px-2 py-1 rounded transition-colors
              ${pathname === l.href ? 'bg-white/20' : 'hover:bg-white/10'}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
