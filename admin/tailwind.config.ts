import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(0 0% 90%)",
        input: "hsl(0 0% 90%)",
        ring: "hsl(0 0% 10%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 7%)",
        muted: { DEFAULT: "hsl(0 0% 96%)", foreground: "hsl(0 0% 40%)" },
        subtle: "hsl(0 0% 98%)",
        sidebar: { DEFAULT: "hsl(0 0% 9%)", foreground: "hsl(0 0% 92%)", hover: "hsl(0 0% 14%)", active: "hsl(0 0% 18%)" },
        accent: { DEFAULT: "hsl(0 0% 96%)", foreground: "hsl(0 0% 7%)" },
        destructive: { DEFAULT: "hsl(0 70% 42%)", foreground: "hsl(0 0% 100%)" },
      },
      borderRadius: { lg: "6px", md: "4px", sm: "3px" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
