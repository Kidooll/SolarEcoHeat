// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0e0f11',
        "background-light": "#f6f8f6",
        "background-dark": "#141e14",
        "surface-dark": "#1d2b1e",
        "input-bg": "#233324",
        "border-dark": "#344c36",
        surface: {
          DEFAULT: '#16181c',
          2: '#1e2128',
          3: '#252830',
        },
        border: {
          DEFAULT: '#2a2d35',
          2: '#363a45',
        },
        text: {
          DEFAULT: '#e8eaf0',
          2: '#9ca3af',
          3: '#6b7280',
        },
        brand: {
          DEFAULT: '#3cb040',
          dark: '#2a7d2e',
          bg: '#071a08',
          border: '#1a5c1d',
        },
        primary: {
          DEFAULT: '#3cb040',
        },
        ok: {
          DEFAULT: '#3cb040',
          bg: '#071a08',
          border: '#1a5c1d',
          text: '#4ade80',
        },
        warn: {
          DEFAULT: '#f59e0b',
          bg: '#1c1107',
          border: '#92400e',
          text: '#fbbf24',
        },
        crit: {
          DEFAULT: '#ef4444',
          bg: '#1c0505',
          border: '#991b1b',
          text: '#f87171',
        },
        accent: {
          DEFAULT: '#3b82f6',
          bg: '#0a1628',
          border: '#1e3a5f',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['IBM Plex Sans', 'sans-serif'],
      },
      fontSize: {
        '2xl': '20px',
        'xl': '18px',
        'lg': '16px',
        'base': '14px',
        'sm': '13px',
        'xs': '12px',
        'mono-sm': '11px',
        'mono-xs': '10px',
        'mono-2xs': '9px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '6px',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'pulse-sync': 'pulse-sync 2.5s ease-in-out infinite',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.15' },
        },
        'pulse-sync': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 6px var(--ok)' },
          '50%': { opacity: '0.5', boxShadow: '0 0 2px var(--ok)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
