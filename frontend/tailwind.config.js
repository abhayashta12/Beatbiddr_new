/** @type {import('tailwindcss').Config} */

// Minimal greyscale. There is no accent colour — white is the accent.
// `primary`, `accent` and `neon` are kept as names so existing markup keeps
// compiling, but every one of them now resolves to the same neutral ramp, which
// drains the colour out of the whole app in one place.
// Greys carry a faint green bias so they sit with the accent rather than
// looking like a separate, colder palette laid underneath it.
const neutral = {
  50: '#FFFFFF',
  100: '#F7FAF8',
  200: '#E8EDEA',
  300: '#CBD3CE',
  400: '#A6AFA9', // secondary text — bright enough to read in a dark room
  500: '#8E978F',
  600: '#6E766F',
  700: '#515852',
  800: '#373D38',
  900: '#232724',
  950: '#141714',
};

// The one accent. It marks money, the live state, and the primary action.
const brand = {
  300: '#66EEB0',
  400: '#33E795',
  500: '#00E17A', // default
  600: '#00C76B',
  700: '#00A659',
  ink: '#00140A', // text that sits on top of the accent
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        // Legacy names from the old theme. Kept so any markup still using them
        // compiles, but drained to neutral so nothing reintroduces stray colour.
        primary: neutral,
        accent: neutral,
        neon: neutral,
        dark: {
          100: '#2E342F',
          200: '#252A26',
          300: '#1C211D',
          400: '#161A17',
          500: '#101410', // raised surfaces / sheets
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
        rise: 'rise 240ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        rise: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
