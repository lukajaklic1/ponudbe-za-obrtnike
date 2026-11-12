/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist Variable', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // One main text colour for all dark text (backgrounds such as bg-gray-900 are not affected)
      textColor: {
        gray: { 600: '#4a5361', 700: '#4a5361', 800: '#4a5361', 900: '#4a5361' },
      },
      // One neutral border colour for the whole app (tables, inputs, cards, dividers)
      borderColor: {
        DEFAULT: '#e4e6dd',
        gray: { 100: '#e4e6dd', 200: '#e4e6dd' },
      },
      // Palette: warm olive-neutral greys derived from the sidebar selection #dde0d1.
      // "blue" is kept as a class name for the accent but is olive/slate now (no real blue in the app).
      colors: {
        blue: {
          50:  '#f4f5ef',
          100: '#eeefe8',
          200: '#dde0d1',
          300: '#c9cdb8',
          400: '#a4a993',
          500: '#b4b9a3',
          600: '#4a5361',
          700: '#36404e',
          800: '#2d3520',
          900: '#1f2419',
          950: '#14170f',
        },
        gray: {
          50:  '#f7f8f4',
          100: '#f0f1eb',
          200: '#e4e6dd',
          300: '#cfd2c4',
          400: '#8a8f80',
          500: '#6b7064',
          600: '#52574a',
          700: '#3f4338',
          800: '#2a2d25',
          900: '#101112',
          950: '#09090b',
        },
      },
    },
  },
  plugins: [],
}

