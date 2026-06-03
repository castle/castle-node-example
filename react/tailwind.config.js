/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0e14',
        'bg-soft': '#11151f',
        surface: '#151a23',
        'surface-2': '#1b2230',
        border: '#232b39',
        'border-soft': '#1c2330',
        ink: '#e6e9ef',
        muted: '#9aa4b2',
        accent: '#7c5cff',
        'accent-hover': '#6b4cf0',
        success: '#2ecc71',
        challenge: '#ffbf47',
        danger: '#ff5c7c',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { xl: '14px', lg: '9px' },
      boxShadow: { card: '0 10px 30px rgba(0, 0, 0, 0.35)' },
    },
  },
  plugins: [],
};
