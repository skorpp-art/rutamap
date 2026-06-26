import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalisisDiario } from "@/components/volumenes/AnalisisDiario";

export default async function AnalisisDiarioPage() {
  // Análisis del Día es privado — requiere sesión
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/analisis-diario");
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <AnalisisDiario />
    </div>
  );
}
