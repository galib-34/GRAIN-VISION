/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { background: '#090d0c', foreground: '#f4f7f5', primary: '#10b981', border: '#28312e' }, borderRadius: { lg: '0.85rem', xl: '1rem' } } },
  plugins: [],
}
