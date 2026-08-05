import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        text: "hsl(var(--text))",
        "text-muted": "hsl(var(--text-muted))",
        "text-faint": "hsl(var(--text-faint))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: "hsl(var(--accent-soft))",
        },
        brass: {
          DEFAULT: "hsl(var(--brass))",
          soft: "hsl(var(--brass-soft))",
        },
        danger: "hsl(var(--danger))",
        success: "hsl(var(--success))",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 2px hsl(var(--text) / 0.04), 0 2px 8px hsl(var(--text) / 0.04)",
        card: "0 1px 2px hsl(var(--text) / 0.03), 0 8px 24px -8px hsl(var(--text) / 0.08)",
        "card-hover": "0 2px 4px hsl(var(--text) / 0.04), 0 16px 32px -12px hsl(var(--text) / 0.14)",
        glow: "0 0 0 1px hsl(var(--accent) / 0.4), 0 4px 20px -2px hsl(var(--accent) / 0.35)",
        "glow-sm": "0 0 0 1px hsl(var(--accent) / 0.3), 0 2px 10px -2px hsl(var(--accent) / 0.25)",
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--accent) / 0.75) 100%)",
        "gradient-radial": "radial-gradient(ellipse at top, hsl(var(--accent) / 0.12), transparent 60%)",
        "gradient-mesh":
          "radial-gradient(ellipse 80% 50% at 20% -10%, hsl(var(--accent) / 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, hsl(var(--brass) / 0.12), transparent)",
        shimmer:
          "linear-gradient(90deg, transparent, hsl(var(--text) / 0.06), transparent)",
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
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Like "fade-in", but keeps DialogContent's centering transform
        // (translate(-50%, -50%)) active throughout the animation instead
        // of overwriting it — otherwise the dialog briefly renders
        // uncentered and snaps to center once the animation ends.
        "dialog-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%) translateY(8px)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "dialog-in": "dialog-in 0.5s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        shimmer: "shimmer 2s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
