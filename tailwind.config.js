/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#1B5E4B',
        sage: '#A8C5A0',
        mint: '#5CBFA6',
        ivory: '#F8FAF7',
        ink: '#20352B',
      },
      fontFamily: {
        sans: ['DM Sans', 'Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
