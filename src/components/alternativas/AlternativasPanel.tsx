"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar, RefreshCw, Upload, UserPlus, MessageCircle, Printer, Trash2, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatRow } from "@/components/ui/stat-row";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";
import { linkWhatsApp, mensajeDe, formatearTelefono } from "@/lib/whatsapp";
import { imprimirEtiquetas } from "@/lib/etiquetas";
import {
  getAlternativas, upsertAlternativa, importarAlternativas, setEstadoAlternativa,
  marcarImpresas, guardarRespuesta, eliminarAlternativa, limpiarAlternativasDia,
  type CasoAlternativa, type EstadoAlternativa, type TipoAlternativa,
} from "@/app/actions/alternativas";
import { getCargaDia, getConductores } from "@/app/actions/carga-dia";
import { AlternativasDrawer } from "./AlternativasDrawer";
import { ImportarModal, ManualModal, SecuencialModal, ImprimirModal } from "./AlternativasModales";
import { ESTADO_INFO, TIPO_INFO, type RecorridoDia } from "./comun";

type Filtro = "todos" | "alternativa" | "demora" | "sinenviar" | "conalt";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "alternativa", label: "Alternativas" },
  { key: "demora", label: "Demoras" },
  { key: "sinenviar", label: "Sin enviar" },
  { key: "conalt", label: "Con alternativa" },
];

