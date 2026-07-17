import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Solo estas rutas requieren sesión. Todo lo demás (incluido el mapa "/") es público.
const RUTAS_PROTEGIDAS = ["/volumenes", "/usuarios", "/pendientes"];
const RUTAS_AUTH = ["/login", "/registro"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const esRutaProtegida = RUTAS_PROTEGIDAS.some((r) => path.startsWith(r));
  const esRutaAuth = RUTAS_AUTH.some((r) => path.startsWith(r));

  // Rutas públicas (no protegidas ni de auth): no hace falta resolver la sesión
  if (!esRutaProtegida && !esRutaAuth) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  type SetOptions = Parameters<(typeof supabaseResponse)["cookies"]["set"]>[2];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: SetOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar sesión — IMPORTANTE: no agregar lógica entre createServerClient y getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión en una ruta protegida (volúmenes) → redirigir a login
  if (!user && esRutaProtegida) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path); // recordar a dónde quería ir
    return NextResponse.redirect(url);
  }

  // Con sesión en página de login/registro → ir al mapa
  if (user && esRutaAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Todo lo demás (mapa "/") es público — invitados pueden ver
  return supabaseResponse;
}

export const config = {
  // El middleware SOLO corre en las rutas que necesitan resolver sesión
  // (protegidas + auth). Todo lo demás —mapa público, /sw.js, estáticos,
  // payloads RSC— no lo invoca: menos ejecuciones y menos exposición a
  // fallas de provisioning del edge runtime.
  matcher: [
    "/volumenes/:path*",
    "/usuarios/:path*",
    "/pendientes/:path*",
    "/login/:path*",
    "/registro/:path*",
  ],
};
