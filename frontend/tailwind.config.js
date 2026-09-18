/** @type {import('tailwindcss').Config} */

// Minimal greyscale. There is no accent colour — white is the accent.
// `primary`, `accent` and `neon` are kept as names so existing markup keeps
// compiling, but every one of them now resolves to the same neutral ramp, which
// drains the colour out of the whole app in one place.
const neutral = {
  50: '#FFFFFF',
  100: '#FAFAFA',
  200: '#EDEDF0',
  300: '#D4D4DA',
  400: '#B4B4BD', // secondary text — bright enough to read in a dark room
  500: '#9B9BA5',
  600: '#7E7E88',
  700: '#5C5C66',
  800: '#3D3D45',
  900: '#26262B',
  950: '#151518',
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
          100: '#34343A',
          200: '#2A2A30',
          300: '#212126',
          400: '#1A1A1E',
          500: '#141417', // raised surfaces / sheets
          600: '#000000', // app ground — true black reads sharper than charcoal
          700: '#000000',
          800: '#000000',
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
