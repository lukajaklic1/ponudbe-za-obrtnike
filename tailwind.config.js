/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        blue: {
          50:  '#eff5fe',
          100: '#deeafd',
          200: '#bed5fb',
          300: '#8db8f8',
          400: '#5a93f4',
          500: '#3a7df2',
          600: '#266df0',
          700: '#1a5cd4',
          800: '#154ab0',
          900: '#123d8e',
          950: '#0c2860',
        },
        gray: {
          50:  '#fbfbfb',
          100: '#f4f4f5',
          200: '#eeeff1',
          300: '#d4d4d8',
          400: '#7f7f7f',
          500: '#5e5e5e',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#101112',
          950: '#09090b',
        },
      },
    },
  },
  plugins: [],
}

