// ─── Marca de la instalación ──────────────────────────────────────────────────
// El nombre de la empresa aparece en documentos impresos (remitos, informes).
// Sale de una variable de entorno para que cada instalación —y el demo que se
// muestra a clientes nuevos— use su propio nombre sin tocar el código.
//
//   NEXT_PUBLIC_EMPRESA="Logística Hogareño"
//   NEXT_PUBLIC_EMPRESA_SIGLA="LH"

export const EMPRESA = process.env.NEXT_PUBLIC_EMPRESA?.trim() || "Logística Hogareño";

/** Sigla para el recuadro del membrete. Si no se configura, se arma con las iniciales. */
export const EMPRESA_SIGLA =
  process.env.NEXT_PUBLIC_EMPRESA_SIGLA?.trim() ||
  EMPRESA.split(/\s+/).map(p => p[0]).join("").slice(0, 3).toUpperCase();
