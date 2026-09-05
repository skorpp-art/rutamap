"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2, UserPlus, Check, X, Plus, Loader2, Power, PowerOff,
  CreditCard, Pencil, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { StatRow } from "@/components/ui/stat-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SOLAPAS, MODULOS_POR_PLAN, PLANES, type SolapaKey } from "@/lib/permisos";
import {
  getEmpresas, getRegistros, crearEmpresa, actualizarEmpresa,
  habilitarUsuario, rechazarUsuario, getPlanes, actualizarPrecio,
  type EmpresaAdmin, type RegistroAdmin, type PlanAdmin,
} from "@/app/actions/admin";

const PLAN_CLASE: Record<string, string> = {
  bronce: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  plata: "bg-slate-200 text-slate-800 dark:bg-white/10 dark:text-white/70",
  oro: "bg-yellow-100 text-yellow-900 dark:bg-yellow-500/15 dark:text-yellow-300",
};

const ESTADO_PAGO_INFO: Record<string, { label: string; clase: string }> = {
  al_dia: { label: "Al día", clase: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300" },
  vencido: { label: "Pago vencido", clase: "bg-destructive/10 text-destructive" },
  sin_configurar: { label: "Sin suscripción", clase: "bg-muted text-muted-foreground" },
};

function formatearArs(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function slugDesde(nombre: string): string {
  return nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export function PanelAdmin() {
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([]);
  const [registros, setRegistros] = useState<RegistroAdmin[]>([]);
  const [planes, setPlanes] = useState<PlanAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<EmpresaAdmin | null>(null);
  const [alta, setAlta] = useState(false);
  const [habilitando, setHabilitando] = useState<RegistroAdmin | null>(null);
  const [editandoPrecio, setEditandoPrecio] = useState<PlanAdmin | null>(null);

  const cargar = useCallback(async () => {
    const [e, r, p] = await Promise.all([getEmpresas(), getRegistros("pendiente"), getPlanes()]);
    if (e.ok) setEmpresas(e.data); else toast.error(e.error);
    if (r.ok) setRegistros(r.data);
    if (p.ok) setPlanes(p.data);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activas = empresas.filter(e => e.activa).length;
  const usuariosTotales = empresas.reduce((a, e) => a + Number(e.usuarios_activos), 0);

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 space-y-4">
      <PageHeader
        titulo="Administración"
        desc="Las empresas que usan RutaMap, su plan y quién espera acceso."
        meta={`${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`}
      />

      <StatRow
        compact
        stats={[
          { label: "Empresas activas", valor: activas, sub: `${empresas.length - activas} pausadas` },
          { label: "Usuarios activos", valor: usuariosTotales },
          { label: "Esperando acceso", valor: registros.length,
            valorClassName: registros.length > 0 ? "text-amber-600 dark:text-amber-400" : undefined },
        ]}
      />

      {/* ── Registros esperando ──────────────────────────────────────────── */}
      {registros.length > 0 && (
        <section className="rounded-lg border bg-card">
          <div className="px-4 py-2.5 border-b flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Esperando que los habilites</h2>
          </div>
          <ul className="divide-y">
            {registros.map(r => (
              <li key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <Button size="sm" onClick={() => setHabilitando(r)}
                  disabled={empresas.length === 0}
                  title={empresas.length === 0 ? "Creá una empresa primero" : undefined}>
                  <Check className="h-4 w-4" /> Habilitar
                </Button>
                <Button size="sm" variant="outline"
                  onClick={async () => {
                    const res = await rechazarUsuario(r.id);
                    if (!res.ok) return toast.error(res.error);
                    toast.success("Solicitud rechazada");
                    cargar();
                  }}>
                  <X className="h-4 w-4" /> Rechazar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Precios ──────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-card">
        <div className="px-4 py-2.5 border-b flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Precios</h2>
        </div>
        <ul className="divide-y">
          {planes.map(p => (
            <li key={p.nombre} className="px-4 py-3 flex items-center gap-3">
              <span className={cn("px-2 py-0.5 rounded text-xs font-semibold capitalize w-16 text-center", PLAN_CLASE[p.nombre])}>
                {p.nombre}
              </span>
              <span className="text-sm font-medium flex-1">{formatearArs(p.precio_ars)} / mes</span>
              <span className="text-xs text-muted-foreground">
                {p.empresas_con_este_plan} {p.empresas_con_este_plan === 1 ? "empresa" : "empresas"}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setEditandoPrecio(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Empresas ─────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-card">
        <div className="px-4 py-2.5 border-b flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Empresas</h2>
          <Button size="sm" className="ml-auto" onClick={() => setAlta(true)}>
            <Plus className="h-4 w-4" /> Nueva empresa
          </Button>
        </div>

        {cargando ? (
          <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
        ) : empresas.length === 0 ? (
          <EmptyState icon={Building2} title="Todavía no hay empresas"
            description="Creá la primera para poder habilitar usuarios." />
        ) : (
          <ul className="divide-y">
            {empresas.map(e => (
              <li key={e.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {e.nombre}
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold capitalize", PLAN_CLASE[e.plan])}>
                      {e.plan}
                    </span>
                    {!e.activa && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-destructive/10 text-destructive">
                        pausada a mano
                      </span>
                    )}
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1", ESTADO_PAGO_INFO[e.estado_pago].clase)}>
                      {e.estado_pago === "vencido" && <AlertTriangle className="h-3 w-3" />}
                      {ESTADO_PAGO_INFO[e.estado_pago].label}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.usuarios_activos} {Number(e.usuarios_activos) === 1 ? "usuario" : "usuarios"}
                    {" · "}{e.modulos.length} de {SOLAPAS.length} módulos
                    {e.proximo_vencimiento && (
                      <> · próximo cobro {new Date(e.proximo_vencimiento).toLocaleDateString("es-AR")}</>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditando(e)}>
                  Plan y módulos
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editando && (
        <ModalEmpresa empresa={editando} onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar(); }} />
      )}
      {alta && (
        <ModalNuevaEmpresa onCerrar={() => setAlta(false)}
          onCreada={() => { setAlta(false); cargar(); }} />
      )}
      {habilitando && (
        <ModalHabilitar registro={habilitando} empresas={empresas}
          onCerrar={() => setHabilitando(null)}
          onHecho={() => { setHabilitando(null); cargar(); }} />
      )}
      {editandoPrecio && (
        <ModalPrecio plan={editandoPrecio} onCerrar={() => setEditandoPrecio(null)}
          onGuardado={() => { setEditandoPrecio(null); cargar(); }} />
      )}
    </div>
  );
}

/** Selector de módulos: el plan es la plantilla, los tildes son la verdad. */
function SelectorModulos({
  plan, modulos, onPlan, onModulos,
}: {
  plan: string; modulos: string[];
  onPlan: (p: string) => void; onModulos: (m: string[]) => void;
}) {
  const delPlan = MODULOS_POR_PLAN[plan] ?? [];
  const difiereDelPlan =
    modulos.length !== delPlan.length || modulos.some(m => !delPlan.includes(m as SolapaKey));

  return (
    <>
      <div>
        <Label>Plan</Label>
        <div className="flex gap-1 mt-1">
          {PLANES.map(p => (
            <button key={p} type="button"
              onClick={() => { onPlan(p); onModulos([...MODULOS_POR_PLAN[p]]); }}
              className={cn("px-3 h-8 rounded-md text-xs font-medium capitalize transition-colors",
                plan === p ? "bg-primary text-primary-foreground"
                           : "bg-muted text-muted-foreground hover:text-foreground")}>
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Elegir un plan marca sus módulos. Después podés ajustarlos de a uno.
        </p>
      </div>

      <div>
        <Label>Módulos que ve esta empresa</Label>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {SOLAPAS.map(s => {
            const activo = modulos.includes(s.key);
            return (
              <button key={s.key} type="button"
                onClick={() => onModulos(activo ? modulos.filter(m => m !== s.key) : [...modulos, s.key])}
                className={cn("flex items-center gap-2 px-2.5 h-9 rounded-md text-sm text-left transition-colors",
                  activo ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                         : "bg-muted/50 text-muted-foreground hover:text-foreground")}>
                <span className={cn("h-4 w-4 rounded border grid place-items-center shrink-0",
                  activo ? "bg-primary border-primary" : "border-input")}>
                  {activo && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
        {difiereDelPlan && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
            Esta empresa tiene módulos distintos a los que trae el plan {plan}.
          </p>
        )}
      </div>
    </>
  );
}

function ModalEmpresa({
  empresa, onCerrar, onGuardado,
}: { empresa: EmpresaAdmin; onCerrar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(empresa.nombre);
  const [plan, setPlan] = useState<string>(empresa.plan);
  const [modulos, setModulos] = useState<string[]>(empresa.modulos);
  const [activa, setActiva] = useState(empresa.activa);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const r = await actualizarEmpresa(empresa.id, nombre, plan, modulos, activa);
    setGuardando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Empresa actualizada");
    onGuardado();
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogTitle>{empresa.nombre}</DialogTitle>
        <DialogDescription>
          Lo que cambies acá se aplica a todos los usuarios de esta empresa.
        </DialogDescription>

        <div className="space-y-4 mt-3">
          <div>
            <Label htmlFor="e-nombre">Nombre</Label>
            <Input id="e-nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>

          <SelectorModulos plan={plan} modulos={modulos} onPlan={setPlan} onModulos={setModulos} />

          <button type="button" onClick={() => setActiva(a => !a)}
            className={cn("w-full flex items-center gap-2 px-3 h-10 rounded-md text-sm transition-colors",
              activa ? "bg-muted/50 text-muted-foreground hover:text-foreground"
                     : "bg-destructive/10 text-destructive")}>
            {activa ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            {activa ? "Activa — tocá para pausar el acceso" : "Pausada — nadie de esta empresa puede entrar"}
          </button>
          <p className="text-xs text-muted-foreground -mt-2">
            Pausar no borra nada: los datos quedan y vuelven al reactivarla.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalNuevaEmpresa({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: () => void }) {
  const [nombre, setNombre] = useState("");
  const [plan, setPlan] = useState<string>("plata");
  const [modulos, setModulos] = useState<string[]>([...MODULOS_POR_PLAN.plata]);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return toast.error("Falta el nombre");
    setGuardando(true);
    const r = await crearEmpresa(nombre, slugDesde(nombre), plan, modulos);
    setGuardando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${nombre} creada`);
    onCreada();
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogTitle>Nueva empresa</DialogTitle>
        <DialogDescription>
          Después vas a poder asignarle los usuarios que se hayan registrado.
        </DialogDescription>

        <div className="space-y-4 mt-3">
          <div>
            <Label htmlFor="n-nombre">Nombre de la empresa</Label>
            <Input id="n-nombre" value={nombre} autoFocus
              onChange={e => setNombre(e.target.value)} placeholder="Logística del Sur" />
            {nombre.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                Identificador: <code>{slugDesde(nombre)}</code>
              </p>
            )}
          </div>

          <SelectorModulos plan={plan} modulos={modulos} onPlan={setPlan} onModulos={setModulos} />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Crear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalHabilitar({
  registro, empresas, onCerrar, onHecho,
}: {
  registro: RegistroAdmin; empresas: EmpresaAdmin[];
  onCerrar: () => void; onHecho: () => void;
}) {
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [rol, setRol] = useState("maestro");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!empresaId) return toast.error("Elegí una empresa");
    setGuardando(true);
    const r = await habilitarUsuario(registro.id, empresaId, rol);
    setGuardando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${registro.nombre} ya puede entrar`);
    onHecho();
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Habilitar a {registro.nombre}</DialogTitle>
        <DialogDescription>{registro.email}</DialogDescription>

        <div className="space-y-3 mt-3">
          <div>
            <Label htmlFor="h-empresa">Empresa</Label>
            <select id="h-empresa" value={empresaId} onChange={e => setEmpresaId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} ({e.plan})</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="h-rol">Rol dentro de esa empresa</Label>
            <select id="h-rol" value={rol} onChange={e => setRol(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="maestro">Maestro — administra su empresa</option>
              <option value="supervisor">Supervisor</option>
              <option value="coordinador">Coordinador</option>
              <option value="asesor">Asesor</option>
              <option value="gerencia">Gerencia — sólo lectura</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Si es la primera persona de esa empresa, dejalo en maestro: es
              quien después da de alta al resto de su equipo.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Habilitar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalPrecio({
  plan, onCerrar, onGuardado,
}: { plan: PlanAdmin; onCerrar: () => void; onGuardado: () => void }) {
  const [precio, setPrecio] = useState(String(plan.precio_ars));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const n = Number(precio);
    if (!Number.isFinite(n) || n < 0) return toast.error("Precio inválido");
    setGuardando(true);
    const r = await actualizarPrecio(plan.nombre, Math.round(n));
    setGuardando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Precio actualizado");
    onGuardado();
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="capitalize">Precio del plan {plan.nombre}</DialogTitle>
        <DialogDescription>
          Se aplica al próximo cobro de las {plan.empresas_con_este_plan} {plan.empresas_con_este_plan === 1 ? "empresa" : "empresas"} con este plan.
          No cambia lo que ya se cobró.
        </DialogDescription>

        <div className="mt-3">
          <Label htmlFor="p-precio">Precio mensual (ARS)</Label>
          <Input id="p-precio" type="number" min={0} step={1000} value={precio} autoFocus
            onChange={e => setPrecio(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
