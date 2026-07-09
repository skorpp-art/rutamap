"use client";

import { useEffect } from "react";

// Registra el service worker (PWA). Solo en producción y si el navegador lo soporta.
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sin SW la app sigue funcionando igual — solo pierde instalabilidad
    });
  }, []);
  return null;
}
