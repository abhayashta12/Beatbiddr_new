/** @type {import('tailwindcss').Config} */

// Minimal greyscale. There is no accent colour — white is the accent.
// `primary`, `accent` and `neon` are kept as names so existing markup keeps
// compiling, but every one of them now resolves to the same neutral ramp, which
// drains the colour out of the whole app in one place.
const neutral = {
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#C8C8CE',
  400: '#A1A1AA',
  500: '#8A8A93',
  600: '#71717A',
  700: '#52525B',
  800: '#3F3F46',
  900: '#27272A',
  950: '#18181B',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: neutral,
        accent: neutral,
        neon: neutral,
        dark: {
          100: '#2A2A2D',
          200: '#232326',
          300: '#1C1C1F',
          400: '#161618',
          500: '#121214',
          600: '#0A0A0B', // app ground
          700: '#08080A',
          800: '#060607',
          900: '#000000',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Glows removed — kept as no-ops so any leftover class is harmless.
        'neon-primary': 'none',
        'neon-accent': 'none',
        'neon-teal': 'none',
        sheet: '0 -12px 40px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sheet-up': 'sheet-up 260ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
