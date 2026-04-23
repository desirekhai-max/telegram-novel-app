/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          blue: '#3390ec',
        },
      },
      animation: {
        'ambient-drift-a': 'ambientDriftA 72s ease-in-out infinite alternate',
        'ambient-drift-b': 'ambientDriftB 96s ease-in-out infinite alternate',
        'ambient-drift-c': 'ambientDriftC 84s ease-in-out infinite alternate',
        'ambient-drift-d': 'ambientDriftD 60s ease-in-out infinite alternate',
        'ambient-rotate': 'ambientRotate 160s linear infinite',
        'coin-icon-float': 'coinIconFloat 2.8s ease-in-out infinite',
      },
      keyframes: {
        ambientDriftA: {
          '0%': { transform: 'translate3d(-1.5%, 0.5%, 0) scale(1)' },
          '100%': { transform: 'translate3d(3.5%, -2.5%, 0) scale(1.06)' },
        },
        ambientDriftB: {
          '0%': { transform: 'translate3d(1%, -1.5%, 0) scale(1.02)' },
          '100%': { transform: 'translate3d(-4%, 2.5%, 0) scale(1)' },
        },
        ambientDriftC: {
          '0%': { transform: 'translate3d(0, 1.5%, 0) scale(1)' },
          '100%': { transform: 'translate3d(-2.5%, -3.5%, 0) scale(1.05)' },
        },
        ambientDriftD: {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(2.5%, 3%, 0) scale(1.04)' },
        },
        ambientRotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        coinIconFloat: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -1.5px, 0)' },
        },
      },
    },
  },
  plugins: [],
}
