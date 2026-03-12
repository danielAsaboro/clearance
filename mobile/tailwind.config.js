/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        yellow: {
          accent: "#F5E642",
        },
        dark: {
          bg: "#000000",
          card: "#1A1A1A",
          border: "#2A2A2A",
          muted: "#6B7280",
        },
      },
    },
  },
  plugins: [],
};
