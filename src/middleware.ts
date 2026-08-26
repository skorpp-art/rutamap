import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Todas las secciones requieren sesión: al sacar el mapa, la app dejó de tener
// pantallas públicas. La raíz se compara aparte porque con startsWith
// coincidiría con cualquier ruta.
const RUTAS_PROTEGIDAS = ["/pendientes", "/alternativas", "/deposito", "/ruta", "/usuarios", "/descargar"];
const RUTAS_AUTH = ["/login", "/registro"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const esRutaProtegida = path === "/" || RUTAS_PROTEGIDAS.some((r) => path.startsWith(r));
  const esRutaAuth = RUTAS_AUTH.some((r) => path.startsWith(r));

  // Recursos que no son secciones (estáticos, service worker): sin sesión
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

  // Sin sesión en una sección → al login, recordando a dónde iba
  if (!user && esRutaProtegida) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path); // recordar a dónde quería ir
    return NextResponse.redirect(url);
  }

  // Con sesión en login/registro → a la app
  if (user && esRutaAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // El middleware SOLO corre en las rutas que necesitan resolver sesión
  // (las secciones + auth). Los estáticos, /sw.js y los payloads RSC no lo
  // invocan: menos ejecuciones y menos exposición a fallas del edge runtime.
  matcher: [
    "/",
    "/pendientes/:path*",
    "/alternativas/:path*",
    "/deposito/:path*",
    "/ruta/:path*",
    "/usuarios/:path*",
    "/descargar/:path*",
    "/login/:path*",
    "/registro/:path*",
  ],
};
