// ─── Remito de devolución ─────────────────────────────────────────────────────
// Documento que acompaña la salida de bultos del depósito: lo firman el
// encargado, el chofer y quien recibe. Se abre en una ventana aparte y se manda
// a imprimir; no genera archivo, igual que en la app de origen.
//
// Vive suelto (y no dentro de una pantalla) porque se imprime desde dos lugares:
// al confirmar una devolución en la ficha del cliente, y al reimprimir un remito
// viejo desde el historial.

import { EMPRESA, EMPRESA_SIGLA } from "@/lib/marca";
import { ESTADO_BULTO_LABEL, type EstadoBulto } from "@/types/deposito.types";

export interface BultoRemito {
  tracking_id: string | null;
  barcode: string | null;
  description: string | null;
  entry_date: string;
  destination_address: string | null;
  destination_locality: string | null;
  status: EstadoBulto | string;
}

export interface DatosRemito {
  cliente: string;
  fecha: string;
  numero: number | null;
  bultos: BultoRemito[];
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const [a, m, dd] = d.split("-");
  return dd ? `${dd}/${m}/${a}` : d;
}

// Los datos vienen de la base (nombres de clientes, direcciones): se escapan
// para que un apellido con "&" o un "<" en una nota no rompan el documento.
function esc(v: string | null | undefined): string {
  return String(v ?? "").replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export function imprimirRemito(r: DatosRemito): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("El navegador bloqueó la ventana de impresión. Permitila para imprimir el remito.");
    return;
  }

  const doc = r.numero != null ? String(r.numero).padStart(4, "0") : "—";
  const filas = r.bultos.map(b => `
      <tr>
        <td>${esc(b.tracking_id || b.barcode) || "-"}</td>
        <td>${esc(b.description) || "-"}</td>
        <td>${fmt(b.entry_date)}</td>
        <td>${esc(b.destination_address
          ? b.destination_address + (b.destination_locality ? " - " + b.destination_locality : "")
          : "") || "-"}</td>
        <td class="estado">${esc(ESTADO_BULTO_LABEL[b.status as EstadoBulto] ?? b.status).toUpperCase()}</td>
      </tr>`).join("");

  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
    <title>Remito ${doc} — ${esc(r.cliente)}</title>
    <style>
      @page { margin: 10mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:30px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start;
                margin-bottom:20px; border-bottom:3px solid #111; padding-bottom:15px; }
      .logo-area { display:flex; align-items:center; gap:12px; }
      .logo-box { width:40px; height:40px; border:3px solid #111; display:flex;
                  align-items:center; justify-content:center; font-weight:bold; }
      .title { font-size:22px; font-weight:bold; text-transform:uppercase; }
      .subtitle { font-size:11px; color:#555; margin-top:2px; }
      .doc-info { text-align:right; font-size:12px; }
      .doc-info strong { display:block; }
      .cliente { background:#f3f4f6; padding:15px 20px; border-radius:6px; margin-bottom:20px; }
      .cliente .name { font-weight:bold; text-transform:uppercase; font-size:14px; }
      .cliente .meta { display:flex; justify-content:space-between; margin-top:5px; font-size:12px; color:#555; }
      table { width:100%; border-collapse:collapse; margin-bottom:30px; }
      th { background:#f9fafb; text-align:left; padding:8px 10px; font-size:11px;
           text-transform:uppercase; color:#555; border-bottom:2px solid #ddd; }
      td { padding:8px 10px; font-size:12px; border-bottom:1px solid #eee;
           word-wrap:break-word; max-width:180px; }
      .estado { font-weight:bold; font-size:11px; }
      .firmas { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:40px;
                border-top:2px solid #111; padding-top:20px; }
      .firma { text-align:center; padding-top:40px; border-top:1px solid #999; }
      .firma .rol { font-weight:bold; font-size:12px; }
      .firma .desc { font-size:10px; color:#777; font-style:italic; }
    </style></head><body>
      <div class="header">
        <div class="logo-area">
          <div class="logo-box">${esc(EMPRESA_SIGLA)}</div>
          <div>
            <div class="title">${esc(EMPRESA)}</div>
            <div class="subtitle">Ficha de control e inventario de stock</div>
          </div>
        </div>
        <div class="doc-info">
          <strong>DOC N°: ${doc}</strong>
          <span>Fecha: ${fmt(r.fecha)}</span>
        </div>
      </div>
      <div class="cliente">
        <div class="name">${esc(r.cliente)}</div>
        <div class="meta">
          <span>Tipo de operación: devolución</span>
          <span>Total de bultos: ${r.bultos.length}</span>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Tracking</th><th>Artículo / notas</th><th>Ingreso</th><th>Destino</th><th>Estado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="firmas">
        <div class="firma"><div class="rol">ENCARGADO DE DEPÓSITO</div><div class="desc">Autorización de salida</div></div>
        <div class="firma"><div class="rol">CONDUCTOR</div><div class="desc">Verificación y carga</div></div>
        <div class="firma"><div class="rol">RECEPTOR</div><div class="desc">Recibido conforme</div></div>
      </div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
  win.document.close();
}
