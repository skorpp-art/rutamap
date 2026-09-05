"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Entrar con Google.
 *
 * No distingue entre "registrarse" e "iniciar sesión": si la cuenta no existe,
 * Supabase la crea y el trigger de la base le arma el perfil en estado
 * pendiente. O sea que la primera vez funciona como alta y las siguientes como
 * login, sin que la persona tenga que elegir.
 */
export function BotonGoogle({ next = "/" }: { next?: string }) {
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // El callback ya existente cambia el código por la sesión y manda a
        // destino. Tiene que ser una URL absoluta porque el que redirige es
        // Google, no la app.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setCargando(false);
      toast.error("No se pudo abrir Google", { description: error.message });
    }
    // Si salió bien no hace falta apagar el spinner: el navegador ya se está
    // yendo a Google.
  }

  return (
    <Button type="button" variant="outline" className="w-full gap-2"
      onClick={entrar} disabled={cargando}>
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      Continuar con Google
    </Button>
  );
}
