// ─── Mensajes y armado de links de WhatsApp ─────────────────────────────────
// Vive aparte de la UI para poder ajustar los textos sin tocar la pantalla.

export interface DatosMensaje {
  cliente: string;
  direccion?: string | null;
  alternativa?: string | null;
  observacion?: string | null;
}

const EMPRESA = "Logística Hogareño";

/** Vía 1 — no se pudo entregar: se le pide al cliente una alternativa. */
export function msgAlternativa(c: DatosMensaje): string {
  return `Hola ${c.cliente || "cliente"} 👋, te escribimos de *${EMPRESA}*.

Hoy pasamos con tu paquete por *${c.direccion || "tu domicilio"}* pero no pudimos completar la entrega.

Para evitar que vuelva al depósito, necesitamos que nos confirmes una *alternativa de entrega*:

📍 Otra dirección
🏠 Autorización para dejarlo con un vecino
🔒 Dejarlo en portería

¿Cómo procedemos? Respondenos por acá y lo coordinamos para hoy mismo. ¡Gracias! 🙏`;
}

/** Vía 2 — aviso de demora, asegurando la entrega del día. */
export function msgDemora(c: DatosMensaje): string {
  return `Hola ${c.cliente || "cliente"} 👋, te escribimos de *${EMPRESA}*.

Queremos pedirte disculpas por la demora en la entrega de tu paquete en *${c.direccion || "tu domicilio"}*. 🙏

Ya está asignado al móvil de reparto y *te lo estamos entregando hoy*.

Te pedimos que estés atento durante el día. Si en ese horario no vas a estar, avisanos por acá y lo reprogramamos. ¡Gracias por tu paciencia! 📦`;
}

/** Confirmación una vez que el cliente dio la dirección alternativa. */
export function msgConfirmacion(c: DatosMensaje): string {
  return `¡Perfecto ${c.cliente || ""}! ✅

Registramos la entrega alternativa en:
*${c.alternativa || "—"}*${c.observacion ? `\n_${c.observacion}_` : ""}

El chofer ya tiene la instrucción actualizada. ¡Gracias por tu ayuda! 📦`;
}

/**
 * Mensaje que corresponde según el tipo de caso y su estado: una vez cargada
 * la alternativa, lo que se manda es la confirmación y no el pedido original.
 */
export function mensajeDe(
  tipo: "alternativa" | "demora",
  estado: string,
  datos: DatosMensaje
): string {
  if (estado === "alternativa" || estado === "impreso") return msgConfirmacion(datos);
  return tipo === "demora" ? msgDemora(datos) : msgAlternativa(datos);
}

/**
 * Normaliza a formato internacional argentino: 54 + 9 + área + número.
 * Acepta lo que suele venir de una planilla ("011 5555-1234", "+54 9 11…").
 */
export function numeroWhatsApp(telefono: string): string {
  let d = String(telefono).replace(/\D/g, "");
  d = d.replace(/^0+/, "");           // 011… → 11…
  if (d.startsWith("54")) return d;   // ya trae el código de país
  if (d.startsWith("9")) return "54" + d;
  return "549" + d;
}

/** Muestra el teléfono legible; si no se reconoce el largo, lo deja como está. */
export function formatearTelefono(telefono: string | null): string {
  if (!telefono) return "";
  const d = String(telefono).replace(/\D/g, "");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2-$3");
  // 11 dígitos = 9 + área + número: se muestra el 9 suelto para que se lea el área
  if (d.length === 11) return d.replace(/(\d)(\d{2})(\d{4})(\d{4})/, "$1 $2 $3-$4");
  return d;
}

/** Link de WhatsApp con el mensaje ya cargado. */
export function linkWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${numeroWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`;
}
