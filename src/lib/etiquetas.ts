// ─── Etiquetas de re-despacho ───────────────────────────────────────────────
// El chofer recibe el paquete con esta etiqueta pegada: lo que tiene que leer
// de un vistazo es la dirección NUEVA, así que es lo único en cuerpo grande.

export interface DatosEtiqueta {
  cliente: string;
  direccion: string | null;
  chofer: string | null;
  alternativa: string | null;
  observacion: string | null;
  zona?: string | null;
}

export function escaparHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function cortar(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Una etiqueta. `porHoja` sólo ajusta la escala tipográfica: con 8 por hoja
 * hay menos alto por celda, así que el texto baja un 12%.
 */
export function armarEtiqueta(c: DatosEtiqueta, porHoja: 6 | 8): string {
  const s = porHoja === 6 ? 1 : 0.88;
  const f = (n: number) => (n * s).toFixed(1) + "px";
  const e = escaparHtml;
  const nombre = (c.cliente || "CLIENTE").toUpperCase();

  return `
<div style="border:2px solid #000;border-radius:6px;overflow:hidden;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;flex-direction:column;height:100%;">
  <div style="background:#FF6B00;color:#fff;padding:${f(3)} ${f(8)};font-size:${f(9)};font-weight:900;letter-spacing:${f(1.4)};text-transform:uppercase;text-align:center;">¡RE-DESPACHO PRIORITARIO!</div>
  <div style="display:flex;flex:1;">
    <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
      <div style="background:#111;color:#fff;padding:${f(4)} ${f(8)};display:flex;justify-content:space-between;align-items:center;gap:${f(6)};">
        <div style="font-size:${f(8.5)};font-weight:800;text-transform:uppercase;letter-spacing:.2px;line-height:1.25;">DIRECCIÓN ORIGINAL INCORRECTA</div>
        <div style="font-size:${f(7.5)};font-weight:800;color:#F97316;letter-spacing:.8px;flex-shrink:0;">#ALTER</div>
      </div>
      <div style="background:#0F172A;padding:${f(5)} ${f(8)};display:flex;flex-direction:column;gap:${f(3)};">
        <div style="display:flex;gap:${f(6)};align-items:baseline;">
          <span style="font-size:${f(7)};font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;min-width:${f(38)};flex-shrink:0;">ORIGINAL:</span>
          <span style="font-size:${f(10.5)};font-weight:600;color:#fff;line-height:1.25;">${e(c.direccion) || "—"}</span>
        </div>
        <div style="display:flex;gap:${f(6)};align-items:baseline;">
          <span style="font-size:${f(7)};font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;min-width:${f(38)};flex-shrink:0;">MÓVIL:</span>
          <span style="font-size:${f(10)};font-weight:800;color:#fff;line-height:1.2;">${e(c.chofer) || "—"}</span>
        </div>
      </div>
      <div style="padding:${f(6)} ${f(7)};flex:1;display:flex;">
        <div style="border:1.5px solid #111;border-radius:${f(5)};overflow:hidden;flex:1;display:flex;flex-direction:column;">
          <div style="background:#111;color:#fff;text-align:center;padding:${f(3)} ${f(6)};font-size:${f(8)};font-weight:900;letter-spacing:${f(1.6)};text-transform:uppercase;">ALTERNATIVA</div>
          <div style="padding:${f(6)} ${f(8)};flex:1;">
            <div style="font-size:${f(7)};font-weight:700;color:#F97316;text-transform:uppercase;letter-spacing:.4px;margin-bottom:${f(3)};">ENTREGAR EXCLUSIVAMENTE EN:</div>
            <div style="font-size:${f(13)};font-weight:900;color:#111;line-height:1.2;text-transform:uppercase;">${e(c.alternativa) || "(sin dirección)"}</div>
            ${c.observacion ? `<div style="font-size:${f(8)};color:#374151;font-style:italic;border-left:${f(2.5)} solid #F97316;padding-left:${f(6)};margin-top:${f(5)};line-height:1.35;">OBS: "${e(c.observacion)}"</div>` : ""}
          </div>
        </div>
      </div>
    </div>
    <div style="width:${f(58)};border-left:1px solid #E2E8F0;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;padding:${f(6)} ${f(4)};gap:${f(5)};flex-shrink:0;">
      <div style="text-align:center;">
        <div style="font-size:${f(13)};font-weight:900;color:#111;letter-spacing:${f(-2)};line-height:1;">⊣⊢</div>
        <div style="font-size:${f(5.5)};font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:#111;line-height:1.35;margin-top:${f(2)};">LOGÍSTICA<br>HOGAREÑO</div>
      </div>
      <div style="width:85%;border-top:1px dashed #CBD5E1;"></div>
      <div style="border:1px solid #F97316;border-radius:${f(4)};padding:${f(4)} ${f(3)};text-align:center;width:100%;">
        <div style="font-size:${f(5.5)};font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#F97316;margin-bottom:${f(1.5)};">CLIENTE</div>
        <div style="font-size:${f(7)};font-weight:900;color:#111;line-height:1.15;word-break:break-word;">${e(cortar(nombre, 14))}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:${f(3)};width:70%;justify-content:center;">
        <div style="border-top:1px dashed #CBD5E1;"></div>
        <div style="border-top:1px dashed #CBD5E1;"></div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:${f(5.5)};font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8;">ZONA</div>
        <div style="font-size:${f(7)};font-weight:900;color:#111;letter-spacing:.4px;">${e(c.zona) || "LH-AR"}</div>
      </div>
    </div>
  </div>
</div>`;
}

/**
 * Abre la hoja A4 lista para imprimir. Devuelve false si el navegador bloqueó
 * la ventana emergente — el prototipo reventaba con un TypeError silencioso.
 */
export function imprimirEtiquetas(casos: DatosEtiqueta[], porHoja: 6 | 8): boolean {
  if (!casos.length) return true;
  const filas = porHoja === 8 ? 4 : 3;
  // A4 útil con margen de 8mm: 194 × 281 mm
  const alto = ((281 - (filas - 1) * 4) / filas).toFixed(1);
  const cuerpo = casos.map(c => `<div class="celda">${armarEtiqueta(c, porHoja)}</div>`).join("");

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;

  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Etiquetas — Logística Hogareño</title>
<style>
@page{size:A4;margin:8mm;}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;}
.hoja{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:${alto}mm;gap:4mm;}
.celda{overflow:hidden;page-break-inside:avoid;break-inside:avoid;}
@media screen{body{background:#E2E8F0;padding:20px;}.hoja{background:#fff;width:194mm;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.2);}}
</style></head><body>
<div class="hoja">${cuerpo}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`);
  win.document.close();
  return true;
}
