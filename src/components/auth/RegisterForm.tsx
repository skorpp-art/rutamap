"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { BotonGoogle } from "./BotonGoogle";

const registroSchema = z.object({
  nombre: z.string().min(2, "Poné tu nombre"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type RegistroValues = z.infer<typeof registroSchema>;

/**
 * Alta de cuenta.
 *
 * Cualquiera puede crearse una, pero no ve nada hasta que el administrador le
 * asigna una empresa: el trigger de la base crea el perfil en estado
 * "pendiente". Por eso el texto no promete acceso inmediato — prometerlo y
 * después mostrar una pantalla vacía se siente como un error de la app.
 */
export function RegisterForm() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegistroValues>({
    resolver: zodResolver(registroSchema),
  });

  async function onSubmit(values: RegistroValues) {
    setCargando(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: { data: { nombre: values.nombre.trim() } },
    });

    setCargando(false);

    if (error) {
      toast.error("No se pudo crear la cuenta", { description: error.message });
      return;
    }

    // Si el proyecto pide confirmar el mail, todavía no hay sesión.
    if (!data.session) {
      toast.success("Revisá tu correo para confirmar la cuenta");
      router.push("/login");
      return;
    }

    router.push("/bienvenida");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Crear cuenta</CardTitle>
        <CardDescription>
          Creás tu usuario y nosotros lo habilitamos con tu empresa y tu plan.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form id="registro-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre y apellido</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="nombre" className="pl-9" placeholder="Juan Pérez"
                autoComplete="name" {...register("nombre")} />
            </div>
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" className="pl-9" placeholder="vos@empresa.com"
                autoComplete="email" {...register("email")} />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type={verPassword ? "text" : "password"}
                className="pl-9 pr-9" autoComplete="new-password" {...register("password")} />
              <button type="button" onClick={() => setVerPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <Button type="submit" form="registro-form" className="w-full" disabled={cargando}>
          {cargando && <Loader2 className="animate-spin" />}
          Crear cuenta
        </Button>

        <div className="flex items-center gap-2 w-full">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground px-1">o</span>
          <Separator className="flex-1" />
        </div>
        <BotonGoogle next="/bienvenida" />

        <p className="text-sm text-muted-foreground text-center">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
