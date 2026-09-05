import { LoginForm } from "@/components/auth/LoginForm";
import { PanelMarketing } from "@/components/auth/PanelMarketing";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex bg-background">
      <PanelMarketing />
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden bg-brand-black lg:bg-background">
        {/* En mobile no hay panel izquierdo, así que este costado hereda el
            fondo oscuro y el resplandor para no perder la identidad visual. */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-brand-blue/25 blur-[120px] lg:hidden" />
        <div className="relative animate-fade-up">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
