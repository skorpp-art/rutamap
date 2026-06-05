import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VolumenesPanel } from "@/components/volumenes/VolumenesPanel";

export default async function VolumenesPage() {
  // Volúmenes es privado — requiere sesión
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/volumenes");
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <VolumenesPanel />
    </div>
  );
}
