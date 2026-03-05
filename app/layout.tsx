import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Sistema COT/OC',
  description: 'Generación automática de Cotizaciones y Órdenes de Compra',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          Sistema COT/OC · Empire CDMX
        </footer>
      </body>
    </html>
  )
}
