/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        neon: {
          cyan: '#00C6FF',
          purple: '#7B68EE',
          indigo: '#6A5ACD',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(0, 198, 255, 0.28)',
        card: '0 20px 45px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(0, 198, 255, 0.0)' },
          '50%': { boxShadow: '0 0 35px rgba(0, 198, 255, 0.35)' },
        },
        gradientMove: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        gradient: 'gradientMove 8s ease infinite',
      },
    },
  },
  plugins: [],
};
