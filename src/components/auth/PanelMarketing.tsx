import { Truck, MapPin, PackageCheck, MessageCircle, Warehouse, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANES, MODULOS_POR_PLAN, SOLAPAS } from "@/lib/permisos";

const NOMBRE_PLAN: Record<string, string> = {
  free: "Free", bronce: "Bronce", plata: "Plata", oro: "Oro",
};

const DESC_PLAN: Record<string, string> = {
  free: "Para probar sin compromiso",
  bronce: "Control del día a día",
  plata: "Suma reclamos y depósito",
  oro: "La operación completa",
};

function formatearArs(n: number): string {
  return n === 0
    ? "Gratis"
    : n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

/**
 * El costado izquierdo de /login y /registro: qué es RutaMap y cuánto sale.
 * Es la única pantalla donde tiene sentido mostrar los tres planes juntos —
 * adentro de la app cada empresa ya sabe cuál tiene.
 *
 * Los precios se leen de la base (no están fijos acá) para no quedar
 * desactualizados apenas alguien los cambie desde /admin.
 */
export async function PanelMarketing() {
  const supabase = await createClient();
  // "planes" es una tabla nueva del SaaS, todavía no está en los tipos
  // generados de Supabase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("planes")
    .select("nombre, precio_ars")
    .order("precio_ars", { ascending: true });

  const precios = new Map<string, number>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((p: any) => [p.nombre as string, p.precio_ars as number])
  );
  // Bronce/Plata/Oro son los planes comerciales; Free es la puerta de entrada
  // y ya tiene su propio botón ("Empezar gratis") en la pantalla de espera,
  // así que acá no compite por atención con los que sí facturan.
  const planesComerciales = PLANES.filter(p => p !== "free");

  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-black p-10 xl:p-14 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-brand-blue/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-brand-blue/20 blur-[120px]" />

      <div className="relative flex items-center gap-3">
        <div className="bg-gradient-to-br from-brand-blue to-blue-900 rounded-2xl p-3 shadow-xl ring-1 ring-white/10">
          <Truck className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Ruta<span className="text-blue-300">Map</span>
        </h1>
      </div>

      <div className="relative space-y-8 py-10">
        <div className="space-y-3 max-w-md">
          <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
            La operación de reparto, en un solo lugar
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Recorridos, pendientes de entrega, reclamos y depósito de bultos —
            todo lo que hoy se maneja entre Excels sueltos y WhatsApp, ordenado
            en una sola herramienta para tu equipo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-md">
          {[
            { icon: MapPin, label: "Mapa de recorridos" },
            { icon: PackageCheck, label: "Control de pendientes" },
            { icon: MessageCircle, label: "Gestión de reclamos" },
            { icon: Warehouse, label: "Depósito de bultos" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-white/70 text-sm">
              <Icon className="h-4 w-4 text-blue-300 shrink-0" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-3 max-w-lg">
        {planesComerciales.map(plan => {
          const modulos = MODULOS_POR_PLAN[plan]?.length ?? 0;
          const totalModulos = SOLAPAS.length;
          return (
            <div key={plan} className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                {NOMBRE_PLAN[plan]}
              </p>
              <p className="text-lg font-black text-white leading-none">
                {precios.has(plan) ? formatearArs(precios.get(plan)!) : "—"}
                {precios.get(plan) ? <span className="text-xs font-normal text-white/40">/mes</span> : null}
              </p>
              <p className="text-xs text-white/50 leading-snug">{DESC_PLAN[plan]}</p>
              <p className="flex items-center gap-1 text-[11px] text-white/40 pt-1">
                <Check className="h-3 w-3 text-emerald-400" />
                {modulos} de {totalModulos} módulos
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
