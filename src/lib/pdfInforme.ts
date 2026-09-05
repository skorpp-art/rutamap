// Helpers compartidos para armar los PDFs de "informe prolijo" (pensados para
// presentar a un cliente): mismo lenguaje visual que el resto de los PDFs de
// la app (header oscuro + acento azul, tarjetas con borde de color, tablas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDF = any;

export interface Doc {
  pdf: PDF;
  PW: number;
  PH: number;
  M: number;
}

export async function crearDocumento(subtitulo: string, tituloDerecha: string, fechaGenerado?: string): Promise<{ doc: Doc; y: number }> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 14;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, PW, 32, "F");
  pdf.setFillColor(37, 99, 235);
  pdf.rect(0, 30, PW, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("LOGÍSTICA HOGAREÑO", M, 14);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(148, 163, 184);
  pdf.text(subtitulo.toUpperCase(), M, 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.text(tituloDerecha.toUpperCase(), PW - M, 18, { align: "right" });
  if (fechaGenerado) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(fechaGenerado, PW - M, 24, { align: "right" });
  }

  return { doc: { pdf, PW, PH, M }, y: 42 };
}

export interface Card { label: string; valor: string; sub?: string; r: number; g: number; b: number; }

// Tarjetas de resumen (2 por fila). Devuelve el nuevo y.
export function dibujarCards({ pdf, PW, M }: Doc, y: number, cards: Card[]): number {
  const cW = (PW - M * 2 - 6) / 2;
  const cH = 22;
  cards.forEach((c, i) => {
    const cx = M + (i % 2) * (cW + 6);
    const cy = y + Math.floor(i / 2) * (cH + 4);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(cx, cy, cW, cH, 2, 2, "F");
    pdf.setFillColor(c.r, c.g, c.b);
    pdf.roundedRect(cx, cy, 2, cH, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(c.label, cx + 6, cy + 7);
    pdf.setFontSize(15);
    pdf.setTextColor(c.r, c.g, c.b);
    pdf.text(c.valor, cx + 6, cy + 16);
    if (c.sub) {
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(c.sub, cx + 6, cy + 20.5);
    }
  });
  const filas = Math.ceil(cards.length / 2);
  return y + filas * (cH + 4) + 6;
}

export function dibujarTitulo({ pdf, M }: Doc, y: number, texto: string): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text(texto.toUpperCase(), M, y);
  return y + 6;
}

export function dibujarNota({ pdf, PW, M }: Doc, y: number, texto: string): number {
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  const lineas = pdf.splitTextToSize(texto, PW - M * 2);
  pdf.text(lineas, M, y);
  return y + lineas.length * 3.6 + 4;
}

export function dibujarBanner({ pdf, PW, M }: Doc, y: number, texto: string, tono: "amber" | "emerald" | "red" = "amber"): number {
  const colores = {
    amber: { bg: [254, 243, 199], tx: [146, 64, 14] },
    emerald: { bg: [209, 250, 229], tx: [6, 95, 70] },
    red: { bg: [254, 226, 226], tx: [153, 27, 27] },
  }[tono];
  pdf.setFillColor(colores.bg[0], colores.bg[1], colores.bg[2]);
  pdf.roundedRect(M, y, PW - M * 2, 9, 1.5, 1.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(colores.tx[0], colores.tx[1], colores.tx[2]);
  pdf.text(texto, M + 4, y + 6);
  return y + 14;
}

export interface Col { label: string; w: number; align?: "left" | "right"; color?: (row: string[], i: number) => [number, number, number] | null; }

// Tabla simple con salto de página automático.
export function dibujarTabla(doc: Doc, y: number, cols: Col[], rows: string[][]): number {
  const { pdf, PW, PH, M } = doc;
  let yy = y;
  const drawHeader = () => {
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(M, yy, PW - M * 2, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    let x = M + 2;
    cols.forEach(c => {
      pdf.text(c.label, c.align === "right" ? x + c.w - 2 : x, yy + 4, c.align === "right" ? { align: "right" } : undefined);
      x += c.w;
    });
    yy += 6;
  };
  drawHeader();
  rows.forEach((row, i) => {
    if (yy > PH - 18) {
      pdf.addPage();
      yy = 20;
      drawHeader();
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    let x = M + 2;
    row.forEach((cell, j) => {
      const col = cols[j];
      const color = col.color?.(row, i);
      if (color) pdf.setTextColor(color[0], color[1], color[2]);
      else pdf.setTextColor(30, 41, 59);
      const texto = col.align === "right" ? cell : (cell.length > 34 ? cell.slice(0, 33) + "…" : cell);
      pdf.text(texto, col.align === "right" ? x + col.w - 2 : x, yy + 5, col.align === "right" ? { align: "right" } : undefined);
      x += col.w;
    });
    pdf.setDrawColor(241, 245, 249);
    pdf.line(M, yy + 7, PW - M, yy + 7);
    yy += 7;
  });
  return yy + 6;
}

export function pieDePagina({ pdf, PW, PH, M }: Doc, generadoPara?: string) {
  const total = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`RutaMap · Logística Hogareño${generadoPara ? ` · ${generadoPara}` : ""}`, M, PH - 8);
    pdf.text(`Generado: ${new Date().toLocaleString("es-AR")}`, M, PH - 4);
    pdf.text(`${i}/${total}`, PW - M, PH - 4, { align: "right" });
  }
}
