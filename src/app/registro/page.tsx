import { Truck } from "lucide-react";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegistroPage() {
  return (
    <main className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-brand-blue rounded-xl p-3">
          <Truck className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Ruta<span className="text-brand-sky">Map</span>
          </h1>
          <p className="text-xs text-white/40 -mt-0.5">Logística Hogareño</p>
        </div>
      </div>

      <RegisterForm />
    </main>
  );
}
