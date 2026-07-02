// ─── Fechas en horario de Argentina ─────────────────────────────────────────
// new Date().toISOString() devuelve la fecha en UTC: después de las 21:00
// (hora argentina, UTC-3) el día "salta" al siguiente. Toda la app debe usar
// estas funciones para que la fecha operativa sea siempre la local.

const TZ_AR = "America/Argentina/Buenos_Aires";

// en-CA formatea como YYYY-MM-DD, el formato que usa toda la app
const fmtISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_AR,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy (YYYY-MM-DD) en horario argentino. */
export function hoyAR(): string {
  return fmtISO.format(new Date());
}

/** Suma (o resta) días a una fecha YYYY-MM-DD, sin pasar por UTC. */
export function addDiasAR(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(y, m - 1, d + dias, 12); // mediodía local: inmune a DST
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
