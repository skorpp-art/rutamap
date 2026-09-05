import { RegisterForm } from "@/components/auth/RegisterForm";
import { PanelMarketing } from "@/components/auth/PanelMarketing";

export default function RegistroPage() {
  return (
    <main className="min-h-screen flex bg-background">
      <PanelMarketing />
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden bg-brand-black lg:bg-background">
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-brand-blue/25 blur-[120px] lg:hidden" />
        <div className="relative animate-fade-up">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
