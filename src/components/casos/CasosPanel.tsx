"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, ClipboardList, Clock, Plus, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatRow } from "@/components/ui/stat-row";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getAreaUsuario, getCasos, getNotificaciones, marcarLeidas,
  type Caso, type Notificacion,
} from "@/app/actions/casos";
import {
  AREA_LABEL, ESTADO_INFO, antesDelCorte, corteYaPaso, fechaAR, fechaHoraCorta, HORA_CORTE,
} from "./comun";
import { CasoAltaModal } from "./CasoAltaModal";
import { CasoDetalle } from "./CasoDetalle";

type Filtro = "mi_area" | "abiertos" | "hoy" | "todos" | "cerrados";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "mi_area", label: "En mi cancha" },
  { key: "abiertos", label: "Sin cerrar" },
  { key: "hoy", label: "De hoy" },
  { key: "todos", label: "Todos" },
  { key: "cerrados", label: "Cerrados" },
];

export function CasosPanel({ nombre }: { nombre: string }) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [notis, setNotis] = useState<Notificacion[]>([]);
  const [area, setArea] = useState("ambas");
  const [puedeGestionar, setPuedeGestionar] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("mi_area");
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [alta, setAlta] = useState(false);
  const [bandeja, setBandeja] = useState(false);

  const cargar = useCallback(async () => {
    const [c, n] = await Promise.all([getCasos(), getNotificaciones()]);
    if (c.ok) setCasos(c.data); else toast.error(c.error);
    if (n.ok) setNotis(n.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    getAreaUsuario().then(r => {
      if (r.ok) { setArea(r.data.area); setPuedeGestionar(r.data.puedeGestionar); }
    });
    cargar();
  }, [cargar]);

  const sinLeer = notis.filter(n => !n.leida).length;

  const hoy = fechaAR(new Date().toISOString());

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return casos.filter(c => {
      const cerrado = ESTADO_INFO[c.estado].cerrado;
      if (filtro === "cerrados" && !cerrado) return false;
      if (filtro === "abiertos" && cerrado) return false;
      if (filtro === "hoy" && fechaAR(c.created_at) !== hoy) return false;
      if (filtro === "mi_area") {
        if (cerrado) return false;
        // Los mandos ven "ambas": para ellos el filtro es todo lo abierto.
        if (area !== "ambas" && c.area_responsable !== area) return false;
      }
      if (!q) return true;
      return [c.numero, c.cliente, c.tracking, c.direccion, c.ejecutivo, c.tipo_incidencia]
        .some(v => v?.toLowerCase().includes(q));
    });
  }, [casos, filtro, busca, area, hoy]);

  // Lo que importa de un vistazo: cuánto hay esperándome, cuánto entró hoy y
  // cuánto de eso llegó a tiempo para meterse en la salida del día.
  const abiertos = casos.filter(c => !ESTADO_INFO[c.estado].cerrado);
  const mios = abiertos.filter(c => area === "ambas" || c.area_responsable === area);
  const deHoy = casos.filter(c => fechaAR(c.created_at) === hoy);
  const aTiempo = deHoy.filter(c => antesDelCorte(c.created_at)).length;

  async function abrirBandeja() {
    setBandeja(b => !b);
    if (!bandeja && sinLeer) {
      await marcarLeidas();
      setNotis(ns => ns.map(n => ({ ...n, leida: true })));
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-4 sm:p-6 gap-3">
        <PageHeader
          titulo="Casos"
          desc="Los paquetes con problema que gestionan Asesoría y Coordinación."
          meta={
            corteYaPaso()
              ? `Pasó el corte de las ${HORA_CORTE}:00`
              : `Hasta las ${HORA_CORTE}:00 se pueden tocar los recorridos`
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar caso, cliente, seguimiento…" className="pl-8 w-64" />
          </div>
          <div className="flex gap-1">
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={cn("px-2.5 h-8 rounded-md text-xs font-medium transition-colors",
                  filtro === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Button variant="outline" size="icon" onClick={abrirBandeja} title="Novedades">
                <Bell className="h-4 w-4" />
                {sinLeer > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                    {sinLeer}
                  </span>
                )}
              </Button>
              {bandeja && (
                <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-y-auto rounded-lg border bg-popover shadow-lg p-1">
                  {notis.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Sin novedades.</p>
                  ) : notis.map(n => (
                    <button key={n.id}
                      onClick={() => { setSelId(n.caso_id); setBandeja(false); }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent">
                      <p className="text-sm leading-tight">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground">{fechaHoraCorta(n.created_at)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={cargar} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {puedeGestionar && (
              <Button onClick={() => setAlta(true)}>
                <Plus className="h-4 w-4" /> Nuevo caso
              </Button>
            )}
          </div>
        </div>

        <StatRow
          compact
          stats={[
            { label: area === "ambas" ? "Sin cerrar" : `Esperan a ${AREA_LABEL[area]}`, valor: mios.length },
            { label: "Abiertos en total", valor: abiertos.length },
            { label: "Entraron hoy", valor: deHoy.length },
            { label: `Antes de las ${HORA_CORTE}`, valor: aTiempo, sub: "a tiempo para el recorrido" },
          ]}
        />

        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
          {cargando ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
          ) : visibles.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No hay casos"
              description="Con este filtro no queda nada. Probá con “Todos”." />
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Caso</th>
                  <th className="text-left font-medium px-3 py-2">Cliente</th>
                  <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Incidencia</th>
                  <th className="text-left font-medium px-3 py-2">Estado</th>
                  <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Responde</th>
                  <th className="text-left font-medium px-3 py-2">Entró</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(c => (
                  <tr key={c.id} onClick={() => setSelId(c.id)}
                    className={cn("border-t cursor-pointer hover:bg-accent/50",
                      selId === c.id && "bg-accent")}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{c.numero}</td>
                    <td className="px-3 py-2 max-w-[14rem] truncate">{c.cliente}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{c.tipo_incidencia}</td>
                    <td className="px-3 py-2">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap", ESTADO_INFO[c.estado].clase)}>
                        {ESTADO_INFO[c.estado].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                      {AREA_LABEL[c.area_responsable]}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {/* El reloj marca lo que entró pasado el corte: eso ya
                            no se pudo meter en la salida de ese día. */}
                        {!antesDelCorte(c.created_at) && (
                          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                            aria-label={`Después de las ${HORA_CORTE}`} />
                        )}
                        {fechaHoraCorta(c.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selId && (
        <CasoDetalle casoId={selId} puedeGestionar={puedeGestionar}
          onCerrar={() => setSelId(null)} onCambio={cargar} />
      )}

      <CasoAltaModal abierto={alta} ejecutivoSugerido={nombre}
        onCerrar={() => setAlta(false)}
        onCreado={id => { setAlta(false); setSelId(id); cargar(); }} />
    </div>
  );
}
