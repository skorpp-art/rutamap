import { Truck } from "lucide-react";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegistroPage() {
  return (
    <main className="relative min-h-screen bg-brand-black flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Glow ambiental de firma */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-brand-blue/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-brand-violet/20 blur-[120px]" />

      {/* Logo */}
      <div className="relative flex items-center gap-3 mb-8 animate-fade-up">
        <div className="bg-gradient-to-br from-brand-blue to-brand-violet rounded-2xl p-3 shadow-xl ring-1 ring-white/10">
          <Truck className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Ruta<span className="text-brand-sky">Map</span>
          </h1>
          <p className="text-xs text-white/40 -mt-0.5">Logística Hogareño</p>
        </div>
      </div>

      <div className="relative animate-fade-up" style={{ animationDelay: "0.08s" }}>
        <RegisterForm />
      </div>
    </main>
  );
}
