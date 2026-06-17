/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nacosGreen: '#047857', 
        nacosLight: '#d1fae5',
      }
    },
  },
  plugins: [],
}