import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--color-surface)",
          hover: "var(--color-surface-hover)",
          border: "var(--color-surface-border)",
        },
        background: "var(--color-background)",
        foreground: {
          DEFAULT: "var(--color-foreground)",
          secondary: "var(--color-foreground-secondary)",
          muted: "var(--color-foreground-muted)",
        },
        accent: {
          DEFAULT: "#f97316",
          light: "#fb923c",
          dim: "#c2410c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
