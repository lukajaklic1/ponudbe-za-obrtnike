/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans Variable"', '"DM Sans"', 'sans-serif'],
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
          50:  '#f6f8fc',
          100: '#f6f8fc',
          200: '#e4e9f2',
          300: '#d0d5dd',
          400: '#98a2b3',
          500: '#667085',
          600: '#667085',
          700: '#475467',
          800: '#475467',
          900: '#000000',
          950: '#000000',
        },
        // theme tokens (same values as the CSS variables in index.css)
        surface: { DEFAULT: '#f6f8fc', active: '#e8eef7' },
        primary: { DEFAULT: '#0168ce', hover: '#0157ad' },
        ink: '#000000',
        muted: { DEFAULT: '#667085', strong: '#475467' },
      },
    },
  },
  plugins: [],
}

