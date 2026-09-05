"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Upload } from "lucide-react";
import { subirLogoEmpresa, renombrarEmpresa } from "@/app/actions/empresa-branding";

/**
 * Lo que ve el maestro para personalizar su empresa: logo y nombre visible.
 * Sólo él puede tocar esto (verificado también en la base, no sólo acá).
 */
export function MiEmpresaCard({
  nombreInicial, logoInicial,
}: { nombreInicial: string; logoInicial: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(logoInicial);
  const [subiendo, setSubiendo] = useState(false);
  const [nombre, setNombre] = useState(nombreInicial);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [guardandoNombre, setGuardandoNombre] = useState(false);

  async function elegirLogo(archivo: File) {
    setSubiendo(true);
    const fd = new FormData();
    fd.set("logo", archivo);
    const r = await subirLogoEmpresa(fd);
    setSubiendo(false);
    if (!r.ok) return toast.error(r.error);
    setLogo(r.data);
    toast.success("Logo actualizado");
  }

  async function guardarNombre() {
    if (!nombre.trim()) return toast.error("El nombre no puede quedar vacío");
    setGuardandoNombre(true);
    const r = await renombrarEmpresa(nombre.trim());
    setGuardandoNombre(false);
    if (!r.ok) return toast.error(r.error);
    setEditandoNombre(false);
    toast.success("Nombre actualizado");
  }

  return (
    <div className="border rounded-lg p-4 bg-card flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        title="Cambiar logo"
        className="relative h-16 w-16 shrink-0 rounded-lg border border-dashed flex items-center justify-center overflow-hidden bg-muted/40 hover:border-primary/50 transition-colors group"
      >
        {logo ? (
          // El logo lo elige cada empresa: puede venir de cualquier dominio,
          // así que no vale la pena optimizarlo con next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo de la empresa" className="h-full w-full object-contain p-1" />
        ) : (
          <Building2 className="h-6 w-6 text-muted-foreground" />
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {subiendo ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Upload className="h-4 w-4 text-white" />}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) elegirLogo(f);
            e.target.value = "";
          }} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Tu empresa</p>
        {editandoNombre ? (
          <div className="flex items-center gap-2 mt-0.5">
            <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEditandoNombre(false); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm font-semibold w-full max-w-xs" />
            <button onClick={guardarNombre} disabled={guardandoNombre}
              className="text-xs font-medium text-primary hover:underline shrink-0">
              {guardandoNombre ? "Guardando…" : "Guardar"}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditandoNombre(true)}
            className="flex items-center gap-1.5 text-lg font-bold tracking-tight hover:text-primary transition-colors">
            {nombre}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          El logo aparece en la barra lateral de toda tu empresa. PNG, JPG, WEBP o SVG, hasta 2 MB.
        </p>
      </div>
    </div>
  );
}
