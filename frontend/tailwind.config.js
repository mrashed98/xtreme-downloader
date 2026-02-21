/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: "rgba(255, 255, 255, 0.05)",
          border: "rgba(255, 255, 255, 0.1)",
          hover: "rgba(255, 255, 255, 0.08)",
        },
        accent: {
          purple: "#7c3aed",
          pink: "#db2777",
        },
        dark: {
          900: "#0a0a0f",
          800: "#0f0f1a",
          700: "#1a1a2e",
          600: "#16213e",
        },
      },
      backgroundImage: {
        "gradient-app": "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
        "gradient-accent": "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
        "gradient-card": "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(219,39,119,0.2) 100%)",
      },
      backdropBlur: {
        glass: "20px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
