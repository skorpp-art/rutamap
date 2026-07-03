import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";

export default async function MapaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // NOTA: el mapa "/" es público (invitados pueden ver). La protección de
  // /volumenes se hace en su propia page.tsx + middleware.
  let perfil = null;
  if (user) {
    const { data } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  return (
    <div className="flex h-full">
      <Sidebar perfil={perfil} esInvitado={!user} />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Header perfil={perfil} esInvitado={!user} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <CommandPalette esInvitado={!user} />
    </div>
  );
}
