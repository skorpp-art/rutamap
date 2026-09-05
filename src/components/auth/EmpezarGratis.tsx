"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { crearEmpresaFree } from "@/app/actions/empresa";

/**
 * "Empezar gratis": la vía rápida para probar RutaMap sin esperar a que el
 * superadmin apruebe nada. Crea la empresa de la persona con plan Free y la
 * deja usando la app en el mismo clic.
 *
 * Vive en /bienvenida (no en el registro) porque el registro no sabe todavía
 * si la persona quiere sumarse a una empresa existente (esperando aprobación)
 * o arrancar la suya — acá, ya con la cuenta creada, elige.
 */
export function EmpezarGratis() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  async function empezar() {
    if (!nombre.trim()) return toast.error("Poné el nombre de tu empresa");
    setCargando(true);
    const r = await crearEmpresaFree(nombre.trim());
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("¡Listo! Ya podés usar RutaMap");
    router.push("/");
    router.refresh();
  }

  if (!abierto) {
    return (
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2 w-full">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground px-1">o</span>
          <Separator className="flex-1" />
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={() => setAbierto(true)}>
          <Rocket className="h-4 w-4" />
          Empezar gratis con mi propia empresa
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Sin tarjeta. Arrancás al toque con el plan Free.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-3 text-left">
      <div>
        <Label htmlFor="nombre-empresa">Nombre de tu empresa</Label>
        <Input id="nombre-empresa" value={nombre} autoFocus
          placeholder="Mi Logística SRL"
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") empezar(); }} />
      </div>
      <Button className="w-full" onClick={empezar} disabled={cargando}>
        {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
        Crear mi empresa y entrar
      </Button>
    </div>
  );
}
