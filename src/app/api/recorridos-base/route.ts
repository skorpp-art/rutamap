import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recorridos")
    .select("id, codigo, nombre, zona, tipo, activo, color")
    .order("zona")
    .order("tipo")
    .order("codigo");

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data ?? []);
}
