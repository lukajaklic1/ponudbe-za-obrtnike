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
          50:  '#f5f3ef',
          100: '#f5f3ef',
          200: '#f0f0f0',
          300: '#e4e4e4',
          400: '#9a9a9a',
          500: '#6a6a6a',
          600: '#6a6a6a',
          700: '#464646',
          800: '#464646',
          900: '#000000',
          950: '#000000',
        },
        // theme tokens (same values as the CSS variables in index.css)
        surface: { DEFAULT: '#f5f3ef', active: '#e9e8e3' },
        ink: '#000000',
        muted: { DEFAULT: '#6a6a6a', strong: '#464646' },
      },
    },
  },
  plugins: [],
}

