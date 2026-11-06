/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669', // Primary emerald
          700: '#047857',
          800: '#065f46',
          900: '#064e3b', // Deep forest green
          950: '#17351f', // Signature GRAIN-VISION dark
        },
        grain: {
          normal: '#10b981',   // Emerald
          broken: '#f59e0b',   // Amber
          chalky: '#3b82f6',   // Blue
          discolored: '#ef4444' // Red/destructive
        }
      }
    },
  },
  plugins: [],
}
