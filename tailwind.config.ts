import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
    './app/plugins/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0B1220',
        surface: '#EEF3F6',
        brand: {
          DEFAULT: '#0D9488',
          soft: '#CCFBF1',
          dark: '#0F766E',
        },
        accent: {
          DEFAULT: '#F59E0B',
          soft: '#FEF3C7',
        },
        muted: '#5B6B7C',
        line: '#D5DEE7',
        danger: {
          DEFAULT: '#DC2626',
          soft: '#FEF2F2',
        },
        success: {
          DEFAULT: '#15803D',
          soft: '#DCFCE7',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        app: '0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 36px rgba(15, 23, 42, 0.08)',
        glass: '0 1px 0 rgba(255,255,255,0.95) inset, 0 18px 50px rgba(15, 23, 42, 0.12)',
        sheet: '0 -12px 48px rgba(15, 23, 42, 0.18)',
        toast: '0 14px 40px rgba(15, 23, 42, 0.22)',
        dock: '0 1px 0 rgba(255,255,255,0.85) inset, 0 16px 40px rgba(15, 23, 42, 0.16)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.35rem',
        '4xl': '1.75rem',
        blob: '2rem',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        tabbar: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-up': 'sheet-up 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
        float: 'float 5s ease-in-out infinite',
        spin: 'spin 0.7s linear infinite',
      },
      transitionTimingFunction: {
        expressive: 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
