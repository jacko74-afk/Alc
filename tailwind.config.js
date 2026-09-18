/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        espresso: {
          950: "#100c0a",
          900: "#1a1410",
          800: "#2a211b",
          700: "#3d3229",
        },
        wine: {
          50: "#f8ecee",
          100: "#ead4d7",
          500: "#9a3340",
          600: "#7b2430",
          700: "#5e1b25",
          900: "#3a1017",
        },
        gold: {
          50: "#fbf6ea",
          100: "#f1e4c4",
          300: "#e0c47a",
          400: "#d4af6a",
          500: "#c9a24d",
          700: "#8c6d28",
        },
        cream: {
          50: "#fbf7f0",
          100: "#f4eadc",
          200: "#e8dcc8",
        },
        brand: {
          50: "#fbf6ea",
          100: "#f1e4c4",
          500: "#c9a24d",
          700: "#7b2430",
          900: "#1a1410",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: [
          "var(--font-sans)",
          "Malgun Gothic",
          "Apple SD Gothic Neo",
          "sans-serif",
        ],
      },
      boxShadow: {
        bottle: "0 18px 40px -24px rgba(26, 20, 16, 0.55)",
      },
    },
  },
  plugins: [],
};
