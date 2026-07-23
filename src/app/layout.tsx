import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { RegistrarSW } from "@/components/RegistrarSW";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RutaMap — Gestión de Recorridos de Reparto",
  description:
    "Visualizá, dibujá y exportá zonas de reparto para Mercado Envíos Flex — Logística Hogareño",
  applicationName: "RutaMap",
  // La app ya está en español: desactivar la traducción automática del
  // navegador (Google Translate), que al mutar el DOM rompe React con una
  // "excepción del lado del cliente" al re-renderizar listas (ej: Pendientes).
  other: { google: "notranslate" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RutaMap",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a8a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" translate="no" className="notranslate h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full antialiased`}>
        {/* Guardián anti-traductor: corre en vanilla JS (independiente de React,
            así funciona aun si Google Translate rompe el render). Detecta cuando
            el navegador tradujo la página y muestra un cartel claro con el paso
            para desactivarlo, en vez de dejar todo roto y duplicado. */}
        <script dangerouslySetInnerHTML={{ __html: GUARD_TRADUCTOR }} />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="top-right" richColors />
          <RegistrarSW />
        </ThemeProvider>
      </body>
    </html>
  );
}

// Cuando Chrome/Google Translate traduce la página le agrega la clase
// "translated-ltr" (o "translated-rtl") al <html>. Lo detectamos y mostramos un
// overlay con instrucciones. El overlay es notranslate para que no lo rompa.
const GUARD_TRADUCTOR = `(function(){
  function traducido(){
    var c = document.documentElement.className || "";
    return c.indexOf("translated-ltr") > -1 || c.indexOf("translated-rtl") > -1;
  }
  function mostrar(){
    if (document.getElementById("rm-aviso-traductor")) return;
    var o = document.createElement("div");
    o.id = "rm-aviso-traductor";
    o.className = "notranslate";
    o.setAttribute("translate","no");
    o.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0b1220;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    o.innerHTML = '<div style="max-width:440px;text-align:center">' +
      '<div style="font-size:44px;line-height:1;margin-bottom:16px">🌐</div>' +
      '<h1 style="font-size:20px;font-weight:700;margin:0 0 10px">El traductor de Google está rompiendo la app</h1>' +
      '<p style="font-size:14px;opacity:.85;margin:0 0 18px;line-height:1.5">RutaMap ya está en español. El traductor de Chrome la está traduciendo igual y por eso se ve todo duplicado y desarmado.<br><br><b>Desactivalo así:</b><br>Click en el ícono del traductor (arriba a la derecha) → los 3 puntitos → <b>“No traducir nunca este sitio”</b>. Después tocá el botón de abajo.</p>' +
      '<button id="rm-aviso-recargar" style="background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer">Ya lo desactivé — recargar</button>' +
      '</div>';
    document.body.appendChild(o);
    var b = document.getElementById("rm-aviso-recargar");
    if (b) b.onclick = function(){ location.reload(); };
  }
  function check(){ if (traducido()) mostrar(); }
  try {
    var obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    check();
    setTimeout(check, 1500);
    setTimeout(check, 4000);
  } catch(e){}
})();`;
