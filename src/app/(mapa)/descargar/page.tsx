import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { DescargarApp } from "@/components/descargar/DescargarApp";

export default async function DescargarPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/descargar");

  return (
    <div className="h-full w-full overflow-hidden">
      <DescargarApp esMaestro={perfil.rol === "maestro"} />
    </div>
  );
}
