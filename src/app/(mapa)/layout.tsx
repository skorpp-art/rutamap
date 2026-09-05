import { getPerfilActual } from "@/lib/perfil";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { BannerDemo } from "@/components/layout/BannerDemo";

export default async function MapaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El perfil trae también la empresa y sus módulos: la barra lateral los
  // necesita para saber qué solapas mostrar. Cada page.tsx redirige al login
  // si no hay sesión.
  const perfil = await getPerfilActual();

  return (
    <div className="flex h-full">
      <Sidebar perfil={perfil} />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <BannerDemo />
        <Header perfil={perfil} />
        <main className="flex-1 overflow-hidden bg-muted/40">{children}</main>
      </div>
      <CommandPalette perfil={perfil} />
    </div>
  );
}
