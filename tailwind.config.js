/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        sea: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
        sand: {
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
