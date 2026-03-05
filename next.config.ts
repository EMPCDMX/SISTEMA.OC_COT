import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En Next 16 ya no se usa serverComponentsExternalPackages aquí.
  // Si necesitas permitir paquetes en Server Components, se maneja
  // con configuración moderna o moviendo esa lógica al runtime.

  // Mantén esto si usas imágenes remotas (ajústalo si hace falta).
  images: {
    remotePatterns: [
      // ejemplo para Supabase storage público
      // { protocol: "https", hostname: "**.supabase.co" }
    ],
  },
};

export default nextConfig;
