import type { MetadataRoute } from "next";

// Manifest PWA — habilita "Agregar a pantalla principal" en Android/tablets y
// es el requisito para empaquetar la app como APK (TWA vía PWABuilder).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RutaMap",
    short_name: "RutaMap",
    description: "Control de pendientes, alternativas de entrega y depósito de bultos",
    id: "/",
    start_url: "/pendientes",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f172a",
    theme_color: "#1e3a8a",
    lang: "es-AR",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pendientes", url: "/pendientes", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Depósito", url: "/deposito", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Alternativas", url: "/alternativas", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
