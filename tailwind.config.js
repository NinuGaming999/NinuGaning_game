/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primaryRed: '#C41E3A',
        accentRed: '#FF2E2E',
        darkBg: '#1A1A1A',
        cardBg: '#2D2D2D',
        gold: '#FFD700',
      },
    },
  },
  plugins: [],
};
