import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Color de firma RutaMap: índigo → violeta ──────────────────────
        // Re-mapeo la escala `blue-*` de Tailwind al índigo de firma para que
        // toda la app (botones, estados activos, paneles) adopte la nueva
        // identidad sin tocar cada componente. Los colores de DATOS del mapa
        // usan hex (recorrido.*) y quedan intactos.
        blue: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Colores corporativos Logística Hogareño
        brand: {
          blue: {
            DEFAULT: "#4f46e5",
            dark: "#4338ca",
            light: "#6366f1",
          },
          sky: {
            DEFAULT: "#818cf8",
            dark: "#a5b4fc",
          },
          violet: {
            DEFAULT: "#8b5cf6",
            dark: "#7c3aed",
          },
          black: "#0b1120",
        },
        // Paleta de recorridos (para referencia en el código)
        recorrido: {
          celeste: "#7dd3fc",
          azul: "#2563eb",
          verde: "#16a34a",
          naranja: "#ea580c",
          rojo: "#dc2626",
          violeta: "#9333ea",
          amarillo: "#eab308",
          rosa: "#ec4899",
        },
        // shadcn/ui CSS variables
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Sombras suaves y estratificadas (estilo premium, baja opacidad)
      // Reemplazan las sombras duras de Tailwind en toda la app.
      boxShadow: {
        sm: "0 1px 2px 0 rgb(16 24 40 / 0.04)",
        DEFAULT:
          "0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.05)",
        md: "0 4px 8px -2px rgb(16 24 40 / 0.06), 0 2px 4px -2px rgb(16 24 40 / 0.04)",
        lg: "0 12px 16px -4px rgb(16 24 40 / 0.08), 0 4px 6px -2px rgb(16 24 40 / 0.03)",
        xl: "0 20px 24px -4px rgb(16 24 40 / 0.08), 0 8px 8px -4px rgb(16 24 40 / 0.03)",
        "2xl": "0 24px 48px -12px rgb(16 24 40 / 0.18)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
