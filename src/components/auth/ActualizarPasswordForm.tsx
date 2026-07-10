"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmar: z.string(),
  })
  .refine((data) => data.password === data.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

type Values = z.infer<typeof schema>;

export function ActualizarPasswordForm() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [listo, setListo] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setGuardando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        toast.error("No se pudo actualizar la contraseña", { description: error.message });
        return;
      }
      setListo(true);
      toast.success("Contraseña actualizada");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Elegir nueva contraseña</CardTitle>
        <CardDescription>
          {listo
            ? "Listo, ya podés usar tu cuenta con la nueva contraseña."
            : "Ingresá la nueva contraseña para tu cuenta."}
        </CardDescription>
      </CardHeader>

      {!listo ? (
        <>
          <CardContent>
            <form id="actualizar-password-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={verPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    autoComplete="new-password"
                    autoFocus
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmar"
                    type={verPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9"
                    autoComplete="new-password"
                    {...register("confirmar")}
                  />
                </div>
                {errors.confirmar && (
                  <p className="text-xs text-destructive">{errors.confirmar.message}</p>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button type="submit" form="actualizar-password-form" className="w-full" disabled={guardando}>
              {guardando && <Loader2 className="animate-spin" />}
              Guardar contraseña
            </Button>
          </CardFooter>
        </>
      ) : (
        <CardContent>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
            Redirigiendo al mapa...
          </div>
        </CardContent>
      )}
    </Card>
  );
}