export function AlternativasPanel({ puedeEditar }: { puedeEditar: boolean }) {
  // hoyAR y no toISOString: en UTC el día salta a las 21:00 hora argentina,
  // justo cuando más se usa esta pantalla.
  const [fecha, setFecha] = useState(hoyAR());
  const [casos, setCasos] = useState<CasoAlternativa[]>([]);
  const [recorridos, setRecorridos] = useState<RecorridoDia[]>([]);
  const [conductores, setConductores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [modalImportar, setModalImportar] = useState(false);
  const [modalManual, setModalManual] = useState(false);
  const [modalImprimir, setModalImprimir] = useState(false);
  const [cola, setCola] = useState<CasoAlternativa[] | null>(null);

  const cargar = useCallback(async (f: string) => {
    setCargando(true);
    const [r, rc] = await Promise.all([getAlternativas(f), getCargaDia(f)]);
    if (r.ok) setCasos(r.data ?? []);
    else toast.error(r.error ?? "No se pudieron cargar los casos");
    if (rc.ok) {
      // Recorridos de la Carga del Día: sirven para asociar el caso a un móvil
      // real en vez de tipear el conductor a mano.
      const vistos = new Map<string, RecorridoDia>();
      for (const f2 of rc.data ?? []) {
        if (!vistos.has(f2.recorrido_id)) {
          vistos.set(f2.recorrido_id, {
            recorrido_id: f2.recorrido_id, codigo: f2.codigo, zona: f2.zona, chofer: f2.chofer,
          });
        }
      }
      setRecorridos([...vistos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);
  useEffect(() => { getConductores().then(r => { if (r.ok) setConductores(r.data ?? []); }); }, []);

  const seleccionado = casos.find(c => c.id === selId) ?? null;

  // ── Contadores ────────────────────────────────────────────────────────────
  // Cada estado cuenta una sola vez: en el prototipo "C/ alternativa" y
  // "A imprimir" mostraban siempre el mismo número.
  const stats = useMemo(() => {
    const n = (e: EstadoAlternativa) => casos.filter(c => c.estado === e).length;
    return {
      sinEnviar: n("pendiente"),
      enviados: n("enviado"),
      conAlt: n("alternativa"),
      impresas: n("impreso"),
      cerrados: n("cerrado"),
    };
  }, [casos]);

  // Sólo los que todavía NO recibieron el mensaje. El prototipo incluía los ya
  // enviados, así que volver a apretar el botón les escribía de nuevo.
  const sinEnviarDe = useCallback(
    (t: TipoAlternativa) => casos.filter(c => c.tipo === t && c.estado === "pendiente"),
    [casos]
  );
  const listasParaImprimir = useMemo(() => casos.filter(c => c.estado === "alternativa"), [casos]);

  const visibles = useMemo(() => {
    switch (filtro) {
      case "alternativa": return casos.filter(c => c.tipo === "alternativa");
      case "demora":      return casos.filter(c => c.tipo === "demora");
      case "sinenviar":   return casos.filter(c => c.estado === "pendiente");
      case "conalt":      return casos.filter(c => c.estado === "alternativa");
      default:            return casos;
    }
  }, [casos, filtro]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const parche = (id: string, patch: Partial<CasoAlternativa>) =>
    setCasos(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));

  /** Abre WhatsApp con el mensaje cargado. false si el navegador bloqueó la ventana. */
  const abrirWhatsApp = useCallback((c: CasoAlternativa): boolean => {
    const tel = (c.telefono ?? "").replace(/\D/g, "");
    if (!tel) { toast.error(`${c.cliente} no tiene teléfono cargado`); return false; }
    const msg = mensajeDe(c.tipo, c.estado, {
      cliente: c.cliente, direccion: c.direccion,
      alternativa: c.alternativa, observacion: c.observacion,
    });
    const win = window.open(linkWhatsApp(tel, msg), "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error("El navegador bloqueó la ventana. Permití las ventanas emergentes de este sitio.");
      return false;
    }
    if (c.estado === "pendiente") {
      parche(c.id, { estado: "enviado" });
      setEstadoAlternativa(c.id, "enviado");
    }
    return true;
  }, []);

  async function cambiarEstado(id: string, estado: EstadoAlternativa) {
    parche(id, { estado });
    const r = await setEstadoAlternativa(id, estado);
    if (!r.ok) { toast.error(r.error ?? "No se pudo actualizar"); cargar(fecha); }
  }

  async function guardarDatos(c: CasoAlternativa) {
    parche(c.id, c);
    const r = await upsertAlternativa(
      c.id, fecha, c.tipo, c.cliente, c.telefono ?? "", c.direccion ?? "", c.recorrido_id, c.chofer ?? ""
    );
    if (!r.ok) { toast.error(r.error ?? "No se pudo guardar"); cargar(fecha); }
  }

  async function guardarRespuestaCaso(id: string, alternativa: string, observacion: string) {
    parche(id, { alternativa, observacion, estado: "alternativa" });
    const r = await guardarRespuesta(id, alternativa, observacion);
    if (r.ok) toast.success("Alternativa guardada — etiqueta lista para imprimir");
    else { toast.error(r.error ?? "No se pudo guardar"); cargar(fecha); }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este caso?")) return;
    setCasos(prev => prev.filter(c => c.id !== id));
    if (selId === id) setSelId(null);
    const r = await eliminarAlternativa(id);
    if (!r.ok) { toast.error(r.error ?? "No se pudo eliminar"); cargar(fecha); }
  }

  async function limpiar() {
    if (!confirm(`¿Vaciar todos los casos del ${fecha}?`)) return;
    const r = await limpiarAlternativasDia(fecha);
    if (r.ok) { toast.success(`${r.borrados ?? 0} caso(s) eliminados`); setSelId(null); cargar(fecha); }
    else toast.error(r.error ?? "No se pudo limpiar");
  }

  function imprimir(porHoja: 6 | 8, marcar: boolean) {
    const lista = listasParaImprimir;
    const ok = imprimirEtiquetas(lista.map(c => ({
      cliente: c.cliente, direccion: c.direccion, chofer: c.chofer,
      alternativa: c.alternativa, observacion: c.observacion, zona: c.zona,
    })), porHoja);
    if (!ok) { toast.error("El navegador bloqueó la ventana de impresión."); return; }
    setModalImprimir(false);
    if (marcar) {
      const ids = lista.map(c => c.id);
      setCasos(prev => prev.map(c => (ids.includes(c.id) ? { ...c, estado: "impreso" as const } : c)));
      marcarImpresas(ids).then(r => { if (!r.ok) cargar(fecha); });
    }
  }

  // Una sola etiqueta desde la fila o el panel: respeta el formato de 8 por hoja
  function imprimirUna(c: CasoAlternativa) {
    const ok = imprimirEtiquetas([{
      cliente: c.cliente, direccion: c.direccion, chofer: c.chofer,
      alternativa: c.alternativa, observacion: c.observacion, zona: c.zona,
    }], 8);
    if (!ok) toast.error("El navegador bloqueó la ventana de impresión.");
  }

  function abrirCola(t: TipoAlternativa) {
    const lista = sinEnviarDe(t);
    if (!lista.length) { toast.info("No hay casos sin enviar de ese tipo"); return; }
    setCola(lista);
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="shrink-0 max-w-[1700px] w-full mx-auto px-5 pt-5 space-y-4">
        <PageHeader
          titulo="Alternativas"
          desc="Casos que no se pudieron entregar: se le pide al cliente otra dirección por WhatsApp y, con la respuesta, se imprime la etiqueta de re-despacho."
          meta={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 border rounded-md px-2.5 py-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="text-xs bg-transparent outline-none" />
              </span>
              <button onClick={() => cargar(fecha)} disabled={cargando}
                className="p-2 rounded-md border hover:bg-muted/40 transition-colors" title="Actualizar">
                <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
              </button>
            </span>
          }
        />

        <StatRow
          labelsUpper
          stats={[
            { label: "Sin enviar", valor: stats.sinEnviar.toLocaleString("es-AR"),
              sub: stats.sinEnviar > 0 ? "esperando el mensaje" : "todo enviado" },
            { label: "Enviados", valor: stats.enviados.toLocaleString("es-AR"),
              valorClassName: "text-violet-700 dark:text-violet-300", sub: "esperando respuesta" },
            { label: "Con alternativa", valor: stats.conAlt.toLocaleString("es-AR"),
              valorClassName: "text-emerald-700 dark:text-emerald-300", sub: "listas para imprimir" },
            { label: "Impresas", valor: stats.impresas.toLocaleString("es-AR"), sub: "ya en el depósito" },
            { label: "Cerrados", valor: stats.cerrados.toLocaleString("es-AR"), sub: "demoras avisadas" },
          ]}
        />

        {/* Acciones */}
        {puedeEditar && (
          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-0.5">
            <Button size="sm" variant="outline" onClick={() => setModalImportar(true)}
              className="h-8 gap-1.5 text-xs font-bold rounded-md shrink-0">
              <Upload className="h-3.5 w-3.5" /> Importar lista
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModalManual(true)}
              className="h-8 gap-1.5 text-xs font-bold rounded-md shrink-0">
              <UserPlus className="h-3.5 w-3.5" /> Agregar caso
            </Button>
            <Button size="sm" onClick={() => abrirCola("alternativa")}
              disabled={!sinEnviarDe("alternativa").length}
              className="h-8 gap-1.5 text-xs font-bold rounded-md shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
              <MessageCircle className="h-3.5 w-3.5" /> Enviar alternativas ({sinEnviarDe("alternativa").length})
            </Button>
            <Button size="sm" onClick={() => abrirCola("demora")}
              disabled={!sinEnviarDe("demora").length}
              className="h-8 gap-1.5 text-xs font-bold rounded-md shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
              <MessageCircle className="h-3.5 w-3.5" /> Enviar demoras ({sinEnviarDe("demora").length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModalImprimir(true)}
              disabled={!listasParaImprimir.length}
              className="h-8 gap-1.5 text-xs font-bold rounded-md shrink-0">
              <Printer className="h-3.5 w-3.5" /> Imprimir etiquetas ({listasParaImprimir.length})
            </Button>
            <Button size="sm" variant="outline" onClick={limpiar} disabled={!casos.length}
              className="h-8 gap-1.5 text-xs font-bold rounded-md shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Limpiar día
            </Button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={cn("px-3 h-8 rounded-full border text-xs font-bold whitespace-nowrap transition-colors shrink-0",
                filtro === f.key ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:bg-muted")}>
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground shrink-0">
            {visibles.length} de {casos.length} caso(s)
          </span>
        </div>
      </div>

      {/* Tabla + panel de detalle */}
      <div className="flex-1 min-h-0 max-w-[1700px] w-full mx-auto px-5 pb-5 pt-4 grid grid-cols-1 lg:grid-cols-[1fr_370px] gap-4">
        <div className="min-h-0 overflow-auto border rounded-lg bg-card">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-foreground text-background">
                {["#", "Tipo", "Cliente", "Teléfono", "Dirección original", "Conductor", "Estado", "Alternativa"].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr><td colSpan={8} className="p-0">
                  <EmptyState
                    icon={MousePointerClick}
                    title={casos.length ? "Sin casos para este filtro" : "Sin casos cargados"}
                    description={casos.length
                      ? "Probá con otro filtro."
                      : "Usá “Importar lista” para pegar los casos desde la planilla, o “Agregar caso” para cargar uno suelto."}
                  />
                </td></tr>
              ) : visibles.map((c, i) => {
                const tipo = TIPO_INFO[c.tipo], est = ESTADO_INFO[c.estado];
                const finalizado = c.estado === "impreso" || c.estado === "cerrado";
                return (
                  <tr key={c.id} onClick={() => setSelId(c.id)}
                    className={cn("border-b cursor-pointer transition-colors hover:bg-muted/50",
                      c.id === selId && "bg-orange-50 dark:bg-orange-950/30 shadow-[inset_3px_0_0_theme(colors.orange.500)]",
                      finalizado && "opacity-50")}>
                    <td className="px-2.5 py-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2.5 py-2">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap", tipo.clase)}>{tipo.label}</span>
                    </td>
                    <td className="px-2.5 py-2 text-sm font-bold">{c.cliente}</td>
                    <td className="px-2.5 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {formatearTelefono(c.telefono) || "—"}
                    </td>
                    <td className="px-2.5 py-2 text-xs max-w-[220px] truncate" title={c.direccion ?? ""}>
                      {c.direccion || "—"}
                    </td>
                    <td className="px-2.5 py-2 text-xs">
                      {c.chofer || "—"}
                      {c.codigo && <span className="text-muted-foreground"> · {c.codigo}</span>}
                    </td>
                    <td className="px-2.5 py-2">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap", est.clase)}>{est.label}</span>
                    </td>
                    <td className="px-2.5 py-2 text-xs">
                      {c.alternativa
                        ? <span className="text-emerald-700 dark:text-emerald-300 font-bold">{c.alternativa}</span>
                        : <span className="text-muted-foreground">{c.tipo === "demora" ? "n/a" : "—"}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detalle */}
        <div className="min-h-0 border rounded-lg bg-card overflow-hidden hidden lg:block">
          {seleccionado ? (
            <AlternativasDrawer
              caso={seleccionado}
              puedeEditar={puedeEditar}
              recorridos={recorridos}
              conductores={conductores}
              onGuardarDatos={guardarDatos}
              onGuardarRespuesta={guardarRespuestaCaso}
              onEnviar={abrirWhatsApp}
              onEstado={cambiarEstado}
              onImprimir={imprimirUna}
              onEliminar={eliminar}
            />
          ) : (
            <EmptyState
              icon={MousePointerClick}
              title="Elegí un caso"
              description="Seleccioná una fila para ver el mensaje, enviarlo o cargar la alternativa que dio el cliente."
            />
          )}
        </div>
      </div>

      {/* ── Modales ── */}
      {modalImportar && (
        <ImportarModal
          onClose={() => setModalImportar(false)}
          onImportar={async (tipo, filas) => {
            const r = await importarAlternativas(fecha, tipo, filas);
            if (!r.ok) { toast.error(r.error ?? "No se pudo importar"); return; }
            setModalImportar(false);
            toast.success(
              `${r.agregados} caso(s) importados` +
              (r.omitidos ? ` · ${r.omitidos} omitido(s) por estar ya cargados` : "")
            );
            cargar(fecha);
          }}
        />
      )}

      {modalManual && (
        <ManualModal
          conductores={conductores}
          onClose={() => setModalManual(false)}
          onAgregar={async (tipo, f) => {
            const r = await upsertAlternativa(null, fecha, tipo, f.cliente, f.telefono, f.direccion, null, f.chofer);
            if (!r.ok) { toast.error(r.error ?? "No se pudo agregar"); return; }
            setModalManual(false);
            cargar(fecha);
          }}
        />
      )}

      {cola && (
        <SecuencialModal
          cola={cola}
          onClose={() => { setCola(null); cargar(fecha); }}
          onEnviar={abrirWhatsApp}
        />
      )}

      {modalImprimir && (
        <ImprimirModal
          casos={listasParaImprimir}
          onClose={() => setModalImprimir(false)}
          onImprimir={imprimir}
        />
      )}
    </div>
  );
}
