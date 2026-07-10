"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users, RefreshCw, ShieldCheck, Eye, EyeOff, Pencil, UserPlus, Loader2,
  SlidersHorizontal, ChevronDown, ChevronRight, KeyRound, X,
} from "lucide-react";
import { getUsuarios, setRolUsuario, setPermisosUsuario, setPasswordUsuario, crearUsuario, type UsuarioAdmin } from "@/app/actions/usuarios";
import { ROLES, type Rol } from "@/lib/roles";
import { SOLAPAS } from "@/lib/permisos";
import { EmptyState } from "@/components/ui/empty-state";

// Qué puede hacer cada rol — mostrado como referencia en el panel
const ROL_INFO: Record<Rol, { label: string; desc: string; edita: boolean; badge: string }> = {
  maestro: {
    label: "Maestro", edita: true,
    desc: "Control total: edita todo y administra usuarios",
    badge: "bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  supervisor: {
    label: "Supervisor", edita: true,
    desc: "Ve todo y edita mapa, operación y análisis",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  coordinador: {
    label: "Coordinador", edita: true,
    desc: "Ve todo y edita mapa, operación y análisis",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  gerencia: {
    label: "Gerencia", edita: false,
    desc: "Ve todos los datos y dashboards, sin edición",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  asesor: {
    label: "Asesor comercial", edita: false,
    desc: "Ve todos los datos y dashboards, sin edición",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  },
};

const TODAS_LAS_SOLAPAS = SOLAPAS.map(s => s.key as string);

export function PanelUsuarios({ usuarioActualId }: { usuarioActualId: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [permisosAbierto, setPermisosAbierto] = useState<string | null>(null);
  // Modal "cambiar contraseña" (no existe forma de VER la actual — solo resetear)
  const [modalPass, setModalPass] = useState<{ id: string; nombre: string } | null>(null);
  const [nuevaPassUsuario, setNuevaPassUsuario] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);
  // Formulario "crear usuario"
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevaPass, setNuevaPass] = useState("");
  const [nuevoRol, setNuevoRol] = useState<Rol>("coordinador");
  const [nuevasSolapas, setNuevasSolapas] = useState<string[]>(TODAS_LAS_SOLAPAS);
  const [nuevoEdita, setNuevoEdita] = useState(true);
  const [creando, setCreando] = useState(false);

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    if (nuevoNombre.trim().length < 2) { toast.error("Ingresá un nombre"); return; }
    if (!nuevoEmail.includes("@")) { toast.error("Email inválido"); return; }
    if (nuevaPass.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    if (nuevasSolapas.length === 0) { toast.error("Elegí al menos una solapa"); return; }
    setCreando(true);
    try {
      // Si tiene todas las solapas, guardamos null (sin restricción)
      const solapas = nuevasSolapas.length === TODAS_LAS_SOLAPAS.length ? null : nuevasSolapas;
      const res = await crearUsuario(nuevoNombre, nuevoEmail, nuevaPass, nuevoRol, solapas, nuevoEdita);
      if (!res.ok) { toast.error("No se pudo crear la cuenta", { description: res.error }); return; }
      toast.success(`Cuenta creada para ${nuevoNombre} (${ROL_INFO[nuevoRol].label})`);
      setNuevoNombre(""); setNuevoEmail(""); setNuevaPass(""); setNuevoRol("coordinador");
      setNuevasSolapas(TODAS_LAS_SOLAPAS); setNuevoEdita(true);
      await cargar();
    } finally { setCreando(false); }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getUsuarios();
      if (!res.ok) { toast.error("Error al cargar usuarios", { description: res.error }); return; }
      setUsuarios(res.data ?? []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarRol(u: UsuarioAdmin, rol: Rol) {
    if (rol === u.rol) return;
    setGuardandoId(u.id);
    try {
      const res = await setRolUsuario(u.id, rol);
      if (!res.ok) { toast.error("No se pudo cambiar el rol", { description: res.error }); return; }
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, rol } : x));
      toast.success(`${u.nombre} ahora es ${ROL_INFO[rol].label}`);
    } finally { setGuardandoId(null); }
  }

  // Solapas efectivas de un usuario (null = todas)
  const solapasDe = (u: UsuarioAdmin) => u.solapas ?? TODAS_LAS_SOLAPAS;
  const editaDe = (u: UsuarioAdmin) => u.puede_editar ?? ROL_INFO[u.rol].edita;

  async function guardarPermisos(u: UsuarioAdmin, solapas: string[], edita: boolean) {
    setGuardandoId(u.id);
    try {
      const solapasGuardar = solapas.length === TODAS_LAS_SOLAPAS.length ? null : solapas;
      const res = await setPermisosUsuario(u.id, solapasGuardar, edita);
      if (!res.ok) { toast.error("No se pudieron guardar los permisos", { description: res.error }); return; }
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, solapas: solapasGuardar, puede_editar: edita } : x));
    } finally { setGuardandoId(null); }
  }

  function abrirModalPass(u: UsuarioAdmin) {
    setNuevaPassUsuario(""); setVerPass(false);
    setModalPass({ id: u.id, nombre: u.nombre });
  }

  async function confirmarNuevaPass() {
    if (!modalPass) return;
    if (nuevaPassUsuario.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    setGuardandoPass(true);
    try {
      const res = await setPasswordUsuario(modalPass.id, nuevaPassUsuario);
      if (!res.ok) { toast.error("No se pudo cambiar la contraseña", { description: res.error }); return; }
      toast.success(`Contraseña actualizada para ${modalPass.nombre}`, {
        description: "Pasale la contraseña nueva por un medio seguro.",
      });
      setModalPass(null); setNuevaPassUsuario("");
    } finally { setGuardandoPass(false); }
  }

  function toggleSolapaUsuario(u: UsuarioAdmin, key: string) {
    const actuales = solapasDe(u);
    const nuevas = actuales.includes(key) ? actuales.filter(s => s !== key) : [...actuales, key];
    if (nuevas.length === 0) { toast.error("Tiene que quedar al menos una solapa"); return; }
    guardarPermisos(u, nuevas, editaDe(u));
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
          <Users className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Usuarios</h1>
          <p className="text-xs text-muted-foreground">
            Creá cuentas y elegí, por persona, qué solapas ve y si puede editar.
          </p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
        </button>
      </div>

      {/* Crear cuenta directamente (recomendado para uso interno) */}
      <form onSubmit={onCrear} className="border rounded-xl p-4 bg-card space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-300" /> Crear cuenta
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
            placeholder="Nombre completo" autoComplete="off"
            className="text-sm border rounded-lg px-3 py-2 bg-background" />
          <input value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)}
            placeholder="Email" type="email" autoComplete="off"
            className="text-sm border rounded-lg px-3 py-2 bg-background" />
          <input value={nuevaPass} onChange={e => setNuevaPass(e.target.value)}
            placeholder="Contraseña (mín. 6)" type="text" autoComplete="new-password"
            className="text-sm border rounded-lg px-3 py-2 bg-background" />
          <select value={nuevoRol} onChange={e => { const r = e.target.value as Rol; setNuevoRol(r); setNuevoEdita(ROL_INFO[r].edita); }}
            className="text-sm border rounded-lg px-3 py-2 bg-background">
            {ROLES.map(r => <option key={r} value={r}>{ROL_INFO[r].label}</option>)}
          </select>
        </div>

        {/* Permisos de la cuenta nueva */}
        <div className="flex items-center gap-2 flex-wrap border rounded-lg px-3 py-2 bg-muted/20">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">Solapas:</span>
          {SOLAPAS.map(s => (
            <label key={s.key} className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors",
              nuevasSolapas.includes(s.key)
                ? "bg-blue-600/10 border-blue-400 text-blue-700 dark:text-blue-300 font-medium"
                : "border-border text-muted-foreground")}>
              <input type="checkbox" className="hidden"
                checked={nuevasSolapas.includes(s.key)}
                onChange={() => setNuevasSolapas(prev =>
                  prev.includes(s.key) ? prev.filter(x => x !== s.key) : [...prev, s.key])} />
              {s.label}
            </label>
          ))}
          <label className={cn("inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border cursor-pointer ml-auto transition-colors",
            nuevoEdita
              ? "bg-emerald-500/10 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-medium"
              : "border-border text-muted-foreground")}>
            <input type="checkbox" className="hidden" checked={nuevoEdita} onChange={() => setNuevoEdita(!nuevoEdita)} />
            {nuevoEdita ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {nuevoEdita ? "Puede editar" : "Solo lectura"}
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            La cuenta queda lista para usar (sin confirmación de mail). Pasale el email y la contraseña a la persona.
          </p>
          <button type="submit" disabled={creando}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-60 shrink-0">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Crear
          </button>
        </div>
      </form>

      {/* Tabla de usuarios */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        {cargando && usuarios.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando usuarios…</div>
        ) : usuarios.length === 0 ? (
          <div className="p-6"><EmptyState icon={Users} title="Sin usuarios" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Usuario</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Email</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Último ingreso</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs w-44">Rol</th>
                <th className="w-28 px-3 py-2 font-medium text-muted-foreground text-xs text-center">Permisos</th>
                <th className="w-16 px-3 py-2 font-medium text-muted-foreground text-xs text-center">Clave</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map(u => {
                const esYo = u.id === usuarioActualId;
                const esMaestro = u.rol === "maestro";
                const abierto = permisosAbierto === u.id;
                const solapasU = solapasDe(u);
                const editaU = editaDe(u);
                return (
                  <>
                    <tr key={u.id} className={cn(esYo && "bg-blue-50/40 dark:bg-blue-950/20")}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{u.nombre}</span>
                        {esYo && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600/15 text-blue-700 dark:text-blue-300">vos</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.email}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {u.ultimo_login
                          ? new Date(u.ultimo_login).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "nunca"}
                      </td>
                      <td className="px-4 py-2.5">
                        {esYo ? (
                          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border", ROL_INFO[u.rol].badge)}>
                            <ShieldCheck className="h-3 w-3" />{ROL_INFO[u.rol].label}
                          </span>
                        ) : (
                          <select
                            value={u.rol}
                            disabled={guardandoId === u.id}
                            onChange={e => cambiarRol(u, e.target.value as Rol)}
                            className="text-xs border rounded-lg px-2 py-1.5 bg-background w-full disabled:opacity-50"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{ROL_INFO[r].label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {esYo || esMaestro ? (
                          <span className="text-[10px] text-muted-foreground">{esMaestro ? "todo" : "—"}</span>
                        ) : (
                          <button onClick={() => setPermisosAbierto(abierto ? null : u.id)}
                            className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-colors",
                              abierto ? "bg-blue-600/10 border-blue-400 text-blue-700 dark:text-blue-300" : "border-border text-muted-foreground hover:bg-muted")}>
                            <SlidersHorizontal className="h-3 w-3" />
                            {u.solapas ? `${solapasU.length}/${TODAS_LAS_SOLAPAS.length}` : "todas"}
                            {abierto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => abrirModalPass(u)} title="Cambiar contraseña"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {abierto && !esYo && !esMaestro && (
                      <tr key={`${u.id}-permisos`} className="bg-muted/10">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">Solapas:</span>
                            {SOLAPAS.map(s => (
                              <label key={s.key} className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors",
                                solapasU.includes(s.key)
                                  ? "bg-blue-600/10 border-blue-400 text-blue-700 dark:text-blue-300 font-medium"
                                  : "border-border text-muted-foreground",
                                guardandoId === u.id && "opacity-50 pointer-events-none")}>
                                <input type="checkbox" className="hidden"
                                  checked={solapasU.includes(s.key)}
                                  onChange={() => toggleSolapaUsuario(u, s.key)} />
                                {s.label}
                              </label>
                            ))}
                            <label className={cn("inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border cursor-pointer ml-auto transition-colors",
                              editaU
                                ? "bg-emerald-500/10 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-medium"
                                : "border-border text-muted-foreground",
                              guardandoId === u.id && "opacity-50 pointer-events-none")}>
                              <input type="checkbox" className="hidden" checked={editaU}
                                onChange={() => guardarPermisos(u, solapasU, !editaU)} />
                              {editaU ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {editaU ? "Puede editar" : "Solo lectura"}
                            </label>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Los cambios se guardan al instante. La persona los ve al recargar la página.
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        El maestro siempre ve y edita todo. Tu propio rol y permisos no se pueden cambiar desde este
        panel (evita que te quedes sin acceso maestro).
      </p>

      {/* Modal: cambiar contraseña — no existe forma de ver la actual, solo resetear */}
      {modalPass && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setModalPass(null)}>
          <div className="bg-background border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 shrink-0">
                <KeyRound className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">Cambiar contraseña</p>
                <p className="text-xs text-muted-foreground truncate">{modalPass.nombre}</p>
              </div>
              <button onClick={() => setModalPass(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              No es posible ver la contraseña actual (queda guardada de forma irreversible, por seguridad).
              Esto establece una contraseña nueva — la persona va a tener que usar esta a partir de ahora.
            </p>

            <div className="relative">
              <input
                type={verPass ? "text" : "password"}
                value={nuevaPassUsuario}
                onChange={e => setNuevaPassUsuario(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmarNuevaPass(); }}
                placeholder="Contraseña nueva (mín. 6 caracteres)"
                autoComplete="new-password"
                autoFocus
                className="w-full text-sm border rounded-lg pl-3 pr-9 py-2.5 bg-background"
              />
              <button type="button" onClick={() => setVerPass(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={verPass ? "Ocultar" : "Mostrar"}>
                {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalPass(null)}
                className="flex-1 h-9 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarNuevaPass} disabled={guardandoPass || nuevaPassUsuario.length < 6}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors">
                {guardandoPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
