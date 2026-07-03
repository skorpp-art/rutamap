"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RegisterForm() {
  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 mb-1">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Cuentas por invitación</CardTitle>
        <CardDescription>
          Las cuentas de RutaMap las crea el administrador de la empresa.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Para tener acceso, pedile al administrador que te cree una cuenta. Te va a
          pasar un email y una contraseña para iniciar sesión.
        </p>
        <p>
          Una vez que tengas tus datos, ingresá desde la pantalla de inicio de sesión.
        </p>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href="/login">Ir a iniciar sesión</Link>
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          ¿Solo querés mirar?{" "}
          <Link href="/" className="text-primary font-medium hover:underline">
            Ver mapas como invitado
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
