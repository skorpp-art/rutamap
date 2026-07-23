/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // La app está en español. Le decimos al navegador el idioma de forma
  // autoritativa (header HTTP Content-Language), que es la señal más fuerte
  // para el detector de idioma de Chrome. Junto con <html lang="es"
  // translate="no"> y <meta name="google" content="notranslate"> evita que
  // Google Translate detecte mal la página y la "traduzca" español→español,
  // lo que duplica los textos y rompe el render de React.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Language", value: "es" },
        ],
      },
    ];
  },
};

export default nextConfig;
