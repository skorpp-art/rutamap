import type { MetadataRoute } from "next";

// Manifest PWA — habilita "Agregar a pantalla principal" en Android/tablets y
// es el requisito para empaquetar la app como APK (TWA vía PWABuilder).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RutaMap — Logística Hogareño",
    short_name: "RutaMap",
    description: "Gestión de recorridos, carga diaria y control de pendientes — Logística Hogareño",
    id: "/",
    start_url: "/carga",
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
      { name: "Carga del Día", url: "/carga", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Pendientes", url: "/pendientes", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Mapa", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
