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
          purple: "#4f9d92",
          pink: "#d7a65f",
        },
        dark: {
          900: "#07111d",
          800: "#0c1726",
          700: "#142133",
          600: "#1d2e45",
        },
      },
      backgroundImage: {
        "gradient-app": "linear-gradient(145deg, #07111d 0%, #142133 50%, #1d2e45 100%)",
        "gradient-accent": "linear-gradient(135deg, #4f9d92 0%, #d7a65f 100%)",
        "gradient-card": "linear-gradient(135deg, rgba(79,157,146,0.28) 0%, rgba(215,166,95,0.22) 100%)",
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
