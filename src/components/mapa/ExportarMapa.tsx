"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { FileImage, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RecorridoGeo } from "@/types/database.types";

interface ExportarMapaProps {
  recorridos: RecorridoGeo[];
  oculto?: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

async function capturarMapa(): Promise<string> {
  const el = document.getElementById("mapa-contenedor");
  if (!el) throw new Error("No se encontró el contenedor del mapa");
  return toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    filter: (node) =>
      !(node instanceof HTMLElement && node.hasAttribute("data-no-export")),
  });
}

export function ExportarMapa({ recorridos, oculto }: ExportarMapaProps) {
  const [exportando, setExportando] = useState(false);

  if (oculto) return null;

  async function exportarPNG() {
    setExportando(true);
    try {
      const dataUrl = await capturarMapa();
      const link = document.createElement("a");
      link.download = `rutamap-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagen PNG exportada");
    } catch (e) {
      toast.error("Error al exportar PNG", { description: String(e) });
    } finally {
      setExportando(false);
    }
  }

  async function exportarPDF() {
    setExportando(true);
    try {
      const dataUrl = await capturarMapa();

      // Dimensiones reales de la imagen capturada
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });

      // A4 landscape
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth(); // 297 mm
      const PH = pdf.internal.pageSize.getHeight(); // 210 mm
      const M = 8;

      // ── Cabecera ────────────────────────────────────────────────────
      const fechaTexto = new Date().toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("RutaMap — Mapa de recorridos", M, M + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(fechaTexto, M, M + 11);
      pdf.setTextColor(0);

      // ── Mapa ────────────────────────────────────────────────────────
      const LEYENDA_W = 54;
      const MAP_X = M;
      const MAP_Y = M + 16;
      const MAP_W = PW - M * 2 - LEYENDA_W;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const MAP_H = Math.min(MAP_W / imgRatio, PH - MAP_Y - M);

      pdf.addImage(dataUrl, "PNG", MAP_X, MAP_Y, MAP_W, MAP_H);
      pdf.setDrawColor(200);
      pdf.rect(MAP_X, MAP_Y, MAP_W, MAP_H);

      // ── Leyenda ─────────────────────────────────────────────────────
      const LEG_X = PW - M - LEYENDA_W;
      let LEG_Y = MAP_Y;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Recorridos activos", LEG_X, LEG_Y);
      LEG_Y += 5.5;

      const activos = recorridos.filter((r) => r.activo);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);

      for (const r of activos) {
        if (LEG_Y > MAP_Y + MAP_H - 2) break;
        const rgb = hexToRgb(r.color);
        if (rgb) pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.roundedRect(LEG_X, LEG_Y - 3, 3.5, 3.5, 0.5, 0.5, "F");
        const etiqueta = `${r.codigo}  ${r.nombre}`.slice(0, 29);
        pdf.text(etiqueta, LEG_X + 5.5, LEG_Y);
        LEG_Y += 4.8;
      }

      // ── Pie de página ────────────────────────────────────────────────
      pdf.setFontSize(6);
      pdf.setTextColor(160);
      pdf.text("Generado por RutaMap", M, PH - 3);
      pdf.text(
        `${activos.length} recorridos activos`,
        PW - M - 26,
        PH - 3
      );

      pdf.save(`rutamap-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exportado correctamente");
    } catch (e) {
      toast.error("Error al exportar PDF", { description: String(e) });
    } finally {
      setExportando(false);
    }
  }

  const icono = exportando ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : null;

  return (
    <div
      data-no-export
      className="absolute bottom-6 right-4 z-[800] flex flex-col gap-1.5 items-end"
    >
      <Button
        size="sm"
        variant="secondary"
        className="shadow-md gap-1.5 h-8 text-xs"
        onClick={exportarPNG}
        disabled={exportando}
        title="Exportar imagen PNG del mapa"
      >
        {icono ?? <FileImage className="h-3.5 w-3.5" />}
        PNG
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="shadow-md gap-1.5 h-8 text-xs"
        onClick={exportarPDF}
        disabled={exportando}
        title="Exportar PDF con leyenda de recorridos"
      >
        {icono ?? <FileText className="h-3.5 w-3.5" />}
        PDF
      </Button>
    </div>
  );
}
