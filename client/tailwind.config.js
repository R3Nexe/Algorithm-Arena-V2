/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        // Mapping Tailwind to your CSS Variables
        app: "var(--bg-app)",
        sidebar: "var(--bg-sidebar)",

        // Foreground / Text
        primary: "var(--fg-primary)",
        secondary: "var(--fg-secondary)",
        tertiary: "var(--fg-tertiary)",

        // Accent Colors
        accent: {
          DEFAULT: "var(--accent-primary)",
          glow: "var(--accent-glow)",
        },

        // Glass Morphism
        glass: {
          surface: "var(--glass-surface)",
          border: "var(--glass-border-color)", // We will define this in index.css
        },
      },
      animation: {
        float: "float 20s ease-in-out infinite",
        "pulse-slow": "pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
