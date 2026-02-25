import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#1a1a2e",
          hover: "#222240",
          border: "#2a2a4a",
        },
        background: "#0f0f1a",
        foreground: {
          DEFAULT: "#e4e4f0",
          secondary: "#9494b8",
          muted: "#6b6b8a",
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
