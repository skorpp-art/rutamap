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
    <html lang="es" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="top-right" richColors />
          <RegistrarSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
