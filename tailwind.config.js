/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Usar 'class' es la forma más segura y compatible en Vite/React
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#eff0ff',
          100: '#e0e2ff',
          200: '#c3c7ff',
          300: '#9aa0ff',
          400: '#6d70fc',
          500: '#4346ef',
          600: '#2b2bd1',
          700: '#2220aa',
          800: '#1e1c89',
          900: '#010694', // El Azul Premium Profundo
        },
        dark: {
          bg: '#0B0F19',
          card: '#111623',
          border: '#1E2536'
        },
        gray: {
          600: '#2A344A', // Atrapa grises intermedios
          700: '#1E2536', // Elimina el plomo de los bordes
          800: '#111623', // Elimina el plomo de las tarjetas y menús
          900: '#0B0F19', // Elimina el plomo del fondo principal
          950: '#05080F', // Atrapa el gris extra oscuro
        },
        slate: { // Atrapa el color si el componente usa 'slate' en vez de 'gray'
          600: '#2A344A',
          700: '#1E2536',
          800: '#111623',
          900: '#0B0F19',
          950: '#05080F',
        }
      },
      fontSize: {
        xxs: '0.65rem',
      }
    },
  },
  plugins: [],
}