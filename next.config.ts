import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next.js 15+: clave correcta (antes era serverComponentsExternalPackages)
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'archiver', 'node-vibrant'],
}

export default nextConfig
