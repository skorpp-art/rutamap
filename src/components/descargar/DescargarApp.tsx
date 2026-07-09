"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Smartphone, Download, CheckCircle2, Share, PlusSquare, MoreVertical,
  MonitorSmartphone, Upload, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "app-android";
const APK_PATH = "rutamap.apk";

// Evento no tipado por TS: el prompt nativo de instalación PWA de Chrome
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DescargarApp({ esMaestro }: { esMaestro: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [yaInstalada, setYaInstalada] = useState(false);
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [subiendoApk, setSubiendoApk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // ¿Ya está corriendo como app instalada?
    if (window.matchMedia("(display-mode: standalone)").matches) setYaInstalada(true);

    // Chrome dispara esto cuando la app es instalable — lo guardamos para
    // disparar el prompt nativo con el botón grande.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setYaInstalada(true));

    // ¿Hay un APK subido? (HEAD al público del bucket)
    const supabase = createClient();
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(APK_PATH);
    fetch(data.publicUrl, { method: "HEAD" })
      .then(r => { if (r.ok) setApkUrl(data.publicUrl); })
      .catch(() => {});

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function instalar() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      toast.success("¡Listo! RutaMap quedó instalada en la pantalla principal");
      setInstallEvent(null);
    }
  }

  async function subirApk(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.endsWith(".apk")) { toast.error("El archivo tiene que ser un .apk"); return; }
    setSubiendoApk(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage.from(BUCKET)
        .upload(APK_PATH, file, { upsert: true, contentType: "application/vnd.android.package-archive" });
      if (error) { toast.error("No se pudo subir el APK", { description: error.message }); return; }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(APK_PATH);
      setApkUrl(`${data.publicUrl}?v=${Date.now()}`);
      toast.success("APK subido — el botón de descarga ya está activo para todos");
    } finally { setSubiendoApk(false); }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-5 space-y-5 pb-16">
        {/* Encabezado */}
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 shrink-0">
            <MonitorSmartphone className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Instalar RutaMap</h1>
            <p className="text-xs text-muted-foreground">
              Usala como app en tablets y celulares: ícono propio, pantalla completa y arranque directo en Carga del Día.
            </p>
          </div>
        </div>

        {yaInstalada && (
          <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Ya estás usando RutaMap como app instalada en este dispositivo.
            </p>
          </div>
        )}

        {/* Instalación directa (PWA) — el camino recomendado */}
        <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <p className="font-semibold text-sm">Instalar en este dispositivo (recomendado)</p>
          </div>
          {installEvent ? (
            <>
              <p className="text-xs text-muted-foreground">
                Un toque y queda instalada con su ícono en la pantalla principal. Se actualiza sola con cada mejora — nunca hay que reinstalar.
              </p>
              <Button onClick={instalar} size="lg" className="w-full h-12 text-base gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="h-5 w-5" /> Instalar RutaMap
              </Button>
            </>
          ) : (
            <div className="space-y-3 text-xs text-muted-foreground">
              <p>
                Si el botón de instalación directa no aparece en tu navegador, seguí estos pasos (una sola vez por dispositivo):
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="border rounded-xl p-3 space-y-1.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <MoreVertical className="h-3.5 w-3.5" /> Android (Chrome)
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abrí el menú <span className="font-mono">⋮</span> (arriba a la derecha)</li>
                    <li>Tocá <span className="font-medium text-foreground">"Agregar a pantalla principal"</span> o <span className="font-medium text-foreground">"Instalar app"</span></li>
                    <li>Confirmá — el ícono aparece como cualquier app</li>
                  </ol>
                </div>
                <div className="border rounded-xl p-3 space-y-1.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Share className="h-3.5 w-3.5" /> iPhone / iPad (Safari)
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Tocá el botón de compartir <Share className="h-3 w-3 inline" /></li>
                    <li>Elegí <span className="font-medium text-foreground flex-inline items-center">"Agregar a inicio" <PlusSquare className="h-3 w-3 inline" /></span></li>
                    <li>Confirmá con "Agregar"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* APK */}
        <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <p className="font-semibold text-sm">APK para Android</p>
          </div>
          {apkUrl ? (
            <>
              <p className="text-xs text-muted-foreground">
                Descargá el instalador y abrilo en la tablet o el celular. Puede que Android pida permitir
                "instalar apps de origen desconocido" — es normal para apps fuera de Play Store.
              </p>
              <Button asChild size="lg" className="w-full h-12 text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <a href={apkUrl} download="rutamap.apk">
                  <Download className="h-5 w-5" /> Descargar APK
                </a>
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Todavía no hay un APK publicado. La instalación directa de arriba ofrece exactamente la misma
              experiencia (ícono, pantalla completa, actualizaciones automáticas) sin necesidad del APK.
            </p>
          )}

          {esMaestro && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Publicar / actualizar el APK (solo maestro)</p>
              <p className="text-[11px] text-muted-foreground">
                Generalo una sola vez en <span className="font-mono font-medium text-foreground">pwabuilder.com</span> con
                la URL <span className="font-mono font-medium text-foreground">rutamap.vercel.app</span> (Android → Generate Package)
                y subilo acá. Las actualizaciones de la app NO requieren regenerar el APK — solo cambia si querés otro ícono o nombre.
              </p>
              <input ref={fileRef} type="file" accept=".apk" className="hidden" onChange={subirApk} />
              <button onClick={() => fileRef.current?.click()} disabled={subiendoApk}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-border hover:bg-muted transition-colors disabled:opacity-50">
                {subiendoApk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {subiendoApk ? "Subiendo…" : apkUrl ? "Reemplazar APK publicado" : "Subir APK"}
              </button>
            </div>
          )}
        </div>

        <p className={cn("text-[11px] text-muted-foreground")}>
          La app instalada abre directo en <span className="font-medium">Carga del Día</span> y usa siempre la última
          versión desplegada — no hay que actualizar nada en los dispositivos.
        </p>
      </div>
    </div>
  );
}
