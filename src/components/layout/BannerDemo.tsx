import { EMPRESA } from "@/lib/marca";

/**
 * Franja fija que avisa que esta instalación es una demostración.
 *
 * Sólo aparece cuando el despliegue define `NEXT_PUBLIC_DEMO=1`, así que en la
 * instalación real no existe. Es deliberadamente imposible de cerrar: la idea
 * es que nadie pueda sacar una captura de estas pantallas y hacerla pasar por
 * datos de una operación verdadera.
 */
export function BannerDemo() {
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return null;

  return (
    <div className="shrink-0 bg-amber-400 text-amber-950 text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 text-center">
      <span className="uppercase tracking-wide">Demostración</span>
      <span className="font-normal">
        Todos los datos son ficticios. {EMPRESA} no es una empresa real.
      </span>
    </div>
  );
}
