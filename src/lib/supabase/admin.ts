import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente con service_role (solo servidor). Salta RLS y permite usar la Admin API
 * de Auth (crear usuarios sin confirmación de email). NUNCA importar desde el cliente.
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el entorno.
 */
export function createAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
