import { redirect } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { getPerfilActual } from "@/lib/perfil";
import { primeraSolapa } from "@/lib/permisos";
import { EMPRESA } from "@/lib/marca";

/**
 * Sala de espera.
 *
 * Cualquiera puede registrarse, pero hasta que el administrador no le asigna
 * una empresa no hay un solo dato que pueda ver. En vez de dejarlo en una
 * pantalla vacía o rebotándolo al login —que parecería un error—, cae acá y se
 * le explica qué está pasando.
 */
export default async function BienvenidaPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");

  // Si mientras tanto lo habilitaron, que entre directo a trabajar.
  const destino = primeraSolapa(perfil);
  if (destino) redirect(destino);

  const rechazado = perfil.estado === "rechazado";
  const empresaDeBaja = perfil.estado === "activo" && perfil.empresa && !perfil.empresa.activa;

  return (
    <div className="h-full w-full grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center">
          {rechazado
            ? <XCircle className="h-7 w-7 text-destructive" />
            : <Clock className="h-7 w-7 text-muted-foreground" />}
        </div>

        {rechazado ? (
          <>
            <h1 className="text-2xl font-black tracking-tight">No se habilitó tu cuenta</h1>
            <p className="text-sm text-muted-foreground">
              Tu solicitud de acceso fue rechazada. Si creés que es un error,
              escribinos y la revisamos.
            </p>
          </>
        ) : empresaDeBaja ? (
          <>
            <h1 className="text-2xl font-black tracking-tight">Cuenta suspendida</h1>
            <p className="text-sm text-muted-foreground">
              El acceso de {perfil.empresa?.nombre} está pausado. Tus datos siguen
              guardados: en cuanto se reactive, vas a entrar como siempre.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-tight">Tu cuenta está en revisión</h1>
            <p className="text-sm text-muted-foreground">
              Ya creamos tu usuario, <strong>{perfil.nombre}</strong>. Falta que
              te asignemos a tu empresa y activemos tu plan. Te avisamos apenas
              esté listo.
            </p>
            <p className="text-xs text-muted-foreground">
              Si alguien de tu equipo ya usa {EMPRESA}, pedile que te sume desde
              su panel de usuarios.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
