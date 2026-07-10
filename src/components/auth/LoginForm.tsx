"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Map as MapIcon, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
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
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginValues) {
    setCargando(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : "Error al iniciar sesión. Intentá de nuevo."
      );
      setCargando(false);
      return;
    }

    toast.success("Sesión iniciada");
    router.push("/");
    router.refresh();
  }

  function abrirRecuperar() {
    setEmailRecuperar(getValues("email") ?? "");
    setLinkEnviado(false);
    setModoRecuperar(true);
  }

  async function enviarRecuperacion() {
    if (!emailRecuperar.includes("@")) { toast.error("Ingresá un email válido"); return; }
    setEnviandoRecuperar(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperar.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/actualizar-password`,
      });
      if (error) { toast.error("No se pudo enviar el email", { description: error.message }); return; }
      setLinkEnviado(true);
    } finally { setEnviandoRecuperar(false); }
  }

  if (modoRecuperar) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1">
          <button onClick={() => setModoRecuperar(false)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
          </button>
          <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            {linkEnviado
              ? "Revisá tu email — te enviamos un link para elegir una contraseña nueva."
              : "Ingresá tu email y te mandamos un link para restablecerla."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!linkEnviado ? (
            <div className="space-y-2">
              <Label htmlFor="email-recuperar">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email-recuperar"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-9"
                  autoComplete="email"
                  autoFocus
                  value={emailRecuperar}
                  onChange={e => setEmailRecuperar(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") enviarRecuperacion(); }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
              Listo — si {emailRecuperar} tiene una cuenta, va a recibir el link en unos minutos.
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!linkEnviado ? (
            <Button className="w-full" disabled={enviandoRecuperar} onClick={enviarRecuperacion}>
              {enviandoRecuperar && <Loader2 className="animate-spin" />}
              Enviar link de recuperación
            </Button>
          ) : (
            <Button className="w-full" variant="outline" onClick={() => setModoRecuperar(false)}>
              Volver a iniciar sesión
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        <CardDescription>
          Ingresá con tu cuenta de RutaMap para acceder al mapa.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Formulario email/password */}
        <form id="login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                className="pl-9"
                autoComplete="email"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <button type="button" onClick={abrirRecuperar}
                className="text-xs text-primary hover:underline font-medium">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={verPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-9 pr-9"
                autoComplete="current-password"
                {...register("password")}
              />
              <button type="button" onClick={() => setVerPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <Button
          type="submit"
          form="login-form"
          className="w-full"
          disabled={cargando}
        >
          {cargando && <Loader2 className="animate-spin" />}
          Ingresar
        </Button>

        {/* Acceso de invitado al mapa (sin cuenta) */}
        <div className="flex items-center gap-2 w-full">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground px-1">o</span>
          <Separator className="flex-1" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => router.push("/")}
        >
          <MapIcon className="h-4 w-4" />
          Ver mapas como invitado
        </Button>

        <p className="text-sm text-muted-foreground text-center">
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="text-primary font-medium hover:underline">
            Registrate
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
