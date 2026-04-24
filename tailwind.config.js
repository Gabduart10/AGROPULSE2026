/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#F5F2EB',
        sidebar: '#162316',
        card:    '#FFFFFF',
        card2:   '#F0EDE4',
        accent:  '#2A7D45',
        border:  '#DDD8CC',
        'text-primary':   '#1A180F',
        'text-secondary': '#3A4A2A',
        'text-muted':     '#8A8575',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
