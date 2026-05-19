/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fffde7',
          100: '#fff9c4',
          200: '#fff176',
          300: '#ffee58',
          400: '#ffca28',
          500: '#FFD700',
          600: '#e6c200',
          700: '#c8a800',
          800: '#9a7d00',
          900: '#6d5700',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        dark: {
          50: '#1a1a1a',
          100: '#141414',
          200: '#111111',
          300: '#0e0e0e',
          400: '#0B0B0B',
          500: '#080808',
          600: '#050505',
          700: '#030303',
          800: '#020202',
          900: '#000000',
        },
        surface: {
          50: '#2a2a2a',
          100: '#222222',
          200: '#1c1c1c',
          300: '#181818',
          400: '#141414',
        },
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 20px rgba(255, 215, 0, 0.3)',
        'gold-lg': '0 0 40px rgba(255, 215, 0, 0.5)',
        emerald: '0 0 20px rgba(16, 185, 129, 0.3)',
        'emerald-lg': '0 0 40px rgba(16, 185, 129, 0.5)',
        'inner-gold': 'inset 0 0 20px rgba(255, 215, 0, 0.1)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FFD700, #FFA000)',
        'emerald-gradient': 'linear-gradient(135deg, #10B981, #047857)',
        'dark-gradient': 'linear-gradient(180deg, #141414 0%, #0B0B0B 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,215,0,0.05) 0%, rgba(16,185,129,0.03) 100%)',
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 215, 0, 0.8), 0 0 60px rgba(168, 85, 247, 0.3)' },
        },
        'glow': {
          from: { boxShadow: '0 0 10px rgba(255, 215, 0, 0.2)' },
          to: { boxShadow: '0 0 30px rgba(255, 215, 0, 0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
};
