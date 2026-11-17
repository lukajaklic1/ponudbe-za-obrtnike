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
          50:  '#fafafa',
          100: '#f4f4f4',
          200: '#dfdfdf',
          300: '#cfcfcf',
          400: '#9a9a9a',
          500: '#6e6e6e',
          600: '#484848',
          700: '#45484a',
          800: '#36393b',
          900: '#1a1a1a',
          950: '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
}

