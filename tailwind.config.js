/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // High-end enterprise theme palette
        brand: {
          50: '#f5f7fa',
          100: '#e4e8f0',
          200: '#cdd5e4',
          300: '#a7b6d0',
          400: '#7a91b8',
          500: '#5a739f',
          600: '#465b83',
          700: '#3a4a6b',
          800: '#323e59',
          900: '#2d354a',
          950: '#1a1f2c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
