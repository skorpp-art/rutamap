import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Cliente sin tipar para las tablas del depósito.
 *
 * El tipo `Database` de este proyecto se mantiene a mano y supabase-js no logra
 * inferir las filas a partir de él: por eso el resto de la app declara el tipo
 * en cada consulta (`.single<T>()`) o castea el cliente para las RPC. Acá se
 * hace lo mismo una sola vez, y las filas se tipan con las interfaces de
 * `@/types/deposito.types` en lugar de repetir el cast en cada pantalla.
 */
export function depositoClient(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}
