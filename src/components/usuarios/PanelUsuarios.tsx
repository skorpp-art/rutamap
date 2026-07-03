"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Users, RefreshCw, ShieldCheck, Eye, Pencil } from "lucide-react";
import { getUsuarios, setRolUsuario, ROLES, type UsuarioAdmin, type Rol } from "@/app/actions/usuarios";
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

export function PanelUsuarios({ usuarioActualId }: { usuarioActualId: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
          <Users className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Usuarios</h1>
          <p className="text-xs text-muted-foreground">
            Las cuentas nuevas entran como <span className="font-medium">Asesor comercial</span> (solo lectura) hasta que les asignes un rol.
          </p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
        </button>
      </div>

      {/* Referencia de roles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ROLES.map(r => (
          <div key={r} className="border rounded-xl px-3 py-2 bg-card flex items-start gap-2">
            {ROL_INFO[r].edita
              ? <Pencil className="h-3.5 w-3.5 mt-0.5 text-emerald-600 dark:text-emerald-300 shrink-0" />
              : <Eye className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />}
            <div>
              <p className="text-xs font-semibold">{ROL_INFO[r].label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{ROL_INFO[r].desc}</p>
            </div>
          </div>
        ))}
      </div>

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
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs w-48">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map(u => {
                const esYo = u.id === usuarioActualId;
                return (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Para dar de alta a alguien: pedile que se registre en /registro con su email — va a entrar
        como solo-lectura y desde acá le asignás el rol que corresponda. Tu propio rol no se puede
        cambiar desde este panel (evita que te quedes sin acceso maestro).
      </p>
    </div>
  );
}
